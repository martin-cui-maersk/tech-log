---
title: MySQL SQL 优化实战指南
navTitle: SQL 优化
category: MySQL
order: 3
slug: mysql-sql-optimize
description: 定位慢 SQL、读懂 EXPLAIN、索引设计与查询改写、深分页和写入优化的实战清单
---
# MySQL SQL 优化实战指南

> **适用场景**：接口变慢、慢查询日志出现新 SQL、上线前做 SQL 评审。
> **核心原则**：先测量再优化 —— 没有执行计划和实测耗时的"优化"都是猜。

## 目录

- [1. 先定位：别凭感觉优化](#1-先定位别凭感觉优化)
- [2. 读懂 EXPLAIN](#2-读懂-explain)
- [3. 索引设计](#3-索引设计)
- [4. 索引失效的常见写法](#4-索引失效的常见写法)
- [5. 查询改写](#5-查询改写)
- [6. 深分页优化](#6-深分页优化)
- [7. JOIN、排序与分组](#7-join排序与分组)
- [8. 表结构与数据类型](#8-表结构与数据类型)
- [9. 写入优化与关键参数](#9-写入优化与关键参数)
- [10. 实战案例：4.8s → 12ms](#10-实战案例48s--12ms)
- [11. 上线前检查清单](#11-上线前检查清单)
- [12. 容易踩的认知误区](#12-容易踩的认知误区)

---

## 1. 先定位：别凭感觉优化

### 1.1 打开慢查询日志

```ini
[mysqld]
slow_query_log                = ON
slow_query_log_file           = /var/log/mysql/slow.log
long_query_time               = 1          # 单位秒，按业务容忍度调整
min_examined_row_limit        = 100        # 扫描行数少于 100 的不记录
log_queries_not_using_indexes = ON         # 注意：QPS 高时日志会暴涨，配合上面的参数用
log_output                    = FILE       # 设为 TABLE 则写入 mysql.slow_log 表
```

```sql
-- 确认是否生效（改完可以 SET GLOBAL 临时生效，重启失效）
SHOW VARIABLES LIKE 'slow_query_log%';
SHOW VARIABLES LIKE 'long_query_time';

-- log_output = TABLE 时可以直接查
SELECT start_time, query_time, rows_examined, sql_text
FROM mysql.slow_log
ORDER BY start_time DESC
LIMIT 10;
```

### 1.2 从 performance_schema / sys 找问题 SQL

```sql
-- 全表扫描最多的语句
SELECT * FROM sys.statements_with_full_table_scans LIMIT 10;

-- 按总耗时排序，找出最该优化的 SQL
SELECT digest_text,
       count_star,
       ROUND(avg_timer_wait / 1000000000, 2) AS avg_ms,
       ROUND(sum_timer_wait / 1000000000, 2) AS total_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC
LIMIT 10;

-- 正在跑的慢语句（大于 5 秒）
SELECT id, user, time, state, LEFT(info, 120) AS sql_text
FROM information_schema.processlist
WHERE command <> 'Sleep' AND time > 5
ORDER BY time DESC;
```

### 1.3 日志分析工具

```bash
# 自带，按平均耗时归类
mysqldumpslow -s at -t 20 /var/log/mysql/slow.log

# Percona Toolkit，输出更详细（推荐）
pt-query-digest /var/log/mysql/slow.log
```

---

## 2. 读懂 EXPLAIN

```sql
EXPLAIN SELECT id, amount, created_at
FROM orders
WHERE user_id = 123 AND status = 3
ORDER BY created_at DESC
LIMIT 20;

-- MySQL 8.0.18+：给出实际执行情况（真实行数、真实耗时），比 EXPLAIN 更可靠
EXPLAIN ANALYZE SELECT ...;
```

| 字段 | 关注点 |
| --- | --- |
| `id` | 查询序号，id 越大越先执行；相同则从上往下 |
| `select_type` | `SIMPLE` / `PRIMARY` / `SUBQUERY` / `DERIVED`（派生表，常见于子查询） |
| `type` | **访问类型，最重要的指标**，见下表 |
| `possible_keys` | 候选索引；为空说明没有可用索引 |
| `key` | 实际用上的索引；和 `possible_keys` 不一致时说明选错了索引 |
| `key_len` | 索引使用的字节数，能反推联合索引用到了前几列 |
| `rows` | **预估**扫描行数，不是精确值（差一个数量级都可能） |
| `filtered` | 走索引后剩余行数的百分比，越低说明索引过滤效果越差 |
| `Extra` | 额外信息，重点看 `Using filesort` / `Using temporary` |

`type` 从好到差：

```
system > const > eq_ref > ref > range > index > ALL
```

- `ref` / `range` 通常是及格线；
- `index` 表示扫了整个索引树（比 `ALL` 强，但依然是大范围扫描）；
- `ALL` 是全表扫描，大表上基本要处理。

`Extra` 常见值：

| 值 | 含义 |
| --- | --- |
| `Using index` | 覆盖索引，不需要回表，很好 |
| `Using index condition` | 用上了索引下推（ICP，5.6+） |
| `Using where` | 拿到行之后还要过滤，配合 `rows` 一起看 |
| `Using filesort` | 需要额外排序；小结果集不一定是问题 |
| `Using temporary` | 用了临时表，常见于无索引的 `GROUP BY` / `DISTINCT` / `UNION` |
| `Using join buffer` | 被驱动表没有可用索引，用了 join buffer（8.0.18+ 可能是 hash join） |

---

## 3. 索引设计

### 3.1 最左前缀

联合索引 `idx(a, b, c)` 只能从最左列开始连续使用：

| 查询条件 | 能否用上索引 |
| --- | --- |
| `a = ?` | ✅ 用到 a |
| `a = ? AND b = ?` | ✅ 用到 a、b |
| `b = ? AND c = ?` | ❌ 跳过了 a |
| `a = ? AND c = ?` | ✅ 用到 a（c 只能靠 ICP 过滤，不能定位） |

### 3.2 联合索引的列顺序

一般遵循：**等值条件 → 范围条件 → 排序列**，等值条件里区分度高的靠前。

```sql
-- 查询：某用户已完成订单，按下单时间倒序取 20 条
SELECT id, amount, created_at
FROM orders
WHERE user_id = 123 AND status = 3
ORDER BY created_at DESC
LIMIT 20;

-- 合适的索引：user_id、status 都是等值，created_at 用来排序
ALTER TABLE orders ADD INDEX idx_user_status_time (user_id, status, created_at);
```

注意：范围条件后面的列**不能用于定位**，只能用于过滤或覆盖。比如 `WHERE a = 1 AND b > 2 AND c = 3` 上建 `(a, b, c)`，`c` 就只能靠 ICP 过滤。

### 3.3 覆盖索引

查询需要的列都在索引里，就不用回表（Extra 显示 `Using index`）：

```sql
-- idx_user_status_time 已包含 user_id、status、created_at，主键 id 隐含在二级索引里
EXPLAIN SELECT id, status, created_at FROM orders
WHERE user_id = 123 AND status = 3 ORDER BY created_at DESC LIMIT 20;
-- Extra: Using where; Using index  ← 没有回表

-- 多查一个 amount 就需要回表；如果这条 SQL 是核心热点，可以考虑把 amount 也加进索引
ALTER TABLE orders ADD INDEX idx_cover (user_id, status, created_at, amount);
```

代价是索引变大、写入变慢，**不要为了覆盖而把所有列都塞进索引**。

### 3.4 区分度（选择性）

**区分度 = 不重复的值个数 ÷ 总行数**，越接近 1 越好。它决定的是「这个索引值不值得建」，是索引设计里最容易被忽略、又最影响结果的一步。

```sql
-- 先算候选列的区分度，再决定建不建
SELECT COUNT(DISTINCT status)   / COUNT(*) AS status_sel,
       COUNT(DISTINCT user_id)  / COUNT(*) AS user_id_sel,
       COUNT(DISTINCT order_no) / COUNT(*) AS order_no_sel
FROM orders;

-- status_sel   = 0.0000004  （只有 5 个状态）→ 单独建索引没意义
-- user_id_sel  = 0.31                        → 适合建（更适合进联合索引）
-- order_no_sel = 1.0         （业务唯一）     → 最好的索引候选
```

经验判断（快速筛选用，最终还是要看 `EXPLAIN` 和实测耗时）：

| 区分度 | 判断 | 处理方式 |
| --- | --- | --- |
| > 0.5 | 很好 | 单列索引就能过滤掉大部分数据 |
| 0.1 ～ 0.5 | 一般 | 可以单独建，更推荐和其它列组成联合索引 |
| 0.01 ～ 0.1 | 偏弱 | 别单独建；放进联合索引当配角，或做成覆盖索引 |
| < 0.01（性别、状态、is_deleted） | 极弱 | 单独建索引基本不会被优化器选中 |

**为什么低区分度单独建索引会"建了也用不上"**：假设 `status` 有 5 个值、表 1000 万行，查 `status = 1` 大约命中 200 万行。走二级索引要先扫这 200 万条索引记录，再回表 200 万次随机读；而全表扫描是顺序读。优化器算完成本后会直接选 `type: ALL` —— 不是索引坏了，是走索引更贵。

**但有三个例外，别把结论用死：**

1. **低区分度列放进联合索引仍然有用**。`(status, created_at)` 里 `status` 只把范围缩小到 1/5，但配合 `created_at` 的范围条件后能定位到很小区间；`(user_id, status)` 里 `status` 只是配角，作用是让等值条件被索引完全覆盖。

2. **只取聚合值 / 覆盖索引时，低区分度索引也可能被选中**，因为索引比表窄、扫描代价更低：

   ```sql
   ALTER TABLE orders ADD INDEX idx_status (status);
   EXPLAIN SELECT COUNT(*) FROM orders WHERE status = 1;
   -- type: index（扫整个索引但不回表），Extra: Using where; Using index
   ```

3. **数据倾斜时平均区分度会骗人**。某列整体区分度很高，但个别值占了大部分数据（例如 `city` 里"北京"占 40%）：查热门值走索引反而更慢，查冷门值很快。这种情况 8.0 可以建直方图，让优化器知道真实分布：

   ```sql
   ANALYZE TABLE orders UPDATE HISTOGRAM ON city, status WITH 64 BUCKETS;
   ```

**联合索引的顺序怎么和区分度配合：**

- 等值条件里，**区分度高的列放前面**；
- 范围条件、排序列放后面（它们的位置由语义决定，不参与区分度排序）；
- 不能只看单列的区分度，要看**组合后的区分度**：

```sql
-- status 单列区分度极低，但和 user_id 组合后完全够用
SELECT COUNT(DISTINCT status, user_id) / COUNT(*) AS combo_sel,
       COUNT(DISTINCT status)          / COUNT(*) AS status_sel
FROM orders;
```

**`Cardinality` 是估算值，不能用它判断区分度：**

```sql
SHOW INDEX FROM orders;             -- 看 Cardinality 列（InnoDB 随机采样估算，偏差可能很大）

SELECT * FROM information_schema.statistics   -- 同样的数据，方便批量对比
WHERE table_schema = 'your_db' AND table_name = 'orders';

ANALYZE TABLE orders;               -- 统计信息过期会导致选错索引，可以手动刷新
```

评估「值不值得建索引」要用 `COUNT(DISTINCT)` 的真实值，不要拿 `SHOW INDEX` 的 `Cardinality` 当依据。

**长字符串列建前缀索引时，也用区分度来挑长度：**

```sql
-- 找出"能保留大部分区分度"的最短前缀：p15 已接近全列区分度，就用 15
SELECT COUNT(DISTINCT LEFT(email, 5))  / COUNT(*) AS p5,
       COUNT(DISTINCT LEFT(email, 10)) / COUNT(*) AS p10,
       COUNT(DISTINCT LEFT(email, 15)) / COUNT(*) AS p15,
       COUNT(DISTINCT email)           / COUNT(*) AS full_sel
FROM users;
```

一句话总结：**先把最终查询条件的组合区分度算出来，再决定建不建、几列、谁在前；区分度 < 0.01 的列不要单独建索引。**区分度只是快速筛选手段，`WHERE` 里高频出现的列、参与排序/分组/JOIN 的列即使区分度一般也值得建，最终以 `EXPLAIN` 和实测为准。

### 3.5 其他要点

```sql
-- 前缀索引：长字符串列（前缀长度按区分度挑，见 3.4；注意不能用于覆盖索引和 ORDER BY）
ALTER TABLE users ADD INDEX idx_email (email(20));

-- 8.0：函数索引 / 降序索引
ALTER TABLE orders ADD INDEX idx_date ((DATE(created_at)));
ALTER TABLE orders ADD INDEX idx_time_desc (created_at DESC);

-- 8.0：先设为不可见，观察一段时间再决定是否真删（比直接 DROP 安全得多）
ALTER TABLE orders ALTER INDEX idx_old INVISIBLE;
ALTER TABLE orders DROP INDEX idx_old;

-- 找冗余索引 / 没被用过的索引
SELECT * FROM sys.schema_redundant_indexes;
SELECT * FROM sys.schema_unused_indexes;
```

索引不是越多越好：每个索引都会让写入变慢、占用磁盘和 buffer pool。写多的表尽量控制在 3～5 个以内。

---

## 4. 索引失效的常见写法

| 问题写法 | 为什么失效 | 改写 |
| --- | --- | --- |
| `WHERE DATE(created_at) = '2026-01-01'` | 索引列上用了函数 | `WHERE created_at >= '2026-01-01' AND created_at < '2026-01-02'` |
| `WHERE phone = 13800000000`（`phone` 是 varchar） | 隐式类型转换，列被转成数字 | `WHERE phone = '13800000000'` |
| `WHERE name LIKE '%张%'` | 前导 `%` 无法定位 | `LIKE '张%'`；中间匹配用全文索引 / ES |
| `WHERE id + 1 = 100` | 索引列参与运算 | `WHERE id = 99` |
| `WHERE a = 1 OR b = 2` | 两个不同列，可能退化成全表 | 分别建索引；或拆成 `UNION ALL` |
| `WHERE status != 3` | 不等值通常用不上索引 | 改成枚举可用值 `IN (...)` |
| `WHERE a = 1 ORDER BY b` 但索引是 `(b, a)` | 排序不符合最左前缀 | 建 `(a, b)` |
| `ON t1.code = t2.code` 但两表字符集不同 | 无法使用索引比较 | 统一字符集与排序规则（都上 utf8mb4） |
| `SELECT * FROM t WHERE ...` | 无法覆盖索引，必然回表 | 只查需要的列 |

注意反向的隐式转换是**没问题**的：`int` 列与字符串比较时（`WHERE id = '123'`）是常量被转成数字，索引依然可用。

---

## 5. 查询改写

```sql
-- 1) 不要 SELECT *，只取需要的列，才有机会走覆盖索引
-- ✗
SELECT * FROM orders WHERE user_id = 123;
-- ✓
SELECT id, amount, created_at FROM orders WHERE user_id = 123;

-- 2) COUNT：InnoDB 中 COUNT(*) 和 COUNT(1) 效率基本一致，COUNT(col) 会跳过 NULL
--    ✗ 已废弃的 SQL_CALC_FOUND_ROWS 会扫全表
SELECT SQL_CALC_FOUND_ROWS id FROM orders LIMIT 20;
-- ✓ 需要总数就单独 COUNT，并且尽量加 WHERE 缩小范围
SELECT COUNT(*) FROM orders WHERE user_id = 123;

-- 3) 子查询 → JOIN（派生表无法用索引时会物化成临时表）
-- ✗
SELECT * FROM orders WHERE user_id IN (SELECT id FROM users WHERE vip = 1);
-- ✓
SELECT o.* FROM orders o JOIN users u ON u.id = o.user_id AND u.vip = 1;

-- 4) UNION → UNION ALL（除非确实需要去重，UNION 会带来额外排序）
SELECT id FROM orders WHERE status = 1
UNION ALL
SELECT id FROM orders WHERE status = 2;

-- 5) 只需要判断存在性时加 LIMIT 1
SELECT 1 FROM orders WHERE user_id = 123 LIMIT 1;

-- 6) 批量操作合并成一条，避免 N 次往返
INSERT INTO logs (user_id, action) VALUES (1,'a'), (2,'b'), (3,'c');
SELECT id, name FROM users WHERE id IN (1, 2, 3);
```

---

## 6. 深分页优化

```sql
-- ✗ 慢：要先扫描并丢弃 100 万行
SELECT id, amount FROM orders ORDER BY id LIMIT 1000000, 20;

-- ✓ 方案一：延迟关联，子查询只查主键（可走覆盖索引），再回表取需要的列
SELECT o.id, o.amount
FROM orders o
JOIN (SELECT id FROM orders ORDER BY id LIMIT 1000000, 20) AS t ON t.id = o.id;

-- ✓ 方案二：记住上一页最后一条的 id（游标分页，最推荐，但只能顺序翻页）
SELECT id, amount FROM orders WHERE id > 1000000 ORDER BY id LIMIT 20;
```

业务上「跳到第 10 万页」几乎没人用，前端限制最大页数（比如 100 页）往往比 SQL 优化更有效。

---

## 7. JOIN、排序与分组

```sql
-- 1) 小表驱动大表：让行数少的表做驱动表，被驱动表的关联字段必须有索引
--    优化器一般会自己判断，但关联字段没索引时会走 join buffer，性能直线下降
EXPLAIN SELECT o.id, u.name
FROM orders o JOIN users u ON u.id = o.user_id   -- users.id 是主键 ✓
WHERE o.created_at >= '2026-01-01';

-- 2) 排序：ORDER BY 的列顺序、方向要和索引一致才能免排序
--    Extra 里出现 Using filesort 就说明要额外排序
ALTER TABLE orders ADD INDEX idx_user_time (user_id, created_at);
SELECT id, created_at FROM orders WHERE user_id = 123 ORDER BY created_at DESC;
-- 单列排序方向相反时可以利用索引反向扫描；多列混合 ASC/DESC 需要 8.0 的降序索引

-- 3) 分组：GROUP BY 的列有索引可以避免 Using temporary
SELECT status, COUNT(*) FROM orders WHERE user_id = 123 GROUP BY status;

-- 4) 关联表数量别太多：一般不超过 3～4 张，join_buffer_size 调大能缓解但不能治本
```

---

## 8. 表结构与数据类型

- **够用就好**：能 `INT` 不用 `BIGINT`，能 `TINYINT` 不用 `INT`；金额用 `DECIMAL` 而不是 `FLOAT`。
- **尽量 NOT NULL + 默认值**：NULL 会让索引和统计信息更复杂，`COUNT(col)` 也会漏掉。
- **主键自增（或趋势递增）**：随机主键（如 UUID 字符串）会频繁触发页分裂；必须用 UUID 时存 `BINARY(16)`，8.0 可用 `UUID_TO_BIN(uuid, 1)` 把时间高位前置。
- **大字段分离**：`TEXT` / `BLOB` 放到独立的扩展表，主表保持窄，一个数据页能放更多行。
- **枚举适度**：状态类字段用 `TINYINT` + 注释，不要用长字符串。
- **大表 DDL 要在线做**：用 `pt-online-schema-change` / `gh-ost`，或至少确认 `ALGORITHM=INPLACE, LOCK=NONE`：

```sql
ALTER TABLE orders ADD INDEX idx_x (user_id), ALGORITHM=INPLACE, LOCK=NONE;
```

- **统计信息过期会导致选错索引**：

```sql
ANALYZE TABLE orders;
-- 8.0.3+：还可以给区分度不规则的列建直方图
ANALYZE TABLE orders UPDATE HISTOGRAM ON status, city WITH 64 BUCKETS;
```

---

## 9. 写入优化与关键参数

```sql
-- 批量插入，控制在几百到一千行一批；避免一个事务里几万行
INSERT INTO logs (user_id, action, created_at) VALUES
(1, 'login', NOW()), (2, 'logout', NOW()), ...;

-- 大批量导入：关掉自动提交 + 唯一性校验（确认数据可靠时）
SET autocommit = 0;
SET unique_checks = 0;
SET foreign_key_checks = 0;
-- ... LOAD DATA / INSERT ...
COMMIT;
```

| 参数 | 建议 | 说明 |
| --- | --- | --- |
| `innodb_buffer_pool_size` | 物理内存的 50%～70% | 最重要的参数，热数据要能全放进内存 |
| `innodb_flush_log_at_trx_commit` | `1`（安全）/ `2`（快） | `1` 每次提交刷盘不丢数据；`2` 可能丢最近 1 秒事务 |
| `sync_binlog` | `1`（安全）/ `0` 或 `100`（快） | 与上一条合称"双 1"，金融类业务不要动 |
| `innodb_log_file_size` | 1～2 GB | 太小会频繁 checkpoint |
| `binlog_group_commit_sync_delay` | 微秒 | 组提交，适度调大能提升高并发写入吞吐 |
| `max_connections` | 按实际并发 | 盲调大只会让 CPU 排队更严重 |

主从延迟的常见原因：大事务、单线程回放（可开并行复制 `slave_parallel_workers`）、从库上有大查询。**写入优化的一半是避免大事务。**

---

## 10. 实战案例：4.8s → 12ms

**慢 SQL**（订单列表，`orders` 表 1200 万行）：

```sql
SELECT id, amount, created_at
FROM orders
WHERE user_id = 8848 AND status = 3
ORDER BY created_at DESC
LIMIT 20;
```

**优化前**：表上只有主键。

```
type: ALL   key: NULL   rows: 11984213   Extra: Using where; Using filesort
```

耗时 4.8s —— 全表扫描 + 额外排序。

**第一步：加联合索引**

```sql
ALTER TABLE orders ADD INDEX idx_user_status_time (user_id, status, created_at);
```

```
type: ref   key: idx_user_status_time   key_len: 12   rows: 236
Extra: Using where
```

耗时降到 **12ms**：`user_id`、`status` 精确定位，`created_at` 顺带完成排序，`filesort` 消失。

**第二步（可选）：如果这条 SQL QPS 很高，再做覆盖索引**

```sql
ALTER TABLE orders ADD INDEX idx_cover (user_id, status, created_at, amount);
-- Extra: Using where; Using index  ← 完全不回表
```

代价是索引多占空间、写入稍慢，要用压测数据决定是否值得。

**要点**：`key_len: 12` 说明三列都用上了（`INT` 4 字节 + `TINYINT` 1 字节 …… 具体字节数取决于列类型和是否允许 NULL），这比 `rows` 更能反映索引的实际使用情况。

---

## 11. 上线前检查清单

- [ ] 慢查询日志里没有新增慢 SQL；核心接口压测过 P99
- [ ] 每条核心 SQL 都看过 `EXPLAIN`（8.0.18+ 尽量用 `EXPLAIN ANALYZE` 看实际行数）
- [ ] `type` 至少 `range`，大表上没有 `ALL`
- [ ] 没有 `SELECT *`、没有隐式类型转换、没有在索引列上做函数运算
- [ ] 深分页已处理（游标分页或延迟关联）
- [ ] 新加的索引在 `sys.schema_redundant_indexes` 里没有重复项
- [ ] 新索引的列算过区分度：区分度 < 0.01 的列没有单独建索引，联合索引里区分度高的等值列在前（见 3.4）
- [ ] 大表 DDL 用了在线工具或 `ALGORITHM=INPLACE, LOCK=NONE`
- [ ] `ANALYZE TABLE` 更新过统计信息
- [ ] 删除索引前先 `INVISIBLE` 观察一段时间
- [ ] 上线后观察慢查询趋势、`threads_running`、主从延迟

---

## 12. 容易踩的认知误区

1. **`rows` 是估算值**，不是实际扫描行数；差一个数量级很常见，要看真实情况用 `EXPLAIN ANALYZE`（8.0.18+）或 `Handler_read_*` 状态值。
2. **有索引 ≠ 会走索引**。优化器按成本估算选择，区分度低、范围过大时它会主动放弃索引，这时要反思索引设计而不是硬加 `FORCE INDEX`。
3. **`Using filesort` 不一定慢**。几十行的结果集排序毫无压力；真正的问题是大表 + 大结果集的排序。
4. **`Using temporary` 多半来自 `GROUP BY` / `DISTINCT` / `UNION`**，未必致命，但值得看一眼能不能用索引消除。
5. **`LIMIT` 不会减少扫描行数**（除非排序字段有索引，能顺序扫描后提前结束）。
6. **加索引能救读，但会拖慢写**。写多读少的表，宁可让查询稍微慢一点。
7. **不要在没有监控的情况下删索引**。先 `INVISIBLE`，跑一个业务周期再删。
8. **版本差异要记住**：`hash join`（8.0.18+）、函数索引（8.0.13+）、降序索引（8.0）、`EXPLAIN ANALYZE`（8.0.18+）、不可见索引（8.0）在 5.7 上都不可用，写方案前先确认线上版本。

```sql
SELECT VERSION();
```
