---
title: PHP 8.0 `match` 表达式与 `switch` 的区别
navTitle: match 与 switch 的区别
category: PHP
order: 11
slug: php-match-vs-switch
description: 严格比较、无 fall-through、表达式语义与穷举性要求，以及从 switch 迁移到 match 的易错点与最佳实践
---

# PHP 8.0 `match` 表达式与 `switch` 的区别

> **适用场景**：状态码 / 枚举值到结果的映射、从 `switch` 迁移到 PHP 8、排查线上 `UnhandledMatchError`、准备 PHP 8 语法相关面试。
> **一句话原则**：`match` 是「严格比较 + 无 fall-through + 有返回值 + 必须覆盖所有情况」的**表达式**；需要执行多行语句、或有意利用穿透时，仍然用 `switch`。
> **版本要求**：`match` 自 PHP 8.0 起可用；文中 Backed Enum 示例需要 PHP 8.1+。
> **知识点衔接**：`==` / `===` 的类型转换规则详见本站《PHP 中 `==` / `===` / `empty()` / `isset()` 及类型转换比较 使用文档》。

## 目录

- [1. 一句话结论](#1-一句话结论)
- [2. 核心差异对比](#2-核心差异对比)
- [3. 代码示例](#3-代码示例)
- [4. 从 switch 迁移到 match](#4-从-switch-迁移到-match)
- [5. 易错点清单](#5-易错点清单)
- [6. 面试追问速答](#6-面试追问速答)
- [7. 最佳实践清单](#7-最佳实践清单)
- [8. 一句话总结](#8-一句话总结)

---

## 1. 一句话结论

`match` 使用严格比较（`===`）、无 fall-through、是表达式可直接赋值，且必须穷举所有情况。

四条差异对应四类实际收益：

| 差异 | 带来的收益 |
|------|------------|
| 严格比较 `===` | 消除隐式类型转换导致的错误分支 |
| 无 fall-through | 不再需要 `break`，也不会因漏写而串到下一个分支 |
| 是表达式 | 可赋值、可传参，代码从「赋值 + 分支」收敛成一个求值 |
| 必须覆盖所有情况 | 漏分支在运行时立即抛 `UnhandledMatchError`，而不是悄悄跳过 |

---

## 2. 核心差异对比

### 2.1 差异速查表

| 维度 | `switch` | `match`（PHP 8.0+） |
|------|----------|---------------------|
| 比较方式 | 松散比较（`==`） | 严格比较（`===`） |
| Fall-through | 存在（需手动 `break`） | 不存在 |
| 返回值 | 语句，无返回值 | **表达式**，可赋值 / 传参 |
| 穷举性 | 非必须 | 必须（漏掉分支抛 `UnhandledMatchError`） |
| 多条件合并 | 堆叠 `case` | 逗号分隔同一行 |

### 2.2 严格比较的实际影响

`switch` 使用 `==`，会触发类型转换：`switch (0)` 会匹配 `case "foo"`（PHP 7），PHP 8 修改了数字与非数字字符串的 `==` 行为后不再匹配，但松散比较本身仍是隐患。`match` 始终用 `===`，类型不同绝不匹配，消除了一类隐蔽 bug。

最典型的是 HTTP 状态码：`$statusCode` 若意外为字符串 `"200"`，在 `switch` 里可能命中 `case 200`，走进错误分支。

```php
$code = '200';   // 从上游 JSON / 请求参数拿到的，是字符串

// switch：松散比较，'200' == 200 为 true → 命中 case 200
switch ($code) {
    case 200:
        echo 'OK';       // PHP 8 下仍会输出这里
        break;
    default:
        echo '未知状态码';
        break;
}

// match：严格比较，'200' !== 200 → 走 default
echo match ($code) {
    200     => 'OK',
    default => '未知状态码',   // 输出这里
};
```

> ⚠️ `match` 的严格比较是**值和类型同时相等**，对象之间要求同一实例。这与 `===` 完全一致，不要指望它能像 `switch` 那样「兼容」数字字符串。

### 2.3 表达式语义

`match` 是表达式，整体求值后产生一个结果，因此可以：

- 直接赋值给变量；
- 作为函数参数传递；
- 先求值再用于字符串插值。

```php
// 1) 赋值
$label = match ($code) { 200 => 'OK', default => '未知' };

// 2) 传参（无需中间变量）
echo sprintf('状态：%s', match ($code) { 200 => 'OK', default => '未知' });

// 3) 字符串插值：插值的是求值后的变量，而不是把 match 直接塞进 {$...}
echo "状态：{$label}";
```

`match` 的分支（arm）按书写顺序逐个比较，**第一个匹配就停止**，且只求值该分支右侧的表达式，其余分支的表达式不会执行。

### 2.4 无 fall-through

`switch` 里多个条件共用一个结果，需要堆叠多个不带 `break` 的 `case`，漏写一个 `break` 就会穿透到下一个分支；`match` 用逗号把多个条件写在同一行，天然不会穿透。

```php
// switch：靠「故意不写 break」实现合并，容易误改
switch ($code) {
    case 400:
    case 422:
        $msg = '参数错误';
        break;
    case 500:
    case 503:
        $msg = '服务器错误';
        break;
    default:
        $msg = '未知';
        break;
}

// match：一次求值，逗号合并
$msg = match ($code) {
    400, 422 => '参数错误',
    500, 503 => '服务器错误',
    default  => '未知',
};
```

> ⚠️ `match` 根本没有穿透机制，**不需要也不允许写 `break`**。`break` 在表达式上下文中非法，写了会直接导致解析错误。

### 2.5 穷举性要求（UnhandledMatchError）

如果 `match` 的 subject 与所有 arm 都不匹配，且没有 `default` 分支，PHP 抛出 `UnhandledMatchError`。这是一个 `Error`（不是 `Exception`），用于在运行时发现遗漏的分支，比 `switch` 悄悄跳过更安全。

```php
// \UnhandledMatchError extends \Error，中间没有别的父类
try {
    echo match (99) { 1 => 'one', 2 => 'two' };
} catch (\UnhandledMatchError $e) {
    echo $e->getMessage();   // Unhandled match case
}
```

两点需要说清楚：

1. **语法上并不强制写 `default`**；强制的是「运行时必须有一条分支命中」，否则抛错。
2. 这个错误代表**代码逻辑漏洞**，通常不应捕获。正确做法是在开发阶段补齐 `default` 或用枚举穷举所有取值，而不是在生产里 `catch` 掉掩盖问题。

配合 PHP 8.1 的 Backed Enum 时，如果已经穷举了枚举的所有 case，省略 `default` 是安全的：新增枚举值会立刻暴露为 `UnhandledMatchError`，这正是期望的「编译期替代」效果。

---

## 3. 代码示例

### 3.1 严格比较：字符串 `"200"` 不匹配整数 `200`

```php
<?php

$code = "200";
$label = match ($code) {
    200     => 'OK',           // int 200，不匹配
    404     => 'Not Found',
    default => '未知状态码',   // 命中这里
};
echo $label; // 未知状态码
```

### 3.2 表达式赋值 + 多值合并

```php
$status = 1;
echo match ($status) {
    0       => '禁用',
    1, 2    => '正常',  // 1 和 2 都返回"正常"
    default => '未知',
}; // 正常
```

### 3.3 UnhandledMatchError 的触发

```php
// 仅用于演示抛出的错误类型；生产代码不要这样 catch
try {
    match (99) { 1 => 'one', 2 => 'two' };
} catch (\UnhandledMatchError $e) {
    echo $e->getMessage(); // Unhandled match case
}
```

### 3.4 用 `match (true)` 表达区间条件

`match` 的条件不一定是字面量，也可以是任意表达式。把 subject 固定为 `true`，就能在保持表达式语义的前提下写区间判断，替代一长串 `if/elseif`：

```php
$age = 17;
$group = match (true) {
    $age < 13   => '儿童',
    $age < 20   => '青少年',
    $age < 60   => '成年',
    default     => '老年',
};
echo $group; // 青少年
```

> 顺序即优先级：命中第一条后其余条件不再求值，所以区间条件必须从窄到宽排列。

### 3.5 配合 PHP 8.1 Backed Enum

```php
enum Status: int
{
    case Disabled = 0;
    case Active   = 1;
}

function label(Status $status): string
{
    // 已穷举所有 case，可省略 default
    return match ($status) {
        Status::Disabled => '禁用',
        Status::Active   => '正常',
    };
}
```

---

## 4. 从 switch 迁移到 match

### 4.1 同一段逻辑的两种写法

```php
// 迁移前：switch（语句 + break + 手动赋值）
switch ($status) {
    case 0:
        $text = '禁用';
        break;
    case 1:
    case 2:
        $text = '正常';
        break;
    default:
        $text = '未知';
        break;
}

// 迁移后：match（一个表达式）
$text = match ($status) {
    0       => '禁用',
    1, 2    => '正常',
    default => '未知',
};
```

### 4.2 迁移检查清单

- [ ] `switch` 的每个 `case` 是否都是「算出一个值」？是 → 适合改 `match`；否 → 保留 `switch`。
- [ ] 上游传入的值是否可能是**数字字符串**？迁移后行为会从「命中」变成「走 `default`」，需要确认这是期望行为，必要时显式转型。`declare(strict_types=1)` 不影响 `match` 的比较语义。
- [ ] 是否漏了 `default`？从 `switch` 迁移最容易省略它，新增业务状态时就会抛 `UnhandledMatchError`。
- [ ] arm 右侧是否只有**一个表达式**？需要多行逻辑时封装成函数调用，或回退到 `switch` / `if-else`。
- [ ] 是否有意利用了 fall-through（多个条件共享部分逻辑）？`match` 无法表达，保留 `switch`。
- [ ] 是否写了 `break`？必须删掉。

### 4.3 `match` 不能替代 `switch` 的场景

`match` 无法完全替代 `switch`：

- `switch` 的 fall-through 有时是有意为之，例如多个条件共享一段前置逻辑；
- `switch` 允许在 `case` 块内执行任意语句（写库、打日志、多次赋值、循环），而 `match` 的每个 arm 只能是**一个表达式**；
- 但如果只是「映射值 → 结果」，`match` 更简洁也更安全。

---

## 5. 易错点清单

| # | 易错点 | 正确做法 |
|---|--------|----------|
| 1 | **忘记 `match` 必须穷举**：从 `switch` 迁移时习惯性省略 `default`，新增业务状态时触发 `UnhandledMatchError` | 配合 PHP 8.1 枚举且已穷举所有 case 时可省略 `default`；其他场景建议始终保留 |
| 2 | **以为 arm 可以有多行语句**：`match` arm 右侧只能是**一个表达式**，不能是语句块 `{}` | 把多行逻辑封装成函数调用，或回退到 `switch` / `if-else` |
| 3 | **混淆无 fall-through 与 `break` 的关系**：`match` 没有穿透机制，不需要也不允许 `break`，写了会解析错误 | 多条件用逗号合并；删掉所有 `break` |
| 4 | **以为 `default` 只能写在最后**：`default` 可以出现在任意位置，但只能有一个 | 统一放最后，可读性最好 |

---

## 6. 面试追问速答

原文的「考察意图」主要检验三点：是否掌握 PHP 8.0 核心新语法；是否理解严格比较 vs 松散比较的实际影响（与 `==` / `===` 知识点衔接）；是否理解「表达式 vs 语句」的语义差异。对应追问如下。

1. **`match` 的严格比较在哪个场景下最容易体现价值？**

   简答：HTTP 状态码处理是典型场景。`switch ($statusCode)` 中 `$statusCode` 若意外为字符串 `"200"`，可能匹配 `case 200`（PHP 7 松散比较），产生错误分支。`match` 的 `===` 保证只有严格一致才匹配，类型不符直接走 `default` 或抛错。

2. **如何用 `match` 合并多个相同结果的条件？**

   简答：在同一个 arm 中用逗号分隔多个条件：`match ($code) { 400, 422 => '参数错误', 500, 503 => '服务器错误', default => '未知' }`。`switch` 需要堆叠多个无 `break` 的 `case`，更易出错。

3. **`UnhandledMatchError` 属于 `Error` 还是 `Exception`，应该如何处理？**

   简答：属于 `Error`（`\UnhandledMatchError extends \Error`，无中间类）。通常不应捕获它——它代表代码逻辑漏洞，应在开发阶段通过加 `default` 分支或穷举枚举来消除，而不是在生产中 `catch` 掩盖。

4. **`match` 能否替代所有 `switch`？有哪些场景仍适合 `switch`？**

   简答：不能。`switch` 的 fall-through 有时有意为之（如多个条件共享部分逻辑时），`switch` 也允许在 `case` 块内执行任意语句（`match` arm 只能是表达式）。但对于「映射值 → 结果」的场景，`match` 更简洁安全。

---

## 7. 最佳实践清单

1. **「值 → 结果」的映射一律用 `match`**，把赋值和分支收敛成一次求值，代码更短且不会漏 `break`。
2. **除已穷举枚举外，始终写 `default`**；`default` 放最后，作为兜底而不是补丁。
3. **不要把 `UnhandledMatchError` 当业务异常处理**，它应该暴露开发阶段遗漏的分支。
4. **arm 右侧只放一个表达式**，需要多行逻辑就抽函数或回退到 `switch` / `if-else`。
5. **多条件用逗号合并**，不要为了对齐写多个重复 arm。
6. **`match (true)` 的区间条件按从窄到宽排列**，命中即停止，顺序就是优先级。
7. **从 `switch` 迁移前先确认入参类型**，尤其是数字字符串；必要时显式转型，避免行为静默变化。
8. **配合 PHP 8.1 Backed Enum 做穷举**，把「新增状态漏改分支」变成运行时立即报错。
9. **`match` 里不写 `break`**，也不要在 arm 内做副作用（写库、打日志）；有副作用时用 `switch` 或先把映射结果算出来再执行。
10. **不要在 `match` 中塞过长的条件表达式**；可读性下降时优先 `if-else` 或策略表。

---

## 8. 一句话总结

- **比较**：`switch` 用 `==`，`match` 用 `===`，类型不同绝不匹配
- **穿透**：`switch` 需要 `break`，`match` 没有 fall-through，也不能写 `break`
- **返回值**：`switch` 是语句，`match` 是表达式，可赋值、可传参
- **穷举**：无 `default` 且无匹配时抛 `UnhandledMatchError`（`Error`，非 `Exception`），不要 `catch` 掩盖
- **合并**：`switch` 堆叠 `case`，`match` 用逗号写在同一行
- **边界**：arm 只能是一个表达式；多行语句、有意穿透的场景仍用 `switch`
- **迁移**：先确认入参类型，再补 `default`，最后删 `break`
