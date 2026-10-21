---
title: MySQL 订单小时级销售统计 SQL 优化实战：三种写法对比
navTitle: 订单统计优化实战
category: MySQL
order: 5
slug: mysql-sql-optimization-order-hourly-stats
description: MySQL 订单小时级销售统计 SQL 优化实战：三种写法对比
---

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
- 注释说明“`platform_order` 只扫一遍”；
- 默认 `--to` 当前是测试用 `$todayStart->modify('+1 day')`，上线前需改回 `$todayStart`。

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
                ->where('platform_order.order_paid_at', '>=', $localFrom)
                ->where('platform_order.order_paid_at', '<', $localTo)
                ->where('platform_order.owner_id', '>', 0)
                ->join(PlatformOrderProduct::tableName(), 'platform_order.order_id', '=', 'platform_order_product.order_id')
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
                ->join(PlatformOrderProduct::tableName(), 'platform_order.order_id', '=', 'platform_order_product.order_id')
                ->where('platform_order.order_paid_at', '>=', $localFrom)
                ->where('platform_order.order_paid_at', '<', $localTo)
                ->where('platform_order.owner_id', '>', 0)
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
- 版本 A 当前默认 `--to` 是测试用 `todayStart->modify('+1 day')`，上线前记得改回 `$todayStart`。
