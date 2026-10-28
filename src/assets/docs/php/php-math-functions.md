---
title: PHP 数学函数使用文档
navTitle: BCMATH 数学函数
category: PHP
order: 10
slug: php-math-functions
description: PHP 数学函数使用文档
---

# PHP 数学函数使用文档

---

## 一、总览与分类

PHP 的数学函数（Math 扩展）**只操作 `int` 和 `float` 范围内的值**[reference:0]。如果需要任意精度，应使用 **BCMath**（`bcadd`、`bcmul` 等）或 **GMP** 扩展[reference:1]。

按用途分类：

| 类别 | 核心函数 |
|------|----------|
| **取整与舍入** | `round()`、`ceil()`、`floor()`、`intval()` |
| **除法与取余** | `intdiv()`、`fmod()`、`%`、`fdiv()`（PHP 8） |
| **基础运算** | `abs()`、`pow()`、`sqrt()`、`exp()`、`log()` |
| **最值** | `max()`、`min()` |
| **随机数** | `rand()`、`mt_rand()`、`random_int()`、`random_bytes()` |
| **进制转换** | `base_convert()`、`bindec()`、`decbin()`、`hexdec()`、`dechex()`、`decoct()`、`octdec()` |
| **浮点状态检查** | `is_nan()`、`is_finite()`、`is_infinite()` |
| **角度与三角** | `deg2rad()`、`rad2deg()`、`sin()`、`cos()`、`atan2()`、`hypot()` |
| **格式化输出** | `number_format()`、`sprintf()` |

---

## 二、取整与舍入

### 2.1 `round()` — 四舍五入

```php
round(float $num, int $precision = 0, int $mode = PHP_ROUND_HALF_UP): float
```

`round()` 返回 **float**，即使结果看起来是整数。

```php
var_dump(round(3.4));       // float(3)
var_dump(round(3.5));       // float(4)   默认 PHP_ROUND_HALF_UP
var_dump(round(-3.5));      // float(-4)  远离零
var_dump(round(3.14159, 2)); // float(3.14)
var_dump(round(1241757, -3));// float(1242000)  负精度 → 舍入到千位
```

**舍入模式（`$mode`）** [reference:2]：

| 常量 | 行为 | `1.5` | `-1.5` | `2.5` | `-2.5` |
|------|------|:---:|:---:|:---:|:---:|
| `PHP_ROUND_HALF_UP`（默认） | 远离零 | 2 | -2 | 3 | -3 |
| `PHP_ROUND_HALF_DOWN` | 朝向零 | 1 | -1 | 2 | -2 |
| `PHP_ROUND_HALF_EVEN` | 到最近的偶数 | 2 | -2 | 2 | -2 |
| `PHP_ROUND_HALF_ODD` | 到最近的奇数 | 1 | -1 | 3 | -3 |

> ⚠️ **`round()` 的浮点精度问题**：`round(0.615, 2)` 在某些环境可能返回 `0.61` 而不是 `0.62`，因为 `0.615` 在二进制中本身就不是精确的 `0.615`。需要严格十进制舍入时，用 `number_format()` 或 BCMath。

---

### 2.2 `ceil()` / `floor()` — 向上 / 向下取整

```php
var_dump(ceil(3.1));    // float(4)    向上，朝正无穷
var_dump(ceil(-3.1));   // float(-3)   注意：不是 -4
var_dump(floor(3.9));   // float(3)    向下，朝负无穷
var_dump(floor(-3.1));  // float(-4)
```

> **负数陷阱**：`ceil(-3.1)` 得 `-3`（“向上”指数值增大方向），`floor(-3.1)` 得 `-4`（“向下”指数值减小方向）。不要用日常语感理解。

两者都返回 **float**。

---

### 2.3 取整方式对照

| 函数 | `3.7` | `-3.7` | 方向 |
|------|:---:|:---:|------|
| `(int)` / `intval()` | 3 | -3 | **向零截断** |
| `round()` | 4 | -4 | 四舍五入（默认远离零） |
| `ceil()` | 4 | -3 | 向上（朝正无穷） |
| `floor()` | 3 | -4 | 向下（朝负无穷） |

```php
var_dump((int)3.7);      // int(3)     截断
var_dump((int)-3.7);     // int(-3)    向零，不是 floor
var_dump(round(3.7));    // float(4)
var_dump(ceil(3.7));     // float(4)
var_dump(floor(3.7));    // float(3)
```

**选择建议**：
- 需要 **int 类型结果** → `(int)` / `intval()`
- 需要 **数学意义上的四舍五入** → `round()`
- 需要 **不小于原值的最小整数** → `ceil()`
- 需要 **不大于原值的最大整数** → `floor()`
- 金额分转元、元转分 → 用 `intval(round($yuan * 100))`，不要直接用 `(int)`

---

## 三、除法与取余

### 3.1 `/` 与 `intdiv()`

PHP 的 `/` **永远返回 float**，即使整除也是[reference:5]：

```php
var_dump(10 / 2);       // float(5)
var_dump(10 / 3);       // float(3.3333333333333)
```

需要**整数除法**用 `intdiv()`：

```php
intdiv(int $num1, int $num2): int
```

```php
var_dump(intdiv(10, 3));   // int(3)
var_dump(intdiv(-10, 3));  // int(-3)   向零截断
var_dump(intdiv(10, -3));  // int(-3)
var_dump(intdiv(-10, -3)); // int(3)
```

**`intdiv()` 的异常**（PHP 7+）[reference:6]：

```php
intdiv(1, 0);              // DivisionByZeroError
intdiv(PHP_INT_MIN, -1);   // ArithmeticError（结果溢出）
```

> `PHP_INT_MIN / -1` 的数学结果是 `PHP_INT_MAX + 1`，int 无法表示，因此抛 `ArithmeticError`[reference:7]。

---

### 3.2 `%` — 整数取模

`%` 的操作数会**先被转换为整数**（去掉小数部分）[reference:8]：

```php
var_dump(10 % 3);      // int(1)
var_dump(10.9 % 3);    // int(1)    10.9 → 10，再 10 % 3
var_dump(10 % 3.9);    // int(1)    3.9 → 3
```

**负数取模**：`%` 的结果符号**跟随被除数**。

```php
var_dump(-10 % 3);     // int(-1)
var_dump(10 % -3);     // int(1)
var_dump(-10 % -3);    // int(-1)
```

**除零**：`1 % 0` 在 PHP 7+ 抛 `DivisionByZeroError`（旧版是 `E_WARNING`）[reference:9]。

---

### 3.3 `fmod()` — 浮点取余

```php
fmod(float $num1, float $num2): float
```

`fmod()` 接受浮点数、返回浮点余数，**不做整数截断**[reference:10]。

```php
var_dump(fmod(10.5, 3));    // float(1.5)    10.5 - 3*3 = 1.5
var_dump(fmod(10.5, 3.2));  // float(0.9)
var_dump(fmod(-10.5, 3));   // float(-1.5)   符号跟随被除数
var_dump(fmod(10, 0.3));    // float(0.1)    ⚠️ 浮点精度，可能不是精确的 0.1
```

**`%` vs `fmod()` 核心区别**：

| | `%` | `fmod()` |
|---|---|---|
| 操作数 | 先转 int（截断小数） | 保留 float |
| 返回类型 | int | float |
| 适用 | 整数取余 | 浮点取余 |
| 示例 | `10.9 % 3` → `1` | `fmod(10.9, 3)` → `1.9` |

> 需要浮点余数时**必须用 `fmod()`**，`%` 会静默丢弃小数部分[reference:11]。

---

### 3.4 `fdiv()` — IEEE 754 除法（PHP 8+）

```php
fdiv(float $num1, float $num2): float
```

`fdiv()` 遵循 IEEE 754，**除数为 0 时不抛异常**，而是返回 `INF`、`-INF` 或 `NAN`[reference:12]。

```php
var_dump(fdiv(1, 0));    // float(INF)
var_dump(fdiv(-1, 0));   // float(-INF)
var_dump(fdiv(0, 0));    // float(NAN)
var_dump(fdiv(10, 3));   // float(3.3333333333333)
```

用 `is_nan()`、`is_infinite()`、`is_finite()` 检查结果状态。

> `fdiv()` **不是**解决浮点精度的工具，它只是定义除零行为。金额精度仍需 BCMath。

---

## 四、基础运算

### 4.1 `abs()`

```php
var_dump(abs(-5));      // int(5)
var_dump(abs(-5.5));    // float(5.5)
var_dump(abs(PHP_INT_MIN)); // float(9.2233720368548E+18)  溢出为 float
```

### 4.2 `pow()` 与 `**`

```php
var_dump(pow(2, 10));   // int(1024)
var_dump(pow(2, -1));   // float(0.5)
var_dump(2 ** 10);      // int(1024)    ** 运算符与 pow() 等价
```

`pow()` / `**` 的结果可能是 **int 或 float**：底数和指数均为非负整数且结果在 int 范围内时为 int，否则为 float。

### 4.3 `sqrt()` 与负参数

```php
var_dump(sqrt(16));     // float(4)    始终返回 float
var_dump(sqrt(2));      // float(1.4142135623731)
var_dump(sqrt(-1));     // float(NAN)  负数的平方根为 NAN，不报错
```

> `sqrt(-1)` 返回 `NAN`，用 `is_nan()` 检测。不要直接对结果做 `==` 比较。

### 4.4 `max()` / `min()`

```php
var_dump(max(3, 7, 2));        // int(7)
var_dump(max([3, 7, 2]));      // int(7)    可传数组
var_dump(max("10", "9"));      // string("9")  ⚠️ 字符串按字符串比较，不是数字
var_dump(max(10, "9"));        // int(10)      类型混合时按数字比较
```

> ⚠️ **字符串比较陷阱**：`max("10", "9")` 返回 `"9"`，因为两个都是字符串时按**字典序**比较，`"9" > "10"`。需要数字比较时先转类型或显式传数字。

### 4.5 对数与指数

```php
var_dump(exp(1));        // float(2.7182818284590)   e^1
var_dump(log(M_E));      // float(1)                 自然对数
var_dump(log(100, 10));  // float(2)                 以 10 为底
var_dump(log10(100));    // float(2)
var_dump(log(0));        // float(-INF)
var_dump(log(-1));       // float(NAN)
```

---

## 五、随机数：安全等级决定函数选择

### 5.1 三个层次的随机数

| 函数 | 算法 | 安全性 | 用途 |
|------|------|--------|------|
| `rand()` | 旧 libc 随机数 | ❌ 不安全 | 仅遗留代码，**新代码不用** |
| `mt_rand()` | Mersenne Twister | ❌ 非加密安全 | 展示、游戏、普通随机抽样[reference:13] |
| `random_int()` | CSPRNG | ✅ 加密安全 | 令牌、验证码、密码重置、抽奖[reference:14] |
| `random_bytes()` | CSPRNG | ✅ 加密安全 | 原始随机字节，配合 `bin2hex()` 使用 |

> `mt_rand()` 虽然比 `rand()` 快且随机性更好，但**可预测**，绝不能用于安全敏感场景[reference:15]。

### 5.2 用法

```php
// 非安全场景
mt_rand(1, 100);
random_int(1, 100);          // 也可以用于非安全场景，只是慢一些

// 安全场景
$token = bin2hex(random_bytes(32));   // 64 位十六进制字符串
$otp   = random_int(100000, 999999);
```

### 5.3 `rand()` 与 `mt_rand()` 的关系

**PHP 7.1+ 起，`rand()` 是 `mt_rand()` 的别名**，两者行为几乎一致。但为了表达意图，**普通随机用 `mt_rand()`，安全随机用 `random_int()`**。

### 5.4 随机数陷阱

```php
// ❌ 不要用 mt_rand() 做安全令牌
$token = mt_rand();                          // 可预测

// ❌ 不要用时间戳+mt_rand 拼"随机"令牌
$token = md5(microtime(true) . mt_rand());   // 仍不安全

// ✅ 正确
$token = bin2hex(random_bytes(32));
$otp   = random_int(100000, 999999);
```

---

## 六、进制转换

### 6.1 专用函数对

| 函数 | 方向 | 示例 |
|------|------|------|
| `bindec($s)` | 二进制 → 十进制 | `bindec("1101")` → `13` |
| `decbin($n)` | 十进制 → 二进制 | `decbin(13)` → `"1101"` |
| `hexdec($s)` | 十六进制 → 十进制 | `hexdec("ff")` → `255` |
| `dechex($n)` | 十进制 → 十六进制 | `dechex(255)` → `"ff"` |
| `octdec($s)` | 八进制 → 十进制 | `octdec("17")` → `15` |
| `decoct($n)` | 十进制 → 八进制 | `decoct(15)` → `"17"` |

```php
var_dump(bindec("1101"));   // int(13)
var_dump(decbin(13));       // string(4) "1101"
var_dump(hexdec("ff"));     // int(255)
var_dump(dechex(255));      // string(2) "ff"
var_dump(octdec("17"));     // int(15)
var_dump(decoct(15));       // string(2) "17"
```

> `*dec()` 系列**忽略非法字符**：`hexdec("ffzz")` 仍返回 `255`，不会报错。需要严格校验时先自行验证字符串。

### 6.2 `base_convert()` — 任意进制互转

```php
base_convert(string $number, int $from_base, int $to_base): string
```

```php
var_dump(base_convert("ff", 16, 2));   // string(8) "11111111"
var_dump(base_convert("1101", 2, 16)); // string(1) "d"
var_dump(base_convert("1010", 2, 10)); // string(2) "10"
```

> ⚠️ `base_convert()` 在内部使用 **float** 处理，**超过 2^53 的大数会丢精度**。大数进制转换应使用 `bcmath` 或 `gmp`。

### 6.3 大写十六进制

```php
dechex(255);            // "ff"
strtoupper(dechex(255)); // "FF"
sprintf('%X', 255);      // "FF"   也可用 sprintf
sprintf('%x', 255);      // "ff"
```

---

## 七、格式化输出（与数学计算的区别）

### 7.1 `number_format()` — 千分位与小数格式化

```php
number_format(float $num, int $decimals = 0, string $decimal_separator = '.', string $thousands_separator = ','): string
```

```php
var_dump(number_format(1234567.891, 2));                    // "1,234,567.89"
var_dump(number_format(1234567.891, 2, ',', ' '));          // "1 234 567,89"
var_dump(number_format(0.615, 2));                          // "0.62"   四舍五入
var_dump(number_format(1234.5678, 2, '.', ''));             // "1234.57" 不要千分位
```

> `number_format()` **返回字符串**，不是数字。它用于**展示**，不能替代数学计算中的精度处理。不要指望 `number_format()` “修复”浮点误差，它只是格式化字符串[reference:16]。

### 7.2 `sprintf('%.2f')` 与 `number_format()` 的区别

```php
sprintf('%.2f', 0.615);          // "0.62"    四舍五入，无千分位
number_format(0.615, 2);         // "0.62"    四舍五入，有千分位（默认逗号）
```

两者都做四舍五入，但 `number_format()` 默认加千分位。需要**纯数字字符串**（如写入 CSV、API）时用 `number_format($n, 2, '.', '')` 或 `sprintf`。

---

## 八、浮点精度：数学函数的核心陷阱

### 8.1 浮点永远不要用 `==` / `===` 直接比较

PHP 浮点是 IEEE 754 双精度，`0.1 + 0.2` **不等于** `0.3`[reference:17]：

```php
var_dump(0.1 + 0.2);          // float(0.30000000000000004)
var_dump(0.1 + 0.2 == 0.3);   // bool(false)
var_dump(0.1 + 0.2 === 0.3);  // bool(false)
```

**正确比较方式**——epsilon 容差：

```php
$epsilon = PHP_FLOAT_EPSILON;   // 约 2.22e-16
var_dump(abs((0.1 + 0.2) - 0.3) < $epsilon);  // bool(true)
```

如果数值量级较大，用**相对容差**更稳健：

```php
function floatEquals(float $a, float $b, float $relEps = 1e-9): bool {
    $diff = abs($a - $b);
    $scale = max(abs($a), abs($b), 1.0);
    return $diff < $relEps * $scale;
}
```

> PHP 手册明确指出：**永远不要相信浮点数结果精确到了最后一位，也永远不要比较两个浮点数是否相等**[reference:18]。

### 8.2 `round()` 的精度陷阱

```php
var_dump(round(0.615, 2));   // 可能是 0.61，也可能是 0.62（取决于浮点表示）
```

因为 `0.615` 在二进制中不是精确值。需要**严格十进制舍入**时：

```php
// 方案 1：number_format（输出字符串）
var_dump(number_format(0.615, 2, '.', ''));   // "0.62"

// 方案 2：BCMath（精确十进制运算）
var_dump(bcadd('0.615', '0', 2));              // "0.62"

// 方案 3：加极小 epsilon 再 round
var_dump(round(0.615 + 1e-9, 2));              // float(0.62)
```

方案 3 只是缓解，**不是根本解决**。

### 8.3 金额：永远不要用 float 存储和计算

浮点舍入误差在金额场景会造成**账目不一致**，且可能被利用[reference:19]。

```php
// ❌ 错误：用 float 算金额
$price = 19.99;
$total = $price * 3;         // 59.970000000000006
if ($total == 59.97) { ... } // false

// ✅ 方案 1：整数分
$priceCents = 1999;
$totalCents = $priceCents * 3;   // 5997
$totalYuan  = $totalCents / 100; // 59.97（仅展示时转 float）

// ✅ 方案 2：BCMath（操作数必须是字符串）
bcadd('19.99', '19.99', 2);      // "39.98"
bcmul('19.99', '3', 2);          // "59.97"
```

> `number_format()` / `round()` **只改变字符串或返回值，不修复底层数值**。金额精度必须在**存储层和运算层**用整数分或 BCMath 解决[reference:20]。

### 8.4 `NAN` 的特殊行为

```php
$nan = sqrt(-1);          // NAN
var_dump($nan == $nan);   // bool(false)   NAN 不等于自身
var_dump(is_nan($nan));   // bool(true)    必须用 is_nan() 检测
var_dump($nan < 1);       // bool(false)
var_dump($nan > 1);       // bool(false)
```

任何与 `NAN` 的比较（除 `is_nan()` 外）都不可靠。

### 8.5 整数溢出

PHP 整数溢出时**静默转为 float**，不会像 C 那样回绕[reference:21]：

```php
var_dump(PHP_INT_MAX);          // int(9223372036854775807)
var_dump(PHP_INT_MAX + 1);      // float(9.2233720368548E+18)  丢精度
```

大整数运算使用 `bcadd()` / `gmp_add()`，不要在溢出边缘依赖 `int`。

---

## 九、数学函数陷阱清单

| # | 陷阱 | 正确做法 |
|---|------|----------|
| 1 | `round()` 因浮点表示得到“错误”舍入 | 严格十进制舍入用 `number_format()` / BCMath |
| 2 | `ceil(-3.1)` 得 `-3` 不是 `-4` | 理解“向上”是数值增大方向 |
| 3 | `(int)-3.7` 得 `-3`，`floor(-3.7)` 得 `-4` | 截断 ≠ floor |
| 4 | `10 / 2` 返回 `float(5)` | 需要 int 用 `intdiv()` |
| 5 | `intdiv(1, 0)` 抛 `DivisionByZeroError` | 调用前检查除数 |
| 6 | `intdiv(PHP_INT_MIN, -1)` 抛 `ArithmeticError` | 边界情况特殊处理 |
| 7 | `10.9 % 3` 得 `1`，不是 `1.9` | 浮点取余用 `fmod()` |
| 8 | `%` 对负数结果符号跟随被除数 | 需要欧几里得取模自行调整 |
| 9 | `max("10", "9")` 返回 `"9"` | 数字比较先转类型 |
| 10 | `sqrt(-1)` 返回 `NAN`，不报错 | 用 `is_nan()` 检测 |
| 11 | `NAN == NAN` 为 `false` | 用 `is_nan()` |
| 12 | `mt_rand()` 用于令牌 | 安全场景用 `random_int()` / `random_bytes()` |
| 13 | `base_convert()` 大数丢精度 | 大数用 `bcmath` / `gmp` |
| 14 | `number_format()` 当成数值修复工具 | 它只返回字符串，不修复精度 |
| 15 | 金额用 `float` 存储和计算 | 整数分或 BCMath |

---

## 十、最佳实践清单

1. **取整按语义选函数**：截断 `(int)`，四舍五入 `round()`，向上 `ceil()`，向下 `floor()`；不要混用。
2. **整数除法用 `intdiv()`**，并**先检查除数为 0**；`/` 永远返回 float。
3. **浮点余数用 `fmod()`**，整数余数用 `%`；两者行为不同，不要互换。
4. **浮点永远不用 `==` / `===` 比较**，用 `abs($a - $b) < $epsilon` 或 `floatEquals()`。
5. **金额不用 float**：存储用整数分（`int`），运算用 BCMath（字符串），展示时才格式化。
6. **随机数按安全等级选**：普通用 `mt_rand()`，安全用 `random_int()` / `random_bytes()`；`rand()` 新代码不用。
7. **`round()` 不保证十进制精确**，需要严格舍入用 `number_format()` 或 BCMath。
8. **`NAN` 用 `is_nan()` 检测**，不要用比较运算符。
9. **大整数溢出会静默变 float**，大数运算用 BCMath / GMP。
10. **`number_format()` / `sprintf()` 是格式化工具**，不是精度修复工具。

---

## 十一、一句话总结

- **取整**：`(int)` 截断、`round()` 舍入、`ceil()` 向上、`floor()` 向下，负数方向别靠语感
- **除法**：`/` 永远 float，`intdiv()` 才是 int，除零抛 `DivisionByZeroError`
- **取余**：`%` 先转 int，`fmod()` 保留浮点；浮点余数只用 `fmod()`
- **随机数**：`mt_rand()` 快但不安全，`random_int()` / `random_bytes()` 才安全
- **浮点精度**：永远不用 `==` 比浮点，永远不用 float 存金额
- **格式化**：`number_format()` 只改字符串，不修复数值
- **大数**：溢出静默变 float，进制转换大数丢精度，用 BCMath / GMP
