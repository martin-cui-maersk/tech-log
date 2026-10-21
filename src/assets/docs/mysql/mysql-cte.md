---
title: MySQL 8.0 CTE 使用指引
navTitle: CTE 使用指引
category: MySQL
order: 4
slug: mysql-cte
description: MySQL 8.0 CTE 使用指引
---

# MySQL 8.0 CTE 使用指引

> 适用范围：MySQL 8.0+。核心结论前置：**CTE 在 MySQL 中不是“天然的性能优化手段”，而是一把需要理解优化器行为才能正确使用的工具**。多处引用的 CTE 会被强制物化，单次引用的 CTE 大概率被内联——你的 SQL 写法和性能预期之间，隔着一层优化器的决策。

---

## 一、CTE 是什么

CTE（Common Table Expression）用 `WITH` 子句定义一个**临时的命名结果集**，可以在同一语句的后续部分多次引用。它的主要价值是**提升可读性**和**避免重复书写子查询**，而不是保证性能提升。

```sql
WITH target_orders AS (
    SELECT order_id, owner_id, order_paid_at, currency_rate
    FROM platform_order
    WHERE order_paid_at >= '2026-09-01 08:00:00'
      AND order_paid_at <  '2026-09-02 08:00:00'
      AND owner_id > 0
)
SELECT owner_id, COUNT(*) AS cnt
FROM target_orders
GROUP BY owner_id;
```

**递归 CTE** 用于层级数据（组织架构、评论树等），需要 `WITH RECURSIVE`，且**总是物化**：

```sql
WITH RECURSIVE cte (n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM cte WHERE n < 5
)
SELECT * FROM cte;
```

---

## 二、优化器的两种策略：Merge 与 Materialize

MySQL 优化器对 CTE（以及派生表、视图引用）有两种处理方式，理解它们是正确使用 CTE 的前提。

| 策略 | 行为 | 对性能的影响 |
|---|---|---|
| **Merge（内联）** | 把 CTE 定义**展开**到每个引用位置，当作普通子查询合并进外层查询 | 不产生临时表开销；但**每个引用位置都会重新执行一次 CTE 内部的查询** |
| **Materialize（物化）** | 把 CTE 结果**计算一次**，写入内部临时表，所有引用都读这个临时表 | 源表只扫一次；但**产生临时表写入 + 后续读取的开销**，大结果集可能落盘 |

关键原则：**优化器默认尽量避免物化**，因为物化有成本，而 merge 有时能让条件更好地下推到基表。

---

## 三、何时物化，何时内联

这是 CTE 性能判断的核心。规则可以概括为：

### 3.1 多次引用 → 强制物化

**只要 CTE 在语句中被引用多次，MySQL 就会物化它**，且**每个语句只物化一次**，不论引用多少次。

这意味着：

- 源表（如 `platform_order`）**只被扫描一次**的预期，在多次引用场景下**理论上成立**；
- 但代价是**临时表物化**，且物化结果**可能自动建索引**（见 3.3）。

### 3.2 单次引用 → 大概率内联

对于**只被引用一次**的非递归 CTE，优化器**默认倾向 merge（内联）**，而不是物化。

单次引用时，内联通常更优：没有临时表开销，且外层条件可以下推到基表。**但内联意味着“CTE 内部的查询会被执行”，与物化“只执行一次”的直觉相反**——不过因为只引用一次，执行一次和内联展开在结果上是等价的，只是执行计划形态不同。

### 3.3 物化后的自动索引

如果 CTE 被物化，优化器会**自动评估并添加索引**到临时表上，以加速外层语句对它的访问。多次引用时，**可能为不同的引用分别创建不同的索引**。

这是物化 CTE 相比手动临时表的一个隐性优势：不需要你显式 `CREATE INDEX`，优化器会根据访问方式自动决定。

---

## 四、如何验证：EXPLAIN 是唯一可靠依据

**不能从 SQL 写法直接推断 CTE 是否物化，必须看 EXPLAIN。** 推荐使用树形格式，物化节点会显式出现：

```sql
EXPLAIN FORMAT=TREE
WITH target_orders AS (...)
SELECT ...;
```

在输出中关注：

| 信号 | 含义 |
|---|---|
| `-> Materialize CTE <name> ...` | CTE 被物化 |
| 出现 `creating_tmp_table` / `reusing_tmp_table`（optimizer trace） | 物化发生，且被复用 |
| **完全没有 `<materialized>` / `Materialize` 节点** | CTE 被内联（merge） |
| `type=ALL` 且 `rows` 接近基表行数 | 某个表被全表扫描，需要进一步排查索引 |

**传统格式的局限**：传统 `EXPLAIN` 输出对 CTE 物化的展示不如 `FORMAT=TREE` 直观，容易误判。排查 CTE 性能问题时，**优先用 `EXPLAIN FORMAT=TREE`**；如果需要实际执行耗时，用 `EXPLAIN ANALYZE FORMAT=TREE`（注意：某些版本对 CTE 的 profiling 数据可能不完整）。

---

## 五、性能决策框架

### 5.1 先问两个问题

1. **CTE 被引用了几次？**
  - 单次 → 优化器大概率内联，CTE 主要起可读性作用，**不要指望它“缓存结果”**。
  - 多次 → 强制物化，源表只扫一次，但**承担临时表开销**。

2. **CTE 的结果集有多大？**
  - 小结果集（几千行以内）→ 物化临时表通常在内存中，开销可接受。
  - 大结果集（百万行级别）→ 物化可能落盘，**多次引用的 CTE 未必比“两次走索引的 joinSub”更快**。

### 5.2 多次引用 CTE 的典型陷阱

你以为：

> “CTE 被引用两次，所以 `platform_order` 只扫一次，性能一定比扫两次好。”

实际可能：

> CTE 被内联了（如果优化器判定 merge 更优，而没有被“多次引用强制物化”规则覆盖），`platform_order` **仍然被扫两次**；或者 CTE 被物化了，但物化临时表的写入成本超过了你节省的那一次索引扫描。

**判断依据只能是 EXPLAIN**：如果 `EXPLAIN FORMAT=TREE` 里**没有 Materialize 节点**，说明 CTE 被内联，“只扫一次”的假设不成立。

### 5.3 当你需要强制物化

MySQL 提供 **`NO_MERGE` hint** 来阻止内联：

```sql
WITH target_orders AS (
    SELECT ...
)
SELECT /*+ NO_MERGE(target_orders) */ ...
FROM target_orders AS o
JOIN target_orders AS t ON ...;
```

或通过会话级开关关闭 merging：

```sql
SET optimizer_switch = 'derived_merge=off';
```

**但这不是“优化”，而是“干预”**：强制物化意味着你确认了物化临时表的成本低于重复扫描，这需要 benchmark 支撑，不要凭直觉使用。

### 5.4 替代方案：显式临时表

如果 CTE 被多次引用、数据量大、且需要**显式索引控制**，可以考虑 `CREATE TEMPORARY TABLE`：

```sql
CREATE TEMPORARY TABLE tmp_target_orders AS
SELECT ... FROM platform_order WHERE ...;

ALTER TABLE tmp_target_orders ADD INDEX (order_id);

-- 后续 JOIN 使用 tmp_target_orders
```

临时表的优势是**索引完全可控**，劣势是**需要管理生命周期**（同一连接内有效），在连接池环境下**风险较高**（事务或多次查询可能切换连接）。

---

## 六、Hyperf / Query Builder 下的 CTE 注意事项

### 6.1 `with()` 不是 CTE

Hyperf 的 **Eloquent 模型 Builder** 上的 `with()` 是**预加载关联**，不是 CTE。Query Builder（`Db::table()`）上也不保证有标准的 CTE 方法。如果你的 Hyperf 版本提供 `withExpression`，需要**先验证它生成的 SQL 和绑定顺序**，不能假设语义与原生 `WITH` 一致。

### 6.2 绑定参数顺序是隐性炸弹

Hyperf 的 Query Builder 将绑定参数**按子句分类存储**（`select`、`from`、`join`、`where`、`having` 等）。当 CTE + `insertUsing` 组合时，如果 CTE 的绑定参数不在默认顺序（`select → from → join → where → ...`）的预期位置上，**SQL 中的 `?` 占位符顺序可能与 `getBindings()` 返回的数组顺序不一致**，导致参数错位或数量不匹配。

**验证方法**：在开发环境打印 `$query->toSql()` 和 `$query->getBindings()`，逐个对照 `?` 的出现顺序是否与绑定数组一致。

### 6.3 推荐：CTE 逻辑用原生 SQL 或 `withExpression` + 严格验证

如果 CTE 是性能关键路径，**优先写原生 SQL** 并通过 `Db::select($sql, $bindings)` 执行，避免 Builder 层对 CTE 的封装不完整带来的不确定性。如果使用 `withExpression`，必须做 6.2 的绑定顺序验证。

---

## 七、最佳实践清单

**✅ 适合用 CTE 的场景**

- 同一子查询**需要被多次引用**，且结果集**不大**（物化临时表在内存中）；
- 递归层级查询（必须用 CTE）；
- 需要提升 SQL **可读性**，且性能已通过 EXPLAIN 验证无退化。

**⚠️ 需要验证后再用的场景**

- 单次引用的 CTE：默认会被内联，**不要指望“物化缓存”**；
- 多次引用 + 大结果集：**必须对比** CTE 物化 vs `joinSub` 两次索引扫描 vs 临时表的实际耗时；
- `INSERT ... SELECT` 中嵌套 CTE：额外检查绑定参数顺序。

**❌ 不应依赖的行为**

- 不能假设“写了 CTE 就一定会物化”；
- 不能假设“CTE 被引用 N 次就一定只执行一次内部查询”（内联时每个引用独立执行）；
- 不能假设“CTE 物化后自动有最优索引”（优化器自动索引是启发式的，不保证覆盖所有访问路径）。

**🛠️ 上线前必做**

1. 对目标 SQL 跑 `EXPLAIN FORMAT=TREE`，确认关键表的 `type` 不是 `ALL`（或 `ALL` 仅出现在确实需要全表扫描的小表上）；
2. 确认 `platform_order_product.order_id` 等 JOIN 列上有索引；
3. 用真实数据量级 benchmark，对比 CTE 方案与替代方案（`joinSub` / 临时表）的**实际耗时**，而非仅看 EXPLAIN 估算；
4. 如果在 Hyperf 中使用 CTE，验证 `toSql()` 与 `getBindings()` 的占位符顺序一致。
