---
title: MySQL 订单小时级销售统计 SQL 优化实战：三种写法对比
navTitle: 订单统计优化实战
category: MySQL
order: 5
slug: mysql-sql-optimization-order-hourly-stats
description: MySQL 订单小时级销售统计 SQL 优化实战：三种写法对比
---

# MySQL 订单小时级销售统计 SQL 优化实战：三种写法对比

> 场景：按小时、按店铺负责人统计订单数、销售额、采购成本、运费成本。
> 核心难点：订单主表 `platform_order` 与订单商品明细表 `platform_order_product` 一对多，需要先按订单聚合商品金额，再按小时/负责人汇总，同时避免大表扫描和错误统计订单数。

---

## 1. 需求背景

统计口径：

- 统计维度：`stat_hour_utc`（订单付款时间转 UTC 后按小时取整）、`user_id`（`owner_id`）
- 统计指标：
  - `order_count`：订单数，不是商品行数
  - `sales_usd`：订单商品实付分摊金额 × 订单汇率，再汇总
  - `purchase_cost_usd`：采购成本 USD 汇总
  - `shipping_cost_usd`：运费成本 USD 汇总
- 过滤条件：
  - `order_paid_at` 在指定时间窗内
  - `owner_id > 0`
  - 商品行满足 `is_product_combo = 1 OR match_status = 1`

关键点：`platform_order_product` 一个订单可能有多行商品，必须**先按 `order_id` 聚合商品金额**，否则 `COUNT(*)` 会变成商品行数，销售额也会重复计算订单级成本。

---

## 2. 数据模型与索引

### 2.1 `platform_order` 关键字段与索引

```sql
CREATE TABLE `platform_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(64) NOT NULL DEFAULT '' COMMENT '系统订单ID',
  `owner_id` int NOT NULL DEFAULT '0' COMMENT '店铺负责人ID',
  `currency_rate` decimal(20,8) unsigned NOT NULL DEFAULT '1.00000000',
  `purchase_cost_usd` decimal(16,2) NOT NULL DEFAULT '0.00',
  `shipping_cost_usd` decimal(16,2) NOT NULL DEFAULT '0.00',
  `order_paid_at` timestamp NULL DEFAULT NULL COMMENT '订单付款时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_id` (`order_id`),
  KEY `idx_paid_at` (`order_paid_at`),
  KEY `idx_shop_paid_at` (`shop_id`,`order_paid_at`)
) ENGINE=InnoDB;
```

可用索引：

- `uk_order_id(order_id)`：订单 ID 唯一，join 商品表或回表都靠它
- `idx_paid_at(order_paid_at)`：按付款时间范围过滤
- `idx_shop_paid_at(shop_id, order_paid_at)`：如果按店铺过滤更合适

### 2.2 `platform_order_product` 关键字段与索引

```sql
CREATE TABLE `platform_order_product` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(64) NOT NULL DEFAULT '' COMMENT '系统订单ID',
  `amount_rate_price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '订单实付分摊金额',
  `match_status` tinyint unsigned NOT NULL DEFAULT '1' COMMENT '1已匹配 2未匹配',
  `is_product_combo` tinyint NOT NULL DEFAULT '0' COMMENT '是否组合SKU商品',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_product` (`order_id`,`order_product_id`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB;
```

可用索引：

- `uk_order_product(order_id, order_product_id)` / `idx_order_id(order_id)`：按 `order_id` 关联或聚合
- `(is_product_combo, match_status)` **没有索引**，`OR` 条件基本用不上索引

---

## 3. 三种核心写法

> 下面三种写法的时间窗统一用 `2026-10-13 08:00:00` ~ `2026-10-16 08:00:00` 示例；第一种原 SQL 时间窗不同，不影响写法对比。

### 写法一：订单表先过滤，再 JOIN 商品表，按订单聚合

```sql
SELECT
    DATE_FORMAT(CONVERT_TZ(t.order_paid_at, '+08:00', '+00:00'), '%Y-%m-%d %H:00:00') AS stat_hour_utc,
    t.owner_id AS user_id,
    COUNT(*) AS order_count,
    ROUND(SUM(t.amount_local * t.currency_rate), 2) AS sales_usd,
    ROUND(SUM(t.purchase_cost_usd), 2) AS purchase_cost_usd,
    ROUND(SUM(t.shipping_cost_usd), 2) AS shipping_cost_usd
FROM (
    SELECT
        o.order_id,
        o.owner_id,
        o.order_paid_at,
        o.currency_rate,
        o.purchase_cost_usd,
        o.shipping_cost_usd,
        SUM(p.amount_rate_price) AS amount_local
    FROM platform_order o
    INNER JOIN platform_order_product p
        ON p.order_id = o.order_id
    WHERE o.order_paid_at >= '2026-10-13 08:00:00'
      AND o.order_paid_at <  '2026-10-16 08:00:00'
      AND o.owner_id > 0
      AND (p.is_product_combo = 1 OR p.match_status = 1)
    GROUP BY
        o.order_id,
        o.owner_id,
        o.order_paid_at,
        o.currency_rate,
        o.purchase_cost_usd,
        o.shipping_cost_usd
) t
GROUP BY stat_hour_utc, t.owner_id;
```

**思路：**

1. `platform_order` 先用 `idx_paid_at` 圈定时间窗；
2. 通过 `order_id` 关联商品表，只取时间窗内订单的商品行；
3. 子查询按 `order_id` 聚合商品金额，每个订单变成一行；
4. 外层再按小时、`owner_id` 汇总。

**优点：**

- 订单表只访问一次；
- 先过滤订单，再关联商品，驱动表明确；
- 子查询按订单聚合后行数可控，外层 `COUNT(*)` 语义正确；
- SQL 结构清晰，容易维护。

**注意点：**

- 子查询 `GROUP BY` 字段较多，但 `order_id` 唯一，不会改变粒度；
- 外层 `GROUP BY stat_hour_utc` 是表达式，通常会有临时表/排序，但外层数据量已经聚合到订单级，一般可接受。

---

### 写法二：商品表先按订单聚合，再 JOIN 订单表

```sql
SELECT
    DATE_FORMAT(CONVERT_TZ(o.order_paid_at, '+08:00', '+00:00'), '%Y-%m-%d %H:00:00') AS stat_hour_utc,
    o.owner_id AS user_id,
    COUNT(*) AS order_count,
    ROUND(SUM(sku.amount_local * o.currency_rate), 2) AS sales_usd,
    ROUND(SUM(o.purchase_cost_usd), 2) AS purchase_cost_usd,
    ROUND(SUM(o.shipping_cost_usd), 2) AS shipping_cost_usd
FROM platform_order o
INNER JOIN (
    SELECT
        pop.order_id,
        SUM(pop.amount_rate_price) AS amount_local
    FROM platform_order po
    INNER JOIN platform_order_product pop
        ON pop.order_id = po.order_id
    WHERE po.order_paid_at >= '2026-10-13 08:00:00'
      AND po.order_paid_at <  '2026-10-16 08:00:00'
      AND po.owner_id > 0
      AND (pop.is_product_combo = 1 OR pop.match_status = 1)
    GROUP BY pop.order_id
) sku ON sku.order_id = o.order_id
GROUP BY stat_hour_utc, o.owner_id;
```

**思路：**

1. 子查询里先用 `platform_order po` 圈时间窗；
2. 关联商品表，按 `order_id` 聚合商品金额；
3. 外层再 JOIN `platform_order o` 取订单字段；
4. 外层按小时、`owner_id` 汇总。

**变体：外层再加冗余 WHERE**

```sql
WHERE o.order_paid_at >= '2026-10-13 08:00:00'
  AND o.order_paid_at <  '2026-10-16 08:00:00'
  AND o.owner_id > 0
```

这组条件在子查询里已经对 `po` 用过，且 `order_id` 唯一，所以**逻辑上冗余，结果不变**。它的作用只是可能引导优化器先过滤外层 `o`。

**优点：**

- 商品聚合子查询只输出 `order_id, amount_local`，结构简单；
- 如果优化器选择 `sku` 驱动，通过 `uk_order_id` 回表取订单字段，效率也不错。

**缺点：**

- `platform_order` 被访问两次（子查询 `po` + 外层 `o`）；
- 外层冗余 WHERE 不改变结果，可能多一次过滤；
- 如果优化器选择外层 `o` 驱动，可能先扫订单表再 join 聚合子查询，执行计划不一定稳定。

---

### 写法三：商品表子查询 + `order_id IN (子查询)` 圈订单

```sql
SELECT
    DATE_FORMAT(CONVERT_TZ(platform_order.order_paid_at, '+08:00', '+00:00'), '%Y-%m-%d %H:00:00') AS stat_hour_utc,
    platform_order.owner_id AS user_id,
    COUNT(*) AS order_count,
    ROUND(SUM(sku.amount_local * platform_order.currency_rate), 2) AS sales_usd,
    ROUND(SUM(platform_order.purchase_cost_usd), 2) AS purchase_cost_usd,
    ROUND(SUM(platform_order.shipping_cost_usd), 2) AS shipping_cost_usd
FROM platform_order
INNER JOIN (
    SELECT
        order_id,
        SUM(amount_rate_price) AS amount_local
    FROM platform_order_product
    WHERE (is_product_combo = 1 OR match_status = 1)
      AND order_id IN (
          SELECT order_id
          FROM platform_order
          WHERE order_paid_at >= '2026-10-13 08:00:00'
            AND order_paid_at <  '2026-10-16 08:00:00'
            AND owner_id > 0
      )
    GROUP BY order_id
) sku ON sku.order_id = platform_order.order_id
WHERE platform_order.order_paid_at >= '2026-10-13 08:00:00'
  AND platform_order.order_paid_at <  '2026-10-16 08:00:00'
  AND platform_order.owner_id > 0
GROUP BY stat_hour_utc, platform_order.owner_id;
```

**思路：**

1. 内层子查询从 `platform_order` 取时间窗内订单 ID；
2. 商品表用 `order_id IN (...)` 圈订单，同时过滤 `is_product_combo / match_status`；
3. 按 `order_id` 聚合商品金额；
4. 外层 JOIN 订单表，再按小时、`owner_id` 汇总。

**问题：**

- 商品表过滤条件 `(is_product_combo = 1 OR match_status = 1)` 没有合适索引，`OR` 容易导致商品表大范围扫描；
- `IN` 子查询可能被物化，也可能被改写为半连接，执行计划不稳定；
- 外层又写了一遍时间窗和 `owner_id`，冗余；
- 整体上比写法一、写法二更容易出现商品表全表扫描或临时表膨胀。

---

### 补充：CTE 版本（写法二的语法等价写法，MySQL 8.0+）

> CTE 版本与写法二**逻辑完全等价**：`WITH sku AS (...)` 就是写法二里的派生表 `INNER JOIN (SELECT ...) sku`，只是换成 CTE 语法提升可读性。MySQL 8.0+ 支持，5.7 不支持。

```sql
WITH sku AS (
    SELECT
        pop.order_id,
        SUM(pop.amount_rate_price) AS amount_local
    FROM platform_order po
    INNER JOIN platform_order_product pop
        ON pop.order_id = po.order_id
    WHERE po.order_paid_at >= '2026-10-13 08:00:00'
      AND po.order_paid_at <  '2026-10-16 08:00:00'
      AND po.owner_id > 0
      AND (pop.is_product_combo = 1 OR pop.match_status = 1)
    GROUP BY pop.order_id
)
SELECT
    DATE_FORMAT(
        CONVERT_TZ(o.order_paid_at, '+08:00', '+00:00'),
        '%Y-%m-%d %H:00:00'
    ) AS stat_hour_utc,
    o.owner_id AS user_id,
    COUNT(*) AS order_count,
    ROUND(SUM(sku.amount_local * o.currency_rate), 2) AS sales_usd,
    ROUND(SUM(o.purchase_cost_usd), 2) AS purchase_cost_usd,
    ROUND(SUM(o.shipping_cost_usd), 2) AS shipping_cost_usd
FROM platform_order o
INNER JOIN sku ON sku.order_id = o.order_id
GROUP BY
    stat_hour_utc,
    o.owner_id;
```

**和写法二的关系：**

- `WITH sku AS (...)` 就是写法二的子查询，内容完全一致；
- 外层 `INNER JOIN sku ON sku.order_id = o.order_id` 和写法二的外层 JOIN 一致；
- 外层**没有**再加冗余 `WHERE o.order_paid_at ...`，对应“写法二不带冗余 WHERE”的版本；
- 执行计划在 MySQL 8.0 中通常与派生表写法相同：这里 `sku` 只被引用一次，优化器一般会合并/物化，和派生表差异不大。

**优点：**

- 可读性更好，子查询逻辑单独命名；
- 如果后续需要多次引用 `sku`，CTE 可以避免重复写子查询。

**注意点：**

- MySQL 5.7 不支持 CTE；
- CTE 默认可能被物化，是否合并取决于优化器和引用次数，仍需 `EXPLAIN` 验证；
- 它不改变写法二的本质：`platform_order` 仍被访问两次（CTE 里的 `po` + 外层 `o`）。

---

## 4. 三种写法对比

| 对比项 | 写法一 | 写法二 | 写法三 |
|---|---|---|---|
| 核心思路 | 订单先过滤 → JOIN 商品 → 按订单聚合 | 商品先按订单聚合 → JOIN 订单 | 商品表 `IN` 子查询圈订单 → 聚合 → JOIN 订单 |
| `platform_order` 访问次数 | 1 次 | 2 次（`po` + `o`） | 2 次（`IN` 子查询 + 外层） |
| 商品表过滤方式 | JOIN 时过滤 | JOIN 时过滤 | `IN` 子查询 + 商品表过滤 |
| 订单数语义 | 子查询每订单一行，`COUNT(*)` 正确 | 同左 | 同左 |
| 外层冗余 WHERE | 无 | 可加可不加 | 有 |
| 执行计划稳定性 | 较稳定 | 中等 | 较差 |
| 商品表大范围扫描风险 | 低 | 中 | 高 |
| SQL 可读性 | 好 | 中 | 较差 |
| 推荐度 | ★★★★★ | ★★★☆☆ | ★☆☆☆☆ |

**补充说明：**

- **CTE 版本**（`WITH sku AS (...)`）与写法二逻辑等价，性能表现基本相同，只是语法更可读；MySQL 8.0+ 可用，5.7 不支持。
- 写法二外层冗余 WHERE 只在 `EXPLAIN` 证明有收益时保留，否则直接省略。

**结论：**

- **写法一最推荐**：订单表只访问一次，先过滤再关联，驱动表明确，统计语义清晰。
- **写法二可用**：但订单表访问两次；CTE 版本是写法二的语法等价形式，可读性更好，但性能本质不变。
- **写法三不推荐**：`OR` 条件无索引 + `IN` 子查询，商品表扫描风险最高。

---

## 5. 执行计划检查要点

对推荐写法执行：

```sql
EXPLAIN
SELECT ...;
```

重点看：

1. `platform_order` 是否走 `idx_paid_at` 的 `range`，而不是 `ALL`；
2. `platform_order_product` 是否通过 `idx_order_id` 或 `uk_order_product` 做 `ref` 关联；
3. 是否出现 `platform_order_product` 的 `ALL` 全表扫描；
4. `Extra` 是否出现 `Using temporary; Using filesort`，以及临时表是否落盘；
5. join 顺序是否以时间窗过滤后的订单表为驱动；
6. 如果写法二外层加了 WHERE，对比加与不加的 `EXPLAIN`，确认是否真的改善了执行计划；
7. 如果使用 CTE，确认 `sku` 是被合并还是物化，是否引入额外临时表。

---

## 6. 推荐最终 SQL

```sql
SELECT
    DATE_FORMAT(CONVERT_TZ(t.order_paid_at, '+08:00', '+00:00'), '%Y-%m-%d %H:00:00') AS stat_hour_utc,
    t.owner_id AS user_id,
    COUNT(*) AS order_count,
    ROUND(SUM(t.amount_local * t.currency_rate), 2) AS sales_usd,
    ROUND(SUM(t.purchase_cost_usd), 2) AS purchase_cost_usd,
    ROUND(SUM(t.shipping_cost_usd), 2) AS shipping_cost_usd
FROM (
    SELECT
        o.order_id,
        o.owner_id,
        o.order_paid_at,
        o.currency_rate,
        o.purchase_cost_usd,
        o.shipping_cost_usd,
        SUM(p.amount_rate_price) AS amount_local
    FROM platform_order o
    INNER JOIN platform_order_product p
        ON p.order_id = o.order_id
    WHERE o.order_paid_at >= '2026-10-13 08:00:00'
      AND o.order_paid_at <  '2026-10-16 08:00:00'
      AND o.owner_id > 0
      AND (p.is_product_combo = 1 OR p.match_status = 1)
    GROUP BY
        o.order_id,
        o.owner_id,
        o.order_paid_at,
        o.currency_rate,
        o.purchase_cost_usd,
        o.shipping_cost_usd
) t
GROUP BY stat_hour_utc, t.owner_id;
```

如果后续数据量继续增长，可以进一步考虑：

- 把 `platform_order` 的时间窗过滤结果先落到临时表/CTE，再关联商品表；
- 对商品表增加组合索引或改写 `OR` 条件；
- 对 `stat_hour_utc` 使用生成列或函数索引，减少外层排序开销；
- 将小时级统计做成预聚合表，按小时增量写入。

---

## 7. 索引与改写建议

### 7.1 商品表 `OR` 条件优化

当前条件：

```sql
(p.is_product_combo = 1 OR p.match_status = 1)
```

没有合适索引。如果业务允许，可以改写为：

```sql
p.match_status = 1
OR (p.is_product_combo = 1 AND p.match_status <> 1)
```

或者增加索引：

```sql
KEY `idx_combo_match` (`is_product_combo`, `match_status`)
```

但 `OR` 跨列仍然不一定能完全走索引，最终以 `EXPLAIN` 为准。

### 7.2 外层分组表达式

`GROUP BY stat_hour_utc` 是 `DATE_FORMAT(CONVERT_TZ(...))` 表达式，无法直接利用普通索引。由于外层已经是订单级聚合结果，通常可接受；如果订单量很大，可以考虑：

- 子查询里先按小时生成 `stat_hour_utc`，外层直接按列分组；
- 或者使用生成列 + 索引。

### 7.3 时间窗与 `owner_id`

如果查询经常带 `owner_id` 过滤，可以考虑：

```sql
KEY `idx_owner_paid_at` (`owner_id`, `order_paid_at`)
```

让 `owner_id > 0` + 时间窗组合过滤更高效。但 `owner_id > 0` 是范围条件，是否比 `idx_paid_at` 更优，需要根据数据分布用 `EXPLAIN` 验证。

---

## 8. 常见坑

1. **`COUNT(*)` 统计成商品行数**
   如果没有先按 `order_id` 聚合商品表，`COUNT(*)` 会变成商品行数，订单数虚高。

2. **订单级成本重复计算**
   `purchase_cost_usd`、`shipping_cost_usd` 是订单级字段，和商品表 JOIN 后会按商品行重复。必须先聚合商品金额，再按订单汇总成本。

3. **`OR` 条件导致商品表全表扫描**
   `(is_product_combo = 1 OR match_status = 1)` 没有索引支撑时，容易先扫商品表。

4. **外层冗余 WHERE 误以为能提升性能**
   写法二外层 WHERE 逻辑冗余，只有 `EXPLAIN` 证明能改善执行计划时才保留。

5. **`CONVERT_TZ` 与 `DATE_FORMAT` 影响分组**
   表达式分组通常会有临时表和排序，外层数据量大时需关注 `Using temporary; Using filesort`。

6. **CTE 不是性能银弹**
   `WITH sku AS (...)` 与派生表逻辑等价，MySQL 8.0 中是否物化取决于引用次数和优化器选择；只引用一次时通常不会带来额外收益，只提升可读性。

---

## 9. 总结

| 写法 | 推荐度 | 适用场景 |
|---|---|---|
| 写法一：订单先过滤 → JOIN 商品 → 按订单聚合 | ★★★★★ | 默认首选，订单表时间窗过滤明确、商品表按 `order_id` 关联 |
| 写法二：商品先聚合 → JOIN 订单 | ★★★☆☆ | 商品聚合结果很小、或 `EXPLAIN` 证明从 `sku` 驱动更优时 |
| 写法二 CTE 版本（MySQL 8.0+） | ★★★☆☆ | 与写法二等价，可读性更好；MySQL 5.7 不支持 |
| 写法三：商品表 `IN` 子查询圈订单 | ★☆☆☆☆ | 不推荐，`OR` + `IN` 子查询执行计划风险高 |

**最终建议：**

- 生产默认使用**写法一**；
- 写法二作为备选，外层冗余 WHERE 仅在执行计划有收益时保留；
- CTE 版本是写法二的语法等价形式，MySQL 8.0+ 可用，性能与写法二一致，选它主要是为了可读性；
- 写法三淘汰；
- 上线前用真实数据量做 `EXPLAIN`，重点关注 `platform_order` 是否走时间索引、商品表是否走 `order_id` 索引、是否出现商品表全表扫描和大临时表。

---

## 10. 对应的 PHP 命令行实现（两个版本）

> 两个版本都实现同一件事：把已付款订单按 `(UTC 整点小时, 运营 owner_id)` 汇总写入 `gross_profit_stat_hour`。
> 核心区别在**子查询是否携带订单级字段**：
> - **版本 A**：子查询同时取出订单级字段，主查询 `fromSub` 直接使用子查询物化表，不再回 `platform_order`。
> - **版本 B**：子查询只取 `order_id` 和商品金额，主查询 `joinSub` 回 `platform_order` 取订单字段。

### 10.1 版本 A：子查询携带订单级字段，主查询 `fromSub`

**特点：**

- 子查询 `selectRaw` 包含 `owner_id`、`order_paid_at`、`currency_rate`、`purchase_cost_usd`、`shipping_cost_usd`；
- 主查询 `Db::query()->fromSub($subQuery->toBase(), 'target_orders')`，不再扫 `platform_order`；
- 注释说明“`platform_order` 只扫一遍”。

**完整脚本：**

```php
<?php

declare(strict_types=1);

namespace App\Command\Report;

use App\Enums\Order\IsProductComboEnum;
use App\Enums\Order\OrderProductMatchStatusEnum;
use App\Model\Order\GrossProfitStatHour;
use App\Model\Order\PlatformOrder;
use App\Model\Order\PlatformOrderProduct;
use DateTimeImmutable;
use DateTimeZone;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Symfony\Component\Console\Input\InputOption;

/**
 * 毛利核算报表：把已付款订单按 (UTC 整点小时, 运营) 汇总写入 gross_profit_stat_hour
 *
 * 口径：
 *  - 订单量/采购成本/物流费直接取 platform_order（采购成本来自订单同步的明细行汇总，组合行已拆真实子SKU）
 *  - 销售额 USD = total_price × currency_rate（下单时快照的「订单货币→USD」，结算口径，不按报表汇率重算）
 *  - 汇率相关项（毛利公式中的 (订单量×2)/汇率、人民币毛利）不在此计算，由报表查询层按当日/区间平均汇率换算——除法不满足分配律，不能用小时值求和代替
 *  - 广告费不入表：求索会回填历史小时数据，报表查询时实时聚合 os 库，避免回填后数据丢失
 *
 * 按天 DELETE + INSERT 同事务覆盖，可任意重跑（订单成本回刷后重跑受影响时段即可），默认覆盖大前天 00:00 ~ 今天 00:00（UTC+8），共3天数据
 *
 * 执行：
 * php bin/hyperf.php report:gross-profit-stat-hour
 * 回刷历史：--from=2026-09-01 --to=2026-10-01（UTC+8 时间，支持 Y-m-d 或 Y-m-d H:i:s，但必须是整点）
 */
#[Command]
final class GrossProfitStatHourCommand extends HyperfCommand
{
    public function __construct()
    {
        parent::__construct('report:gross-profit-stat-hour');
    }

    public function configure(): void
    {
        $this->setDescription('按 (UTC小时, 运营) 汇总已付款订单到 gross_profit_stat_hour（毛利核算报表）');
        $this->addOption('from', null, InputOption::VALUE_OPTIONAL, '起始时间(UTC+8，含，必须整点如 2026-09-01 08:00:00)，Y-m-d 或 Y-m-d H:i:s；默认大前天 00:00，共3天数据');
        $this->addOption('to', null, InputOption::VALUE_OPTIONAL, '结束时间(UTC+8，不含，必须整点如 2026-09-02 00:00:00)；默认今天 00:00');
        parent::configure();
    }

    public function handle(): int
    {
        // 解析时间段
        $range = $this->getRange();
        if ($range === null) {
            return self::FAILURE;
        }
        [$fromLocal, $toLocal] = $range;

        $this->output->writeln(sprintf(
            '汇总区间(UTC+8)：%s ~ %s',
            $fromLocal->format('Y-m-d H:i:s'),
            $toLocal->format('Y-m-d H:i:s')
        ));

        $cursor = $fromLocal;
        while ($cursor < $toLocal) {
            $dayEnd = $cursor->modify('+1 day');
            if ($dayEnd > $toLocal) {
                $dayEnd = $toLocal;
            }
            // 统计毛利数据
            $this->rebuildHourlyGrossProfitStats($cursor, $dayEnd);
            $dayRows = GrossProfitStatHour::query()
                ->where('stat_hour_utc', '>=', $this->toUtc($cursor))
                ->where('stat_hour_utc', '<', $this->toUtc($dayEnd))
                ->count();
            $this->output->writeln(sprintf('  %s ~ %s：写入 %d 行', $cursor->format('Y-m-d H:i:s'), $dayEnd->format('Y-m-d H:i:s'), $dayRows));
            $cursor = $dayEnd;
        }
        // 回显结果
        $this->reportResult($fromLocal, $toLocal);

        return self::SUCCESS;
    }

    /**
     * UTC+8 时间转 UTC时间
     */
    private function toUtc(DateTimeImmutable $local): string
    {
        return $local->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    /**
     * 解析 [--from, --to) 区间，均为 UTC+8 整点时间；默认大前天 00:00 ~ 今天 00:00
     * 只接受整点：按整点小时 DELETE + INSERT 覆盖写入
     *
     * @return array{0: DateTimeImmutable, 1: DateTimeImmutable}|null
     * @throws \DateMalformedStringException
     */
    private function getRange(): ?array
    {
        $timezone   = new DateTimeZone('Asia/Shanghai');
        $todayStart = (new DateTimeImmutable('now', $timezone))->setTime(0, 0, 0);

        $from = $this->parseTime((string)$this->input->getOption('from'), $todayStart->modify('-3 day'));
        $to   = $this->parseTime((string)$this->input->getOption('to'), $todayStart);
        if ($from === null || $to === null) {
            return null;
        }

        foreach (['--from' => $from, '--to' => $to] as $option => $time) {
            if ($time->format('i:s') !== '00:00') {
                $this->output->writeln(sprintf(
                    '<error>%s 必须是整点（分/秒为 00），当前 %s</error>',
                    $option,
                    $time->format('Y-m-d H:i:s')
                ));
                return null;
            }
        }

        if ($from >= $to) {
            $this->output->writeln('<error>--from 必须早于 --to</error>');
            return null;
        }

        return [$from, $to];
    }

    /**
     * 解析单个时间参数：支持 Y-m-d（按 00:00:00 处理）与 Y-m-d H:i:s，空值取默认
     * 用回环校验严格拒绝 2026-13-45 这类被 DateTime 静默修正的输入
     */
    private function parseTime(string $value, DateTimeImmutable $default): ?DateTimeImmutable
    {
        $value = trim($value);
        if ($value === '') {
            return $default;
        }

        $timezone = new DateTimeZone('Asia/Shanghai');
        foreach (['Y-m-d H:i:s', 'Y-m-d'] as $format) {
            $parsed = DateTimeImmutable::createFromFormat('!' . $format, $value, $timezone);
            if ($parsed instanceof DateTimeImmutable && $parsed->format($format) === $value) {
                return $parsed;
            }
        }

        $this->output->writeln(sprintf('<error>无法解析时间 "%s"（支持 Y-m-d 或 Y-m-d H:i:s）</error>', $value));

        return null;
    }

    /**
     * 小时毛利统计 统计该时间段内的数据：同事务内先删后插，可重复执行
     *  - 把时间范围内的订单按照: UTC 整点小时 + 运营 owner_id 分组
     *  - 销售额取百货商品行的分摊实付金额（platform_order_product.amount_rate_price，订单货币）× 订单汇率
     *  - 百货口径：is_product_combo=1（组合商品一定是百货 SKU，且组合行恒为未匹配）或 match_status=1（已匹配百货 SKU）
     *  - 非百货行 cost_price/weight 均为 0，故采购成本/物流费直接取订单级值即与「只算百货」等价
     */
    private function rebuildHourlyGrossProfitStats(DateTimeImmutable $fromLocal, DateTimeImmutable $toLocal): void
    {
        $utcFrom   = $this->toUtc($fromLocal);
        $utcTo     = $this->toUtc($toLocal);
        $localFrom = $fromLocal->format('Y-m-d H:i:s');
        $localTo   = $toLocal->format('Y-m-d H:i:s');

        Db::transaction(function () use ($utcFrom, $utcTo, $localFrom, $localTo) {
            // 清空旧数据
            GrossProfitStatHour::query()
                ->where('stat_hour_utc', '>=', $utcFrom)
                ->where('stat_hour_utc', '<', $utcTo)
                ->delete();

            // 子查询：百货商品行汇总 + 订单级字段一次性取出，platform_order 只扫一遍
            //  - 借助 idx_paid_at 索引圈定时间窗口，JOIN platform_order_product（ref on idx_order_id）
            //  - 子查询同时 SELECT 订单级字段（owner_id/order_paid_at/currency_rate/purchase_cost_usd/shipping_cost_usd），
            //    主查询直接从子查询取值，不再回 platform_order 原表扫第二遍
            //  - 百货口径：is_product_combo=1（组合商品一定是百货 SKU，且组合行恒为 match_status=2）
            //    或 match_status=1（已匹配百货 SKU）；赠品 amount_rate_price=0 无需额外过滤
            //  - 口径：窗口内没有任何百货行的订单会被 INNER JOIN 整单排除（含其订单级成本），属预期行为
            $subQuery = PlatformOrder::query()
                ->join(PlatformOrderProduct::tableName(), 'platform_order.order_id', '=', 'platform_order_product.order_id')
                ->where('platform_order.order_paid_at', '>=', $localFrom)
                ->where('platform_order.order_paid_at', '<', $localTo)
                ->where('platform_order.owner_id', '>', 0)
                ->where(function ($q) {
                    $q->where('platform_order_product.is_product_combo', IsProductComboEnum::YES->value)
                        ->orWhere('platform_order_product.match_status', OrderProductMatchStatusEnum::MATCHED->value);
                })
                ->selectRaw('platform_order.order_id')
                ->selectRaw('platform_order.owner_id')
                ->selectRaw('platform_order.order_paid_at')
                ->selectRaw('platform_order.currency_rate')
                ->selectRaw('platform_order.purchase_cost_usd')
                ->selectRaw('platform_order.shipping_cost_usd')
                ->selectRaw('SUM(platform_order_product.amount_rate_price) AS amount_local')
                ->groupBy([
                    'platform_order.order_id',
                    'platform_order.owner_id',
                    'platform_order.order_paid_at',
                    'platform_order.currency_rate',
                    'platform_order.purchase_cost_usd',
                    'platform_order.shipping_cost_usd',
                ]);

            // 主查询：以子查询物化表为驱动，按 (UTC 小时, 运营) 聚合，不再扫 platform_order
            $select = Db::query()->fromSub($subQuery->toBase(), 'target_orders')
                ->selectRaw("DATE_FORMAT(CONVERT_TZ(target_orders.order_paid_at, '+08:00', '+00:00'), '%Y-%m-%d %H:00:00') AS stat_hour_utc")
                ->selectRaw('target_orders.owner_id AS user_id')
                ->selectRaw('COUNT(*) AS order_count')
                ->selectRaw('ROUND(SUM(target_orders.amount_local * target_orders.currency_rate), 2) AS sales_usd')
                ->selectRaw('ROUND(SUM(target_orders.purchase_cost_usd), 2) AS purchase_cost_usd')
                ->selectRaw('ROUND(SUM(target_orders.shipping_cost_usd), 2) AS shipping_cost_usd')
                ->groupBy('stat_hour_utc', 'target_orders.owner_id');

            // INSERT ... SELECT 避免在内存中处理写入
            GrossProfitStatHour::query()->insertUsing(
                ['stat_hour_utc', 'user_id', 'order_count', 'sales_usd', 'purchase_cost_usd', 'shipping_cost_usd'],
                $select
            );
        });
    }

    /**
     * 回显汇总结果
     */
    private function reportResult(DateTimeImmutable $fromLocal, DateTimeImmutable $toLocal): void
    {
        $utc     = new DateTimeZone('UTC');
        $utcFrom = $fromLocal->setTimezone($utc)->format('Y-m-d H:i:s');
        $utcTo   = $toLocal->setTimezone($utc)->format('Y-m-d H:i:s');

        $base = GrossProfitStatHour::query()
            ->where('stat_hour_utc', '>=', $utcFrom)
            ->where('stat_hour_utc', '<', $utcTo);

        $summary = (clone $base)
            ->selectRaw('COUNT(*) AS hour_rows, COUNT(DISTINCT user_id) AS users, SUM(order_count) AS orders, ROUND(SUM(sales_usd), 2) AS sales, ROUND(SUM(purchase_cost_usd), 2) AS purchase, ROUND(SUM(shipping_cost_usd), 2) AS shipping')
            ->first();

        $this->output->writeln(sprintf('汇总完成，覆盖 %s ~ %s (UTC)', $utcFrom, $utcTo));

        if ($summary === null || (int)$summary->hour_rows === 0) {
            $this->output->writeln('<comment>区间内无已付款订单</comment>');
            return;
        }

        $this->output->writeln(sprintf(
            '  小时行 %d，运营 %d，订单 %s，销售 $%s，采购 $%s，物流 $%s',
            $summary->hour_rows,
            $summary->users,
            $summary->orders,
            $summary->sales,
            $summary->purchase,
            $summary->shipping
        ));

        $topUsers = (clone $base)
            ->where('user_id', '<>', 0)
            ->groupBy('user_id')
            ->selectRaw('user_id, SUM(order_count) AS orders, ROUND(SUM(sales_usd), 2) AS sales')
            ->orderByDesc('sales')
            ->limit(5)
            ->get();
        foreach ($topUsers as $user) {
            $this->output->writeln(sprintf('  user_id=%d：%s 单，销售 $%s', $user->user_id, $user->orders, $user->sales));
        }
    }
}
```

---

### 10.2 版本 B：子查询只取 `order_id + amount_local`，主查询 `joinSub` 回订单表

**特点：**

- 子查询只 `selectRaw('platform_order.order_id')` 和 `SUM(...) AS amount_local`，`GROUP BY platform_order.order_id`；
- 主查询 `PlatformOrder::query()->joinSub($subQuery, 'target_orders', 'platform_order.order_id', '=', 'target_orders.order_id')`，回 `platform_order` 取订单字段；
- 默认 `--to` 已恢复为 `$todayStart`；
- 注释更详细，明确“非百货行 cost_price/weight 均为 0”“amount_rate_price 为订单货币金额”“赠品行”等口径。

**完整脚本：**

```php
<?php

declare(strict_types=1);

namespace App\Command\Report;

use App\Enums\Order\IsProductComboEnum;
use App\Enums\Order\OrderProductMatchStatusEnum;
use App\Model\Order\GrossProfitStatHour;
use App\Model\Order\PlatformOrder;
use App\Model\Order\PlatformOrderProduct;
use DateTimeImmutable;
use DateTimeZone;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Symfony\Component\Console\Input\InputOption;

/**
 * 毛利核算报表：把已付款订单按 (UTC 整点小时, 运营) 汇总写入 gross_profit_stat_hour
 *
 * 口径：
 *  - 仅统计窗口内「有百货行」的已付款订单；无任何百货行的订单会被 INNER JOIN 整单排除（含其订单级成本），属预期行为
 *  - 订单量/采购成本/物流费直接取 platform_order（采购成本来自订单同步的明细行汇总，组合行已拆真实子SKU）；
 *    非百货行 cost_price/weight 均为 0（数据前提），故取订单级值即与「只算百货」等价
 *  - 销售额 USD = SUM(百货行 platform_order_product.amount_rate_price，订单货币) × platform_order.currency_rate
 *    （amount_rate_price 为订单货币金额、非 USD；currency_rate 为下单时快照的「订单货币→USD」，结算口径，不按报表汇率重算）
 *  - 百货口径：is_product_combo=IsProductComboEnum::YES（组合商品一定是百货 SKU，且组合行恒为未匹配）
 *    或 match_status=OrderProductMatchStatusEnum::MATCHED（已匹配百货 SKU）
 *  - 排除 owner_id=0 的未分配运营订单
 *  - 时区前提：platform_order.order_paid_at 存储为 UTC+8 本地时间
 *  - 汇率相关项（毛利公式中的 (订单量×2)/汇率、人民币毛利）不在此计算，由报表查询层按当日/区间平均汇率换算——除法不满足分配律，不能用小时值求和代替
 *  - 广告费不入表：求索会回填历史小时数据，报表查询时实时聚合 os 库，避免回填后数据丢失
 *
 * 按天 DELETE + INSERT 同事务覆盖，可任意重跑（订单成本回刷后重跑受影响时段即可），默认覆盖大前天 00:00 ~ 今天 00:00（UTC+8），共3天数据
 *
 * 执行：
 * php bin/hyperf.php report:gross-profit-stat-hour
 * 回刷历史：--from=2026-09-01 --to=2026-10-01（UTC+8 时间，支持 Y-m-d 或 Y-m-d H:i:s，但必须是整点）
 */
#[Command]
final class GrossProfitStatHourCommand extends HyperfCommand
{
    public function __construct()
    {
        parent::__construct('report:gross-profit-stat-hour');
    }

    public function configure(): void
    {
        $this->setDescription('按 (UTC小时, 运营) 汇总已付款订单到 gross_profit_stat_hour（毛利核算报表）');
        $this->addOption('from', null, InputOption::VALUE_OPTIONAL, '起始时间(UTC+8，含，必须整点如 2026-09-01 08:00:00)，Y-m-d 或 Y-m-d H:i:s；默认大前天 00:00，共3天数据');
        $this->addOption('to', null, InputOption::VALUE_OPTIONAL, '结束时间(UTC+8，不含，必须整点如 2026-09-02 00:00:00)；默认今天 00:00');
        parent::configure();
    }

    public function handle(): int
    {
        // 解析时间段
        $range = $this->getRange();
        if ($range === null) {
            return self::FAILURE;
        }
        [$fromLocal, $toLocal] = $range;

        $this->output->writeln(sprintf(
            '汇总区间(UTC+8)：%s ~ %s',
            $fromLocal->format('Y-m-d H:i:s'),
            $toLocal->format('Y-m-d H:i:s')
        ));

        $cursor = $fromLocal;
        while ($cursor < $toLocal) {
            $dayEnd = $cursor->modify('+1 day');
            if ($dayEnd > $toLocal) {
                $dayEnd = $toLocal;
            }
            // 统计毛利数据
            $this->rebuildHourlyGrossProfitStats($cursor, $dayEnd);
            $dayRows = GrossProfitStatHour::query()
                ->where('stat_hour_utc', '>=', $this->toUtc($cursor))
                ->where('stat_hour_utc', '<', $this->toUtc($dayEnd))
                ->count();
            $this->output->writeln(sprintf('  %s ~ %s：写入 %d 行', $cursor->format('Y-m-d H:i:s'), $dayEnd->format('Y-m-d H:i:s'), $dayRows));
            $cursor = $dayEnd;
        }
        // 回显结果
        $this->reportResult($fromLocal, $toLocal);

        return self::SUCCESS;
    }

    /**
     * UTC+8 时间转 UTC时间
     */
    private function toUtc(DateTimeImmutable $local): string
    {
        return $local->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    /**
     * 解析 [--from, --to) 区间，均为 UTC+8 整点时间；默认大前天 00:00 ~ 今天 00:00
     * 只接受整点：按整点小时 DELETE + INSERT 覆盖写入
     *
     * @return array{0: DateTimeImmutable, 1: DateTimeImmutable}|null
     * @throws \DateMalformedStringException
     */
    private function getRange(): ?array
    {
        $timezone   = new DateTimeZone('Asia/Shanghai');
        $todayStart = (new DateTimeImmutable('now', $timezone))->setTime(0, 0, 0);

        $from = $this->parseTime((string)$this->input->getOption('from'), $todayStart->modify('-3 day'));
        $to   = $this->parseTime((string)$this->input->getOption('to'), $todayStart);
        if ($from === null || $to === null) {
            return null;
        }

        foreach (['--from' => $from, '--to' => $to] as $option => $time) {
            if ($time->format('i:s') !== '00:00') {
                $this->output->writeln(sprintf(
                    '<error>%s 必须是整点（分/秒为 00），当前 %s</error>',
                    $option,
                    $time->format('Y-m-d H:i:s')
                ));
                return null;
            }
        }

        if ($from >= $to) {
            $this->output->writeln('<error>--from 必须早于 --to</error>');
            return null;
        }

        return [$from, $to];
    }

    /**
     * 解析单个时间参数：支持 Y-m-d（按 00:00:00 处理）与 Y-m-d H:i:s，空值取默认
     * 用回环校验严格拒绝 2026-13-45 这类被 DateTime 静默修正的输入
     */
    private function parseTime(string $value, DateTimeImmutable $default): ?DateTimeImmutable
    {
        $value = trim($value);
        if ($value === '') {
            return $default;
        }

        $timezone = new DateTimeZone('Asia/Shanghai');
        foreach (['Y-m-d H:i:s', 'Y-m-d'] as $format) {
            $parsed = DateTimeImmutable::createFromFormat('!' . $format, $value, $timezone);
            if ($parsed instanceof DateTimeImmutable && $parsed->format($format) === $value) {
                return $parsed;
            }
        }

        $this->output->writeln(sprintf('<error>无法解析时间 "%s"（支持 Y-m-d 或 Y-m-d H:i:s）</error>', $value));

        return null;
    }

    /**
     * 小时毛利统计：同事务内先删后插，可重复执行
     *  - 仅统计窗口内「有百货行」的已付款订单，按 (UTC 整点小时, 运营 owner_id) 分组；
     *    窗口内无任何百货行的订单会被 INNER JOIN 整单排除（含其订单级成本），属预期行为；
     *    owner_id=0 的未分配运营订单排除
     *  - 销售额 USD = SUM(百货行 amount_rate_price)（订单货币）× 订单 currency_rate
     *  - 百货口径：is_product_combo=IsProductComboEnum::YES（组合行恒为未匹配，需单独放行）
     *    或 match_status=OrderProductMatchStatusEnum::MATCHED（已匹配百货 SKU）
     *  - 数据前提：非百货行 cost_price/weight 均为 0，故采购成本/物流费直接取订单级值即与「只算百货」等价；
     *    amount_rate_price 为订单货币金额（非 USD），故需再乘 currency_rate
     *  - 时区前提：order_paid_at 存储为 UTC+8 本地时间，CONVERT_TZ 转 UTC 后按整点小时归档
     */
    private function rebuildHourlyGrossProfitStats(DateTimeImmutable $fromLocal, DateTimeImmutable $toLocal): void
    {
        $utcFrom   = $this->toUtc($fromLocal);
        $utcTo     = $this->toUtc($toLocal);
        $localFrom = $fromLocal->format('Y-m-d H:i:s');
        $localTo   = $toLocal->format('Y-m-d H:i:s');

        Db::transaction(function () use ($utcFrom, $utcTo, $localFrom, $localTo) {
            // 清空旧数据
            GrossProfitStatHour::query()
                ->where('stat_hour_utc', '>=', $utcFrom)
                ->where('stat_hour_utc', '<', $utcTo)
                ->delete();

            // 百货商品行的分摊实付金额（订单货币），GROUP BY order_id → 1 单 1 行
            //  - 百货口径：is_product_combo=IsProductComboEnum::YES（组合商品一定是百货 SKU，
            //    且组合行恒为未匹配，故必须单独放行）或 match_status=OrderProductMatchStatusEnum::MATCHED（已匹配百货 SKU）
            //  - owner_id > 0：排除未分配运营的订单，属统计口径
            //  - 赠品：amount_price=0 → amount_rate_price=0，不影响销售额 SUM；
            //    但若赠品行满足上述百货条件，仍会把订单带进子查询（计入 order_count 与订单级成本、销售额为 0），需业务确认是否符合预期
            //  - 查询写法：用显式 JOIN 子查询而非「先查回 PHP 再 whereIn」——
            //    不圈时间窗口时，优化器可能以 platform_order_product 为驱动表导致全表扫；
            //    有 order_id 索引时 whereIn 字面量也能走 range，瓶颈不在扫表，
            //    而在订单多时 SQL 体积膨胀（逼近 max_allowed_packet、解析与执行计划开销上升）且多一次查询往返，故聚合留在 SQL 内完成
            //  - 口径：窗口内没有任何百货行的订单会被 INNER JOIN 整单排除（含其订单级成本），属预期行为
            $subQuery = PlatformOrder::query()
                ->where('platform_order.order_paid_at', '>=', $localFrom)
                ->where('platform_order.order_paid_at', '<', $localTo)
                ->where('platform_order.owner_id', '>', 0)
                ->join(PlatformOrderProduct::tableName(), 'platform_order.order_id', '=', 'platform_order_product.order_id')
                ->where(function ($q) {
                    $q->where('platform_order_product.is_product_combo', IsProductComboEnum::YES->value)
                        ->orWhere('platform_order_product.match_status', OrderProductMatchStatusEnum::MATCHED->value);
                })
                ->selectRaw('platform_order.order_id')
                ->selectRaw('SUM(platform_order_product.amount_rate_price) AS amount_local')
                ->groupBy('platform_order.order_id');

            // 主查询 按 (UTC 小时, 运营) 聚合
            //  - 子查询已按 order_id 聚合为 1 单 1 行，故 COUNT(*) 即订单数
            //  - 假设 order_paid_at 存储为 UTC+8 本地时间，CONVERT_TZ 转 UTC 后按整点小时归档
            //  - 非百货行 cost_price/weight 均为 0（数据前提），故订单级采购成本/物流费等价于「只算百货」
            $select = PlatformOrder::query()->joinSub($subQuery, 'target_orders', 'platform_order.order_id', '=', 'target_orders.order_id')
                ->selectRaw("DATE_FORMAT(CONVERT_TZ(platform_order.order_paid_at, '+08:00', '+00:00'), '%Y-%m-%d %H:00:00') AS stat_hour_utc")
                ->selectRaw('platform_order.owner_id AS user_id')
                ->selectRaw('COUNT(*) AS order_count')
                ->selectRaw('ROUND(SUM(target_orders.amount_local * platform_order.currency_rate), 2) AS sales_usd')
                ->selectRaw('ROUND(SUM(platform_order.purchase_cost_usd), 2) AS purchase_cost_usd')
                ->selectRaw('ROUND(SUM(platform_order.shipping_cost_usd), 2) AS shipping_cost_usd')
                ->groupBy('stat_hour_utc', 'platform_order.owner_id');

            // INSERT ... SELECT 避免在内存中处理写入
            GrossProfitStatHour::query()->insertUsing(
                ['stat_hour_utc', 'user_id', 'order_count', 'sales_usd', 'purchase_cost_usd', 'shipping_cost_usd'],
                $select
            );
        });
    }

    /**
     * 回显汇总结果
     */
    private function reportResult(DateTimeImmutable $fromLocal, DateTimeImmutable $toLocal): void
    {
        $utc     = new DateTimeZone('UTC');
        $utcFrom = $fromLocal->setTimezone($utc)->format('Y-m-d H:i:s');
        $utcTo   = $toLocal->setTimezone($utc)->format('Y-m-d H:i:s');

        $base = GrossProfitStatHour::query()
            ->where('stat_hour_utc', '>=', $utcFrom)
            ->where('stat_hour_utc', '<', $utcTo);

        $summary = (clone $base)
            ->selectRaw('COUNT(*) AS hour_rows, COUNT(DISTINCT user_id) AS users, SUM(order_count) AS orders, ROUND(SUM(sales_usd), 2) AS sales, ROUND(SUM(purchase_cost_usd), 2) AS purchase, ROUND(SUM(shipping_cost_usd), 2) AS shipping')
            ->first();

        $this->output->writeln(sprintf('汇总完成，覆盖 %s ~ %s (UTC)', $utcFrom, $utcTo));

        if ($summary === null || (int)$summary->hour_rows === 0) {
            $this->output->writeln('<comment>区间内无已付款订单</comment>');
            return;
        }

        $this->output->writeln(sprintf(
            '  小时行 %d，运营 %d，订单 %s，销售 $%s，采购 $%s，物流 $%s',
            $summary->hour_rows,
            $summary->users,
            $summary->orders,
            $summary->sales,
            $summary->purchase,
            $summary->shipping
        ));

        $topUsers = (clone $base)
            ->where('user_id', '<>', 0)
            ->groupBy('user_id')
            ->selectRaw('user_id, SUM(order_count) AS orders, ROUND(SUM(sales_usd), 2) AS sales')
            ->orderByDesc('sales')
            ->limit(5)
            ->get();
        foreach ($topUsers as $user) {
            $this->output->writeln(sprintf('  user_id=%d：%s 单，销售 $%s', $user->user_id, $user->orders, $user->sales));
        }
    }
}
```

---

### 10.3 两个 PHP 版本与三种 SQL 写法的对应关系

| PHP 版本 | 子查询内容 | 主查询方式 | 对应 SQL 写法 | 特点 |
|---|---|---|---|---|
| 版本 A | `order_id + 订单级字段 + amount_local`，`GROUP BY` 含订单级字段 | `fromSub($subQuery, 'target_orders')` | 接近写法一（订单先过滤 → JOIN 商品 → 按订单聚合），但订单字段在子查询里一次取出 | `platform_order` 只扫一遍；子查询 `GROUP BY` 字段多；主查询不再回订单表 |
| 版本 B | 只取 `order_id + amount_local`，`GROUP BY order_id` | `joinSub($subQuery, 'target_orders', ...)` 回 `platform_order` | 接近写法二（商品先聚合 → JOIN 订单） | 子查询更简洁；`platform_order` 在子查询和外层各访问一次；外层通过 `uk_order_id` 回表 |

**选择建议：**

- 若 `platform_order` 时间窗过滤后订单量不大，**版本 B** 结构更简单，子查询只聚合商品金额，外层回表取订单字段，执行计划通常也稳定；
- 若希望严格只扫一遍 `platform_order`，且能接受子查询 `GROUP BY` 字段较多，可用**版本 A**；
- 两个版本最终写入 `gross_profit_stat_hour` 的结果在口径上一致，前提是 `order_id` 唯一、时间窗和 `owner_id` 条件一致；
- 如果使用 MySQL 8.0+，也可以把版本 B 的子查询改写成 CTE（`WITH sku AS (...)`），逻辑等价，仅可读性更好。
