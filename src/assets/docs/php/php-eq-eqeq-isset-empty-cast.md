---
title: PHP 中 `==` / `===` / `empty()` / `isset()` 及类型转换比较 使用文档
navTitle: ==、=== 以及类型转换比较
category: PHP
order: 9
slug: php-eq-eqeq-isset-empty-cast
description: PHP 中 `==` / `===` / `empty()` / `isset()` 及类型转换比较 使用文档
---

# PHP 中 `==` / `===` / `empty()` / `isset()` 及类型转换比较 使用文档

---

## 一、`==` 与 `===`

### 1.1 基本区别

| 运算符 | 名称 | 行为 |
|--------|------|------|
| `==` | 松散比较（相等） | **先做类型转换（类型杂耍），再比较值** |
| `===` | 严格比较（全等） | **类型和值必须都相同**，不做任何转换 |
| `!=` | 不等 | `==` 的取反 |
| `!==` | 不全等 | `===` 的取反 |

```php
var_dump(1 == "1");      // bool(true)   字符串 "1" 转成数字 1
var_dump(1 === "1");     // bool(false)  类型不同
var_dump(1.0 === 1);     // bool(false)  float vs int
var_dump(1.0 == 1);      // bool(true)
var_dump(null == false); // bool(true)
var_dump(null === false);// bool(false)
var_dump(0 == "");       // bool(true)   （PHP 8 之前）
var_dump(0 === "");      // bool(false)
```

---

### 1.2 `==` 的类型转换规则（重点）

1. **bool / null 参与** → 两边都转成 bool 比较

   ```php
   var_dump(0 == false);        // true
   var_dump("" == false);       // true
   var_dump("0" == false);      // true
   var_dump([] == false);       // true
   var_dump(null == false);     // true
   var_dump("a" == true);       // true
   ```

2. **数字 vs 数字字符串**（PHP 8+）→ 字符串若为数字字符串，则转为数字比较；否则数字转为字符串比较

   ```php
   // PHP 8.0+
   var_dump(0 == "a");          // false  （"a" 非数字字符串，转成 "0" == "a"）
   var_dump("1" == "01");       // true   （都是数字字符串）
   var_dump("10" == "1e1");     // true
   var_dump(100 == "1e2");      // true
   ```

   > ⚠️ **PHP 8.0 的重大变化**：`0 == "a"` 在 PHP 7 中是 `true`，PHP 8 起是 `false`。

3. **数组之间**：键值对需完全一致（顺序无关），但不要求类型严格

   ```php
   var_dump([1,2,3] == ["1","2","3"]); // true
   var_dump([1,2,3] === ["1","2","3"]);// false
   ```

4. **对象之间**：
  - `==`：同类且属性值相等即为 true
  - `===`：必须是**同一个实例**（同一引用）

   ```php
   class A { public $x = 1; }
   $a = new A; $b = new A;
   var_dump($a == $b);   // true
   var_dump($a === $b);  // false
   var_dump($a === $a);  // true
   ```

---

### 1.3 常见陷阱

```php
var_dump("abc" == 0);             // PHP 7: true   PHP 8: false
var_dump(in_array(0, ["a","b"])); // PHP 7: true（第三参数未设 true）
var_dump("0e123" == "0e456");     // true ← 都被当成 0（md5 绕过）
var_dump("" == 0);                // PHP 7: true   PHP 8: false
```

**建议**：除非有意做类型转换，否则**一律用 `===` / `!==`**。`in_array()`、`array_search()` 记得传第三个参数 `true`。

---

## 二、`isset()`

### 2.1 定义

```php
isset(mixed $var, mixed ...$vars): bool
```

判断变量**是否已声明且值不为 `null`**。

- 变量不存在 → `false`，**不报错、不产生 Notice**
- 变量存在但值为 `null` → `false`
- 变量存在且值不为 `null`（包括 `0`、`""`、`false`、`[]`）→ `true`

```php
$var = null;
var_dump(isset($var));       // false
var_dump(isset($undefined)); // false，且无 Notice


$a = 0;   var_dump(isset($a)); // true
$b = "";  var_dump(isset($b)); // true
$c = [];  var_dump(isset($c)); // true
```

### 2.2 多参数用法

全部为 true 才返回 true（相当于 `&&`）：

```php
var_dump(isset($a, $b, $c)); // 三者都存在且非 null 才为 true
```

### 2.3 支持的场景

```php
// 数组元素
$arr = ['k' => null, 'v' => 1];
isset($arr['k']);          // false
isset($arr['v']);          // true
isset($arr['missing']);    // false，无 Notice

// 1. isset：检查键存在 且 值不为 null
var_dump(isset($arr['k']));            // 输出: bool(false)

// 2. array_key_exists：只检查“键”是否存在，不管值是什么
var_dump(array_key_exists('k', $arr)); // 输出: bool(true)

// 对象属性
class T { public $p = 1; public $n = null; }
$t = new T;
isset($t->p);              // true
isset($t->n);              // false
isset($t->missing);        // false，无 Notice

// 字符串偏移
$s = "abc";
isset($s[0]);              // true
isset($s[10]);             // false
```

### 2.4 限制

- **不能用于表达式结果**（语法错误）：

  ```php
  isset(foo());              // ❌ Parse error
  isset($a + 1);             // ❌ Parse error
  isset($arr['k']['kk']);    // ✅ 可以链式判断
  ```

- 对魔术属性，`isset($obj->prop)` 会调用 `__isset()`。

---

## 三、`empty()`

### 3.1 定义

```php
empty(mixed $var): bool
```

判断变量**是否为空**。语义等价于 `!isset($var) || $var == false`（但规则是固定的）。

**以下值都会让 `empty()` 返回 `true`**：

| 值 | empty() |
|----|---------|
| `""`（空字符串） | true |
| `0`（整数 0） | true |
| `0.0`（浮点 0） | true |
| `"0"`（字符串零） | true |
| `null` | true |
| `false` | true |
| `[]`（空数组） | true |
| 未定义变量 | true（无 Notice） |
| 未初始化属性 | true |
| `"0.0"`、`" "`、`"false"`、`"a"` | false |
| 非零数字 | false |
| 非空数组 / 对象 | false |

```php
var_dump(empty("0"));     // true  ← 最容易踩的坑！
var_dump(empty(0));       // true
var_dump(empty("0.0"));   // false
var_dump(empty(" "));     // false
var_dump(empty([]));      // true
var_dump(empty(new stdClass)); // false
var_dump(empty($undefined));   // true，无 Notice
```

> ⚠️ **大坑**：`empty("0")` 为 `true`。判断用户输入是否为空时，用户输入 `"0"` 会被误判为空。

### 3.2 限制

与 `isset()` 一样，**不能用于表达式结果**：

```php
empty(foo());        // ❌ Parse error
empty($a + $b);      // ❌ Parse error
empty($arr['k']);    // ✅
```

---

## 四、四者对比速查

假设变量 `$v` 存在，分别取不同值时的结果：

| 值 | `isset($v)` | `empty($v)` | `$v == false` | `$v === false` |
|----|:---:|:---:|:---:|:---:|
| `null` | ❌ false | ✅ true | ✅ true | ❌ false |
| `false` | ✅ true | ✅ true | ✅ true | ✅ true |
| `true` | ✅ true | ❌ false | ❌ false | ❌ false |
| `0` | ✅ true | ✅ true | ✅ true | ❌ false |
| `0.0` | ✅ true | ✅ true | ✅ true | ❌ false |
| `"0"` | ✅ true | ✅ true | ✅ true | ❌ false |
| `""` | ✅ true | ✅ true | ✅ true | ❌ false |
| `" "` | ✅ true | ❌ false | ❌ false | ❌ false |
| `[]` | ✅ true | ✅ true | ✅ true | ❌ false |
| `[0]` | ✅ true | ❌ false | ❌ false | ❌ false |
| `"a"` | ✅ true | ❌ false | ❌ false | ❌ false |
| 未定义 | ❌ false | ✅ true | ⚠️ true+Notice | ⚠️ false+Notice |

> 未定义变量在 `$v == false` 中会触发 Notice（PHP 8 是 Warning），而 `isset` / `empty` **不会报错**，这是它们不可替代的价值。

---

## 五、最佳实践建议

### 5.1 判断变量是否定义

```php
if (isset($_GET['id'])) { ... }      // ✅ 不报错
$id = $_GET['id'] ?? null;           // ✅ PHP 7+ null 合并
$id = $_GET['id'] ?? 0;
```

### 5.2 判断"有值"（允许 0、false、"" 等合法值）

```php
if (!empty($input)) { ... }                    // ❌ 0、""、false 会被误判
if ($input !== null && $input !== '') { ... }  // ✅ 明确意图
if (isset($input)) { ... }                     // 若允许 '' 也算有值
```

### 5.3 比较值

```php
if ($status === 1) { ... }                          // ✅ 默认严格
if (in_array($needle, $haystack, true)) { ... }     // ✅ 第三参数
```

### 5.4 `empty("0")` 陷阱的规避

```php
if ($value === '' || $value === null) { /* 真空 */ }
if ($value === '0') { /* 用户明确填了 0 */ }
if (strlen((string)$value) === 0) { ... }
```

### 5.5 数组成员检查

```php
$arr = ['a' => null];
isset($arr['a']);            // false
array_key_exists('a', $arr); // true  ← 键存在但值为 null 时用这个
```

### 5.6 对象属性

```php
if (isset($obj->prop)) { ... }          // 存在且非 null
if (property_exists($obj, 'prop')) { }  // 属性是否声明（含 null）
```

---

## 六、PHP 版本变更提醒

| 版本 | 变更 |
|------|------|
| **PHP 8.0** | 数字与数字字符串比较规则改变：`0 == "a"`、`"" == 0` 由 `true` 变 `false` |
| **PHP 7.0+** | 引入 `??`（null 合并运算符） |
| **PHP 7.4+** | 引入 `??=`（null 合并赋值） |
| **PHP 8.0** | 引入 `?->`（nullsafe 运算符） |
| **PHP 8.0** | 非数字字符串参与算术运算（如 `"abc" + 1`）抛 `TypeError` |

```php
$name = $_POST['name'] ?? '匿名';   // 等价于 isset($_POST['name']) ? ... : '匿名'
$len  = $obj?->getName()?->length ?? 0;
```

---

## 七、类型转换与转换后的比较

### 7.1 转换方式一览

| 目标类型 | 强制转换 | 函数 | 修改原变量 | 等价性 |
|----------|----------|------|:---:|--------|
| int | `(int)$a`、`(integer)$a` | `intval($a, $base = 10)` | ❌ | `(int)` 与 `intval()` **完全等价**（同一实现） |
| float | `(float)$a`、`(double)$a`、`(real)$a` | `floatval($a)` / `doubleval($a)` | ❌ | 三者等价 |
| string | `(string)$a` | `strval($a)` | ❌ | 等价 |
| bool | `(bool)$a`、`(boolean)$a` | `boolval($a)` | ❌ | 等价 |
| array | `(array)$a` | — | ❌ | — |
| object | `(object)$a` | — | ❌ | — |
| 任意 | `settype($a, "int")` | `settype()` | ✅ **会修改**，返回 bool | — |

> ⚠️ 与 `isset()` / `empty()` 不同，**转换会先对变量求值**：`(int)$undefined`、`intval($undefined)` 都会触发 `Warning: Undefined variable`，而 `isset()` / `empty()` 不会。转换函数内部对无法转换的值不报错，但变量本身未定义仍会警告。

---

### 7.2 转 int（`(int)` / `intval`）

| 原值 | 结果 | 说明 |
|------|------|------|
| `null` | `0` | |
| `true` / `false` | `1` / `0` | |
| `3.9` | `3` | **向零截断**（不是四舍五入） |
| `-3.9` | `-3` | 向零截断（不是 `floor`） |
| `NAN` / `INF` | 未定义 | ⚠️ 不要依赖 |
| 超出 int 范围的 float（如 `1e20`） | 未定义 | ⚠️ 不要依赖 |
| `"123"` | `123` | |
| `" 123"` | `123` | 允许前导空白 |
| `"123abc"` | `123` | 只解析前导数字，不报错 |
| `"abc"` | `0` | |
| `"1.9"` | `1` | 遇到 `.` 停止 |
| `"1e3"` | `1` | 遇到 `e` 停止 ⚠️ 与 `(float)"1e3"` = `1000.0` 不同 |
| `"0x1A"` | `0` | 默认不识别十六进制 |
| `"0123"` | `123` | 默认 base=10；`intval("0123", 0)` 才按八进制得 `83` |
| `""` | `0` | |
| `[]` | `0` | 空数组 |
| `[1]` / `[1,2]` | `1` | 非空数组一律为 1 |
| 资源 | 资源 ID | |

```php
var_dump((int)"1.9");          // int(1)
var_dump((int)"1e3");          // int(1)     ← 注意
var_dump((float)"1e3");        // float(1000)
var_dump(intval("1e3"));       // int(1)     ← intval 与 (int) 一致
var_dump(intval("9999999999999999999")); // 溢出，通常得到 PHP_INT_MAX
```

**`intval($a, $base)` 的 base 参数**（仅对字符串有效）：

```php
intval("0x1A");        // 0      base=10，遇 x 停止
intval("0x1A", 16);    // 26
intval("0x1A", 0);     // 26     base=0：自动识别 0x / 0b / 0 前缀
intval("0123", 0);     // 83     前导 0 → 八进制
intval("0123", 10);    // 123
intval("101", 2);      // 5
```

> 日常把用户输入转整数用 `intval($v)` 或 `(int)$v` 即可；**校验**请用 `filter_var($v, FILTER_VALIDATE_INT)`。

---

### 7.3 转 float（`(float)` / `floatval`）

| 原值 | 结果 | 说明 |
|------|------|------|
| `null` | `0.0` | |
| `true` / `false` | `1.0` / `0.0` | |
| `"1.5"` | `1.5` | |
| `"1.5abc"` | `1.5` | 解析前导数字 |
| `"1e3"` | `1000.0` | ✅ 科学计数法**有效**（与 int 不同） |
| `" 1.5"` | `1.5` | 前导空白允许 |
| `"abc"` | `0.0` | |
| `".5"` | `0.5` | |
| `"1,000"` | `1.0` | 遇 `,` 停止 |
| `[]` / `[1]` | `0.0` / `1.0` | |
| 超大整数 | **可能丢精度** | 超过 2^53 后不精确 |

```php
var_dump(floatval("1e3"));        // float(1000)
var_dump((float)"1.5abc");        // float(1.5)
var_dump((float)"abc");           // float(0)
var_dump((float)PHP_INT_MAX);     // 9.2233720368548E+18（丢精度）
```

---

### 7.4 转 string（`(string)` / `strval`）

| 原值 | 结果 | 说明 |
|------|------|------|
| `null` | `""` | 空字符串 |
| `true` / `false` | `"1"` / `""` | ⚠️ false 变空串 |
| `0` / `-1` | `"0"` / `"-1"` | |
| `1.0` | `"1"` | 整数值浮点不带 `.0` |
| `1.5` | `"1.5"` | |
| `1e20` | `"1.0E+20"` | 大数用科学计数法 |
| `0.1 + 0.2` | `"0.3"` | 受 `precision` ini 影响（默认 14） |
| `[]` | `"Array"` + **Warning** | Array to string conversion |
| `[1]` | `"Array"` + **Warning** | 同上 |
| 对象（有 `__toString`） | 返回值 | |
| 对象（无 `__toString`） | **抛 `Error`** | PHP 7.4+ |
| 资源 | `"Resource id #5"` | |

```php
var_dump((string)true);       // "1"
var_dump((string)false);      // ""
var_dump((string)1.0);        // "1"
var_dump((string)(0.1+0.2));  // "0.3"  ← 看起来相等，见 7.8
var_dump((string)1e20);       // "1.0E+20"
```

---

### 7.5 转 bool（`(bool)` / `boolval`）

| 值 | 结果 |
|----|:---:|
| `false`、`0`、`0.0`、`""`、`"0"`、`[]`、`null`、未初始化变量 | **`false`** |
| `true`、非零数字（含 `-1`、`0.1`）、非空字符串（含 `"0.0"`、`" "`、`"false"`）、非空数组、对象、资源 | **`true`** |

```php
var_dump((bool)"0");      // false
var_dump((bool)"0.0");    // true   ← 注意
var_dump((bool)" ");      // true
var_dump((bool)"false");  // true
var_dump(boolval([]));    // false
var_dump(boolval([0]));   // true
```

---

### 7.6 转 array / object（简述）

```php
var_dump((array)"abc");   // ["abc"]       标量变成单元素数组
var_dump((array)null);    // []             null → 空数组
var_dump((array)1);       // [1]
var_dump((object)[]);     // stdClass 空对象
var_dump((object)[1,2]);  // stdClass { 0: 1, 1: 2 }
```

---

### 7.7 转换后比较：核心对照

同一个值 `$a = "10"`，不同比较方式的结果：

```php
var_dump($a == 10);          // true    松散比较自动转换
var_dump($a === 10);         // false   类型不同
var_dump((int)$a === 10);    // true    显式转换后严格比较
var_dump(intval($a) === 10); // true    与 (int) 完全一致
var_dump((string)10 === $a); // true    "10" === "10"
```

不同原始值的转换结果对照表（`===` 比较）：

| `$a` | `(int)$a === 1` | `(float)$a === 1.0` | `(string)$a === "1"` | `(bool)$a === true` |
|------|:---:|:---:|:---:|:---:|
| `"1"` | ✅ | ✅ | ✅ | ✅ |
| `1` | ✅ | ✅ | ✅ | ✅ |
| `1.0` | ✅ | ✅ | ✅ | ✅ |
| `"1.0"` | ✅（截断为 1） | ✅ | ❌（得 `"1.0"`） | ✅ |
| `true` | ✅ | ✅ | ✅ | ✅ |
| `"01"` | ✅ | ✅ | ❌（得 `"01"`） | ✅ |
| `"1abc"` | ✅（前导解析） | ✅ | ❌（保留原串） | ✅ |
| `"abc"` | ❌（0） | ❌（0.0） | ❌ | ✅ |
| `null` | ❌（0） | ❌（0.0） | ❌（`""`） | ❌ |
| `[]` | ❌（0） | ❌（0.0） | ❌（`"Array"`） | ❌ |

> 表的重点：**"转换后是否相等"取决于目标类型**。`"1.0"` 转 int 得 1，但直接 `(string)"1.0"` 仍是 `"1.0"`。别把 `(int)` 和 `(string)` 的结果混着比。

---

### 7.8 转换相关的经典陷阱

**① 截断 ≠ 四舍五入**

```php
var_dump((int)3.99);            // 3     向零截断
var_dump((int)-3.99);           // -3
var_dump(round(3.99));          // 4.0   要四舍五入用 round
var_dump(floor(-3.1));          // -4.0
```

**② `(int)"1e3"` 与 `(float)"1e3"` 不一致**

```php
var_dump((int)"1e3");    // 1        int 遇 e 停止
var_dump((float)"1e3");  // 1000.0   float 支持科学计数法
var_dump("1e3" == 1000); // true     比较时按数字字符串整体转 float
```

同一字符串在"比较"和"显式转 int"两种语境下含义不同，这是最隐蔽的坑之一。

**③ 浮点永远不要用 `==` / `===` 直接比**

```php
var_dump(0.1 + 0.2 == 0.3);    // false
var_dump(0.1 + 0.2 === 0.3);   // false
var_dump(abs((0.1+0.2) - 0.3) < PHP_FLOAT_EPSILON); // true  推荐

// 更危险：转 string 看起来相等
var_dump((string)(0.1+0.2));   // "0.3"      ← 因 precision=14 被截断显示
var_dump((float)(string)(0.1+0.2) === 0.3); // false  并没有真正修复
```

金额计算请用**整数分**（`intval(round($yuan * 100))`）或 `bcmath` / `gmp`。

**④ int 溢出**

```php
var_dump(intval("9999999999999999999")); // 通常 PHP_INT_MAX，不要依赖
var_dump((int)1e20);                     // 未定义（可能是 0 或极值）
// 大数用 (string) 处理，或 bcadd / gmp
```

**⑤ 数组转 string / int**

```php
echo (string)[1,2];   // "Array" + Warning
var_dump((int)[]);    // 0
var_dump((int)[0]);   // 1   非空即 1，不是元素值
```

**⑥ 对象转 int 不可靠**

```php
var_dump((int)new stdClass); // Warning + 1，不要这么做
```

**⑦ 未定义变量转换会警告**

```php
$v = (int)$undefined;   // Warning: Undefined variable，$v = 0
$v = intval($undefined);// 同样 Warning
isset($undefined);      // ✅ 不警告
```

**⑧ `filter_var` 校验与 `(int)` 转换的差异**

```php
(int)"12abc";                              // 12    静默截断
filter_var("12abc", FILTER_VALIDATE_INT);  // false 严格校验，推荐用于输入校验
filter_var("12", FILTER_VALIDATE_INT);     // 12
filter_var("012", FILTER_VALIDATE_INT);    // false（除非 FILTER_FLAG_ALLOW_OCTAL）
```

注意 `filter_var` 失败返回 `false`，而合法的 `0` 也转成 `0`，比较时必须用 `=== false`。

**⑨ 浮点转 string 受 `precision` 影响**

```php
ini_set('precision', '17');
var_dump((string)0.1);   // "0.10000000000000001"
ini_set('precision', '14'); // 默认
var_dump((string)0.1);   // "0.1"
```

不要用"转成字符串再比"来判断浮点相等。

---

### 7.9 `is_numeric` 与数字字符串

转换前先判断是否像数字：

```php
is_numeric("1");       // true
is_numeric("1.5");     // true
is_numeric("1e3");     // true
is_numeric(" 1 ");     // true（PHP 8 允许前后空白，PHP 7 只允许前导）
is_numeric("");        // false
is_numeric("0x1A");    // false
is_numeric("1,000");   // false
is_numeric("12abc");   // false  ← 但 (int)"12abc" = 12
```

> `is_numeric` 为 false 并不妨碍 `(int)` 截断出数字；需要"要么全合法要么失败"时用 `filter_var`。

---

### 7.10 类型转换的实践建议

1. **转换后一定用 `===` 比较**：`(int)$a === 10`，别写 `(int)$a == 10`。
2. **`intval()` 与 `(int)` 等价**，选一个团队统一即可；`intval($s, $base)` 只用于进制解析。
3. **用户输入校验用 `filter_var`**，不要用 `intval` 当校验器。
4. **金额/精确小数用整数分或 `bcmath`**，不要 `(float)` 后比较。
5. **浮点相等用 epsilon 或 `round` 后比整数**。
6. **判空用 `isset()` / `=== null` / `=== ''`**，不要用 `(bool)` / `empty()` 代替业务语义。
7. **字符串转 int 前先想清楚 `"1e3"`、`"1.9"`、`"12abc"` 的期望行为**，需要严格就用 `filter_var`。
8. **大数不要转 float/int**，保持字符串用 `bcmath` / `gmp`。

---

## 八、四者 + 转换 一句话总结

- **`==`**：宽松，可能悄悄类型转换 → 容易出 bug
- **`===`**：严格，类型值都相同 → **日常首选**
- **`isset()`**：判断"已定义且非 null"，不报错
- **`empty()`**：判断"假值或未定义"，不报错，但 **`"0"` 算空**，需警惕
- **`(int)` / `intval()`**：向零截断，`"1e3"` 得 1，溢出未定义
- **`(float)` / `floatval()`**：`"1e3"` 得 1000.0，浮点**永不**用 `==` 比
- **`(string)`**：`false`→`""`、`null`→`""`、数组→`"Array"`+Warning
- **`(bool)`**：`"0"` 为 false，但 `"0.0"` / `" "` / `"false"` 为 true
- 需要区分"未定义 / null / 空字符串 / 0 / 非法输入"时，**不要用 `empty()` 或裸转换**，用 `isset()` + `filter_var` + 严格比较明确表达意图
