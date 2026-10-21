---
title: PHP DateTimeZone 使用指南
navTitle: DateTimeZone 使用指南
category: PHP
order: 8
slug: php-date-time-zone
description: PHP DateTimeZone 使用指南
---

# PHP DateTimeZone 使用指南

> 适用于 PHP 5.2+，示例基于 PHP 8.x。
> `DateTimeZone` 用于表示时区，通常与 `DateTime`、`DateTimeImmutable` 配合使用。

---

## 目录

- [1. 简介](#sec-1)
- [2. 创建 DateTimeZone](#sec-2)
- [3. 常用方法](#sec-3)
- [4. 与 DateTime 配合](#sec-4)
- [5. DateTimeImmutable 用法](#sec-5)
- [6. 过程式 API](#sec-6)
- [7. 列出时区](#sec-7)
- [8. 时区转换记录与夏令时](#sec-8)
- [9. 获取地理位置](#sec-9)
- [10. 设置默认时区](#sec-10)
- [11. 异常处理](#sec-11)
- [12. 常用时区常量](#sec-12)
- [13. 常见问题与注意事项](#sec-13)
- [14. 最佳实践](#sec-14)
- [15. 完整示例](#sec-15)
- [16. UTC 存储 + 本地时区查询（含夏令时自动切换）](#sec-16)
- [17. 参考](#sec-17)

---

<a id="sec-1" name="sec-1"></a>

## 1. 简介

`DateTimeZone` 是 PHP 内置类，表示一个时区。它主要用于：

- 创建带时区的 `DateTime` / `DateTimeImmutable`
- 时区转换
- 获取 UTC 偏移
- 处理夏令时
- 查询时区信息和转换记录

---

<a id="sec-2" name="sec-2"></a>

## 2. 创建 DateTimeZone

```php
<?php

$tz = new DateTimeZone('Asia/Shanghai');

echo $tz->getName(); // Asia/Shanghai
```

无效时区会抛出异常：

```php
<?php

try {
    $tz = new DateTimeZone('Invalid/Zone');
} catch (Exception $e) {
    echo '无效时区：' . $e->getMessage();
}
```

---

<a id="sec-3" name="sec-3"></a>

## 3. 常用方法

| 方法 | 说明 |
|---|---|
| `getName()` | 获取时区标识符，如 `Asia/Shanghai` |
| `getOffset(DateTimeInterface $datetime)` | 获取相对某时刻的偏移秒数，受夏令时影响 |
| `getLocation()` | 获取时区地理位置信息 |
| `getTransitions()` | 获取时区转换记录 |
| `DateTimeZone::listIdentifiers()` | 列出所有时区标识符 |
| `DateTimeZone::listAbbreviations()` | 列出时区缩写 |

---

<a id="sec-4" name="sec-4"></a>

## 4. 与 DateTime 配合

<a id="sec-4-1" name="sec-4-1"></a>

### 4.1 创建指定时区时间

```php
<?php

$dt = new DateTime(
    '2026-10-14 12:00:00',
    new DateTimeZone('Asia/Shanghai')
);

echo $dt->format('Y-m-d H:i:s P e');
// 2026-10-14 12:00:00 +08:00 Asia/Shanghai
```

<a id="sec-4-2" name="sec-4-2"></a>

### 4.2 转换时区

`DateTime::setTimezone()` 会修改原对象。

```php
<?php

$dt = new DateTime(
    '2026-10-14 12:00:00',
    new DateTimeZone('Asia/Shanghai')
);

$dt->setTimezone(new DateTimeZone('America/New_York'));

echo $dt->format('Y-m-d H:i:s P e');
// 2026-10-14 00:00:00 -04:00 America/New_York
```

<a id="sec-4-3" name="sec-4-3"></a>

### 4.3 获取偏移秒数

```php
<?php

$tz = new DateTimeZone('Asia/Shanghai');

$offset = $tz->getOffset(new DateTime('now', $tz));

echo $offset; // 28800，即 +08:00
```

<a id="sec-4-4" name="sec-4-4"></a>

### 4.4 常用格式化字符

| 字符 | 说明 | 示例 |
|---|---|---|
| `Y` | 年，4 位 | 2026 |
| `m` | 月，2 位 | 10 |
| `d` | 日，2 位 | 14 |
| `H` | 小时，24 小时制 | 12 |
| `i` | 分钟 | 00 |
| `s` | 秒 | 00 |
| `P` | UTC 偏移，带冒号 | +08:00 |
| `O` | UTC 偏移，无冒号 | +0800 |
| `T` | 时区缩写 | CST |
| `e` | 时区标识符 | Asia/Shanghai |
| `Z` | 偏移秒数 | 28800 |

示例：

```php
<?php

$dt = new DateTime(
    '2026-10-14 12:00:00',
    new DateTimeZone('Asia/Shanghai')
);

echo $dt->format('Y-m-d H:i:s P e T Z');
// 2026-10-14 12:00:00 +08:00 Asia/Shanghai CST 28800
```

---

<a id="sec-5" name="sec-5"></a>

## 5. DateTimeImmutable 用法

`DateTimeImmutable` 不会修改原对象，`setTimezone()` 会返回新对象。

```php
<?php

$dt = new DateTimeImmutable(
    '2026-10-14 12:00:00',
    new DateTimeZone('Asia/Shanghai')
);

$ny = $dt->setTimezone(new DateTimeZone('America/New_York'));

echo $dt->format('Y-m-d H:i:s P e') . PHP_EOL;
// 2026-10-14 12:00:00 +08:00 Asia/Shanghai

echo $ny->format('Y-m-d H:i:s P e') . PHP_EOL;
// 2026-10-14 00:00:00 -04:00 America/New_York
```

---

<a id="sec-6" name="sec-6"></a>

## 6. 过程式 API

PHP 也提供对应的过程式函数。

```php
<?php

$tz = timezone_open('Asia/Shanghai');

echo timezone_name_get($tz) . PHP_EOL;
// Asia/Shanghai

echo timezone_offset_get($tz, new DateTime('now', $tz)) . PHP_EOL;
// 28800

print_r(timezone_identifiers_list(DateTimeZone::ASIA));

print_r(timezone_abbreviations_list());
```

常用过程式函数：

| 函数 | 说明 |
|---|---|
| `timezone_open()` | 创建 `DateTimeZone` |
| `timezone_name_get()` | 获取时区名称 |
| `timezone_offset_get()` | 获取偏移秒数 |
| `timezone_identifiers_list()` | 列出时区标识符 |
| `timezone_abbreviations_list()` | 列出时区缩写 |
| `timezone_transitions_get()` | 获取时区转换记录 |
| `timezone_location_get()` | 获取时区地理位置 |

---

<a id="sec-7" name="sec-7"></a>

## 7. 列出时区

```php
<?php

// 所有时区
$all = DateTimeZone::listIdentifiers();

// 亚洲时区
$asia = DateTimeZone::listIdentifiers(DateTimeZone::ASIA);

// 中国时区
$china = DateTimeZone::listIdentifiers(DateTimeZone::PER_COUNTRY, 'CN');

print_r($asia);
print_r($china);
```

---

<a id="sec-8" name="sec-8"></a>

## 8. 时区转换记录与夏令时

```php
<?php

$nyTz = new DateTimeZone('America/New_York');

$transitions = $nyTz->getTransitions(
    strtotime('2026-01-01'),
    strtotime('2026-12-31')
);

print_r($transitions);
```

返回数组中的每一项通常包含：

- `ts`：时间戳
- `time`：ISO 时间
- `offset`：偏移秒数
- `isdst`：是否夏令时
- `abbr`：时区缩写

---

<a id="sec-9" name="sec-9"></a>

## 9. 获取地理位置

```php
<?php

$tz = new DateTimeZone('Asia/Shanghai');

print_r($tz->getLocation());
```

可能返回：

```php
[
    'country_code' => 'CN',
    'latitude' => '31.23333333',
    'longitude' => '121.46666666',
    'comments' => '',
]
```

---

<a id="sec-10" name="sec-10"></a>

## 10. 设置默认时区

```php
<?php

date_default_timezone_set('Asia/Shanghai');

echo date_default_timezone_get();
// Asia/Shanghai
```

建议在项目入口文件显式设置默认时区，例如：

```php
<?php

date_default_timezone_set('Asia/Shanghai');
```

---

<a id="sec-11" name="sec-11"></a>

## 11. 异常处理

PHP 8.3+ 可能抛出 `DateInvalidTimeZoneException`，旧版本通常抛出 `Exception`。

```php
<?php

try {
    $tz = new DateTimeZone('Invalid/Zone');
} catch (DateInvalidTimeZoneException $e) {
    // PHP 8.3+
    echo '无效时区：' . $e->getMessage();
} catch (Exception $e) {
    // 兼容旧版本
    echo '无效时区：' . $e->getMessage();
}
```

---

<a id="sec-12" name="sec-12"></a>

## 12. 常用时区常量

| 常量 | 说明 |
|---|---|
| `DateTimeZone::UTC` | UTC |
| `DateTimeZone::ALL` | 所有时区 |
| `DateTimeZone::AFRICA` | 非洲 |
| `DateTimeZone::AMERICA` | 美洲 |
| `DateTimeZone::ANTARCTICA` | 南极洲 |
| `DateTimeZone::ARCTIC` | 北极地区 |
| `DateTimeZone::ASIA` | 亚洲 |
| `DateTimeZone::ATLANTIC` | 大西洋 |
| `DateTimeZone::AUSTRALIA` | 澳大利亚 |
| `DateTimeZone::EUROPE` | 欧洲 |
| `DateTimeZone::INDIAN` | 印度洋 |
| `DateTimeZone::PACIFIC` | 太平洋 |
| `DateTimeZone::PER_COUNTRY` | 按国家 |

---

<a id="sec-13" name="sec-13"></a>

## 13. 常见问题与注意事项

<a id="sec-13-1" name="sec-13-1"></a>

### 13.1 时区缩写不唯一

`CST` 可能是：

- China Standard Time
- Central Standard Time
- Cuba Standard Time

因此应优先使用 IANA 时区标识符，例如：

- `Asia/Shanghai`
- `America/Chicago`
- `America/Havana`

<a id="sec-13-2" name="sec-13-2"></a>

### 13.2 固定偏移 vs 时区

可以使用固定偏移：

```php
<?php

$tz = new DateTimeZone('+08:00');
```

但它不会处理历史时区规则和夏令时。
如果涉及时区规则，建议使用 `Asia/Shanghai` 这类 IANA 标识符。

<a id="sec-13-3" name="sec-13-3"></a>

### 13.3 `setTimezone()` 的行为

- `DateTime::setTimezone()`：修改原对象
- `DateTimeImmutable::setTimezone()`：返回新对象，原对象不变

<a id="sec-13-4" name="sec-13-4"></a>

### 13.4 `getOffset()` 需要传入时间对象

因为同一时区在不同日期可能有不同偏移，例如夏令时。

```php
<?php

$tz = new DateTimeZone('America/New_York');

$winter = new DateTime('2026-01-01', $tz);
$summer = new DateTime('2026-07-01', $tz);

echo $tz->getOffset($winter); // -18000
echo $tz->getOffset($summer); // -14400
```

<a id="sec-13-5" name="sec-13-5"></a>

### 13.5 时区数据库版本影响

不同 PHP 版本、系统时区数据库版本可能影响历史时区和未来规则。生产环境应保持 PHP 和系统时区数据库更新。

---

<a id="sec-14" name="sec-14"></a>

## 14. 最佳实践

1. **数据库存储 UTC 时间**，展示时再转换为用户时区。
2. **显式传入时区**，不要依赖默认时区。
3. **使用 `DateTimeImmutable`**，避免意外修改原对象。
4. **使用 IANA 时区标识符**，如 `Asia/Shanghai`，不要用 `CST`。
5. **用户本地时区转换放在展示层**。
6. **入口文件统一设置默认时区**：

```php
<?php

date_default_timezone_set('Asia/Shanghai');
```

7. **格式化时带上时区信息**，便于排查问题：

```php
<?php

$dt->format('Y-m-d H:i:s P e');
```

---

<a id="sec-15" name="sec-15"></a>

## 15. 完整示例

```php
<?php

date_default_timezone_set('Asia/Shanghai');

$utc = new DateTimeZone('UTC');
$shanghai = new DateTimeZone('Asia/Shanghai');
$newYork = new DateTimeZone('America/New_York');

$dt = new DateTimeImmutable('2026-10-14 12:00:00', $shanghai);

echo "上海: " . $dt->format('Y-m-d H:i:s P e') . PHP_EOL;
echo "UTC: " . $dt->setTimezone($utc)->format('Y-m-d H:i:s P e') . PHP_EOL;
echo "纽约: " . $dt->setTimezone($newYork)->format('Y-m-d H:i:s P e') . PHP_EOL;

$offset = $shanghai->getOffset($dt);
echo "上海偏移秒数: {$offset}" . PHP_EOL;

// 列出中国时区
print_r(DateTimeZone::listIdentifiers(DateTimeZone::PER_COUNTRY, 'CN'));

// 纽约 2026 年夏令时转换
$transitions = $newYork->getTransitions(
    strtotime('2026-01-01'),
    strtotime('2026-12-31')
);

print_r($transitions);
```

输出示例：

```text
上海: 2026-10-14 12:00:00 +08:00 Asia/Shanghai
UTC: 2026-10-14 04:00:00 +00:00 UTC
纽约: 2026-10-14 00:00:00 -04:00 America/New_York
上海偏移秒数: 28800
```

---

<a id="sec-16" name="sec-16"></a>

## 16. UTC 存储 + 本地时区查询（含夏令时自动切换）

<a id="sec-16-1" name="sec-16-1"></a>

### 16.1 场景说明

假设：

- **数据存储**：数据库中统一存 UTC 时间，粒度到小时，如 `2026-10-16 10:00:00`。
- **用户时区**：`America/Los_Angeles`（美国太平洋时间）。
  - 冬令时（PST）：UTC-8
  - 夏令时（PDT）：UTC-7
- **用户输入**：本地日期区间，如开始 `2026-10-15`，结束 `2026-10-16`。
- **目标**：自动识别区间落在夏令时还是冬令时，把本地时间转换为 UTC 范围，再查库。

> **关键点**：不要硬编码 `-8` 或 `-7`，也不要自己判断夏令时。让 `DateTimeZone` 自动处理。

<a id="sec-16-2" name="sec-16-2"></a>

### 16.2 错误做法 ❌

```php
<?php

// ❌ 硬编码 UTC-8，夏令时区间会漏一小时
$startUtc = '2026-10-15 08:00:00';
$endUtc   = '2026-10-16 08:00:00';

// ❌ 手动判断夏令时，容易出错
// ❌ 用 UTC-8 偏移做减法
```

<a id="sec-16-3" name="sec-16-3"></a>

### 16.3 正确做法 ✅

核心思路：

1. 用 `America/Los_Angeles` 构造本地时间。
2. 用 `setTimezone('UTC')` 让 PHP 自动套用当时的偏移（PST 或 PDT）。
3. 用 `[start, end)` 半开区间查库，避免边界重复或遗漏。

```php
<?php

function localRangeToUtc(string $timezone, string $startDate, string $endDate): array
{
    $tz = new DateTimeZone($timezone);
    $utc = new DateTimeZone('UTC');

    // 本地区间 [startDate 00:00:00, (endDate + 1天) 00:00:00)
    $startLocal = new DateTimeImmutable($startDate . ' 00:00:00', $tz);
    $endLocal   = (new DateTimeImmutable($endDate . ' 00:00:00', $tz))
                    ->modify('+1 day');

    $startUtc = $startLocal->setTimezone($utc);
    $endUtc   = $endLocal->setTimezone($utc);

    return [
        'start' => $startUtc->format('Y-m-d H:i:s'),
        'end'   => $endUtc->format('Y-m-d H:i:s'),
        'start_offset' => $startLocal->format('P'),
        'end_offset'   => $endLocal->format('P'),
    ];
}

print_r(localRangeToUtc('America/Los_Angeles', '2026-10-15', '2026-10-16'));
```

输出示例：

```text
Array
(
    [start] => 2026-10-15 07:00:00     // 本地 10-15 00:00 (PDT, UTC-7)
    [end]   => 2026-10-17 07:00:00     // 本地 10-17 00:00 (PDT, UTC-7)
    [start_offset] => -07:00
    [end_offset]   => -07:00
)
```

**说明**：2026-10-15 和 10-16 仍在 PDT（夏令时，UTC-7），所以本地 00:00 对应 UTC 07:00。若换成 2026-12-15，则会是 PST（UTC-8），本地 00:00 对应 UTC 08:00。

<a id="sec-16-4" name="sec-16-4"></a>

### 16.4 跨夏令时切换点的例子

2026 年美国夏令时结束时间为 **11 月 1 日 02:00 PDT**（回拨到 01:00 PST）。

```php
<?php

$tz = new DateTimeZone('America/Los_Angeles');
$utc = new DateTimeZone('UTC');

// 切换前（夏令时，UTC-7）
$a = new DateTimeImmutable('2026-10-31 00:00:00', $tz);
echo $a->setTimezone($utc)->format('Y-m-d H:i:s P') . PHP_EOL;
// 2026-10-31 07:00:00 -07:00

// 切换后（冬令时，UTC-8）
$b = new DateTimeImmutable('2026-11-02 00:00:00', $tz);
echo $b->setTimezone($utc)->format('Y-m-d H:i:s P') . PHP_EOL;
// 2026-11-02 08:00:00 -08:00

// 11 月 1 日当天：本地这一天有 25 小时
$c1 = new DateTimeImmutable('2026-11-01 00:00:00', $tz);
$c2 = new DateTimeImmutable('2026-11-02 00:00:00', $tz);
$hours = ($c2->getTimestamp() - $c1->getTimestamp()) / 3600;
echo $hours . PHP_EOL; // 25
```

<a id="sec-16-5" name="sec-16-5"></a>

### 16.5 接口完整示例

```php
<?php

declare(strict_types=1);

date_default_timezone_set('UTC');

/**
 * 把用户本地的日期区间转换为 UTC 小时查询区间。
 *
 * @param string $timezone   IANA 时区，如 America/Los_Angeles
 * @param string $startDate  本地开始日期 Y-m-d
 * @param string $endDate    本地结束日期 Y-m-d（含）
 * @return array{start: string, end: string, tz: string, offset_start: string, offset_end: string}
 */
function buildUtcQueryRange(string $timezone, string $startDate, string $endDate): array
{
    $tz  = new DateTimeZone($timezone);
    $utc = new DateTimeZone('UTC');

    // 校验日期格式
    $startLocal = DateTimeImmutable::createFromFormat('!Y-m-d', $startDate, $tz);
    $endLocal   = DateTimeImmutable::createFromFormat('!Y-m-d', $endDate, $tz);

    if (!$startLocal || !$endLocal) {
        throw new InvalidArgumentException('日期格式必须为 Y-m-d');
    }

    if ($endLocal < $startLocal) {
        throw new InvalidArgumentException('结束日期不能早于开始日期');
    }

    // 半开区间：[start 00:00, (end + 1天) 00:00)
    $endLocalExclusive = $endLocal->modify('+1 day');

    $startUtc = $startLocal->setTimezone($utc);
    $endUtc   = $endLocalExclusive->setTimezone($utc);

    return [
        'start'        => $startUtc->format('Y-m-d H:i:s'),
        'end'          => $endUtc->format('Y-m-d H:i:s'),
        'tz'           => $timezone,
        'offset_start' => $startLocal->format('P'),
        'offset_end'   => $endLocalExclusive->format('P'),
    ];
}

// ------- 模拟接口 -------
$timezone  = $_GET['timezone']  ?? 'America/Los_Angeles';
$startDate = $_GET['start']     ?? '2026-10-15';
$endDate   = $_GET['end']       ?? '2026-10-16';

try {
    $range = buildUtcQueryRange($timezone, $startDate, $endDate);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

// SQL：数据表 records(created_at_utc DATETIME)，按小时存储
$sql = 'SELECT * FROM records
        WHERE created_at_utc >= :start
          AND created_at_utc <  :end
        ORDER BY created_at_utc ASC';

$pdo = new PDO('mysql:host=127.0.0.1;dbname=demo;charset=utf8mb4', 'root', '');
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':start' => $range['start'],
    ':end'   => $range['end'],
]);

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'range' => $range,
    'rows'  => $rows,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
```

请求示例：

```text
GET /api/records?timezone=America/Los_Angeles&start=2026-10-15&end=2026-10-16
```

响应示例：

```json
{
    "range": {
        "start": "2026-10-15 07:00:00",
        "end": "2026-10-17 07:00:00",
        "tz": "America/Los_Angeles",
        "offset_start": "-07:00",
        "offset_end": "-07:00"
    },
    "rows": []
}
```

**为什么是 `07:00` 而不是 `08:00`？**
因为 2026-10-15 还在 PDT（夏令时），UTC-7，所以本地 00:00 = UTC 07:00。系统自动切换，不需要你手动判断。

<a id="sec-16-6" name="sec-16-6"></a>

### 16.6 输出结果时把 UTC 转回用户本地时间

```php
<?php

$tz = new DateTimeZone('America/Los_Angeles');

foreach ($rows as &$row) {
    $dt = new DateTimeImmutable($row['created_at_utc'], new DateTimeZone('UTC'));
    $row['created_at_local'] = $dt->setTimezone($tz)->format('Y-m-d H:i:s P');
}

echo json_encode($rows, JSON_UNESCAPED_UNICODE);
```

<a id="sec-16-7" name="sec-16-7"></a>

### 16.7 边界与陷阱

<a id="sec-16-7-1" name="sec-16-7-1"></a>

#### (1) 使用半开区间 `[start, end)`

不要用 `BETWEEN '2026-10-15 00:00:00' AND '2026-10-16 23:59:59'`，因为：

- 秒级精度会漏掉 `23:59:59.5` 这类数据；
- 夏令时当天可能只有 23 小时或 25 小时，用本地时间比较更危险。

推荐：

```sql
WHERE created_at_utc >= :start AND created_at_utc < :end
```

<a id="sec-16-7-2" name="sec-16-7-2"></a>

#### (2) 夏令时切换日的“消失小时”和“重复小时”

- **春季前移**（如 2026-03-08 02:00 PST → 03:00 PDT）：本地时间 `02:00–02:59` 不存在。
- **秋季回拨**（如 2026-11-01 02:00 PDT → 01:00 PST）：本地时间 `01:00–01:59` 出现两次。

用 `DateTimeImmutable` 构造即可，PHP 会自动选一个（通常是第一次出现的时间），但**接口文档里要写清楚**，或者直接让用户按 UTC 输入。

<a id="sec-16-7-3" name="sec-16-7-3"></a>

#### (3) 时区标识符要用 IANA

```php
<?php

// ✅ 正确：自动处理 PST / PDT
new DateTimeZone('America/Los_Angeles');

// ❌ 错误：永远 UTC-8，不会切换夏令时
new DateTimeZone('-08:00');
```

<a id="sec-16-7-4" name="sec-16-7-4"></a>

#### (4) 用户传的时区要做白名单校验

```php
<?php

$allowed = DateTimeZone::listIdentifiers(DateTimeZone::AMERICA);
$timezone = $_GET['timezone'] ?? '';

if (!in_array($timezone, $allowed, true)) {
    throw new InvalidArgumentException('不支持的时区');
}
```

<a id="sec-16-7-5" name="sec-16-7-5"></a>

#### (5) 数据库连接时区

MySQL 连接时最好把会话时区设为 UTC：

```sql
SET time_zone = '+00:00';
```

或 PDO 里：

```php
<?php

$pdo->exec("SET time_zone = '+00:00'");
```

否则 `NOW()`、`CURDATE()` 等函数返回的时区会不一致。

<a id="sec-16-7-6" name="sec-16-7-6"></a>

#### (6) 存储粒度与查询粒度

你说数据是“以小时维度存储”，那么：

- 存储端：`2026-10-15 07:00:00`、`2026-10-15 08:00:00`、…（UTC 整点）
- 查询端：本地 `2026-10-15 00:00` → UTC `2026-10-15 07:00`，正好是整点，无误差。
- 如果以后改用半小时、15 分钟粒度，也一样处理，UTC 是连续的，跟本地偏移无关。

<a id="sec-16-8" name="sec-16-8"></a>

### 16.8 一个小工具函数：给出某本地日期当天的 UTC 区间

```php
<?php

function dayUtcRange(string $timezone, string $date): array
{
    $tz  = new DateTimeZone($timezone);
    $utc = new DateTimeZone('UTC');

    $startLocal = new DateTimeImmutable($date . ' 00:00:00', $tz);
    $endLocal   = $startLocal->modify('+1 day');

    return [
        $startLocal->setTimezone($utc)->format('Y-m-d H:i:s'),
        $endLocal->setTimezone($utc)->format('Y-m-d H:i:s'),
    ];
}

// 夏令时期间
print_r(dayUtcRange('America/Los_Angeles', '2026-07-15'));
// ['2026-07-15 07:00:00', '2026-07-16 07:00:00']

// 冬令时期间
print_r(dayUtcRange('America/Los_Angeles', '2026-12-15'));
// ['2026-12-15 08:00:00', '2026-12-16 08:00:00']

// 夏令时切换当天（25 小时）
print_r(dayUtcRange('America/Los_Angeles', '2026-11-01'));
// ['2026-11-01 07:00:00', '2026-11-02 08:00:00']
```

<a id="sec-16-9" name="sec-16-9"></a>

### 16.9 总结口诀

- **存 UTC**：数据库统一 UTC。
- **用 IANA**：`America/Los_Angeles`，不写 `-08:00`。
- **交给 PHP**：`setTimezone('UTC')` 自动处理夏令时。
- **半开区间**：`>= start AND < end`。
- **入口设默认**：`date_default_timezone_set('UTC')`。

---

<a id="sec-17" name="sec-17"></a>

## 17. 参考

- PHP 官方文档：`DateTimeZone`
  - https://www.php.net/manual/zh/class.datetimezone.php
- PHP 支持的时区列表
  - https://www.php.net/manual/zh/timezones.php
- PHP 日期时间格式化
  - https://www.php.net/manual/zh/datetime.format.php
