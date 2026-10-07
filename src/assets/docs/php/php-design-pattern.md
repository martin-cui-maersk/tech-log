---
title: PHP 项目常用设计模式实战与反例
navTitle: 设计模式实战
category: PHP
order: 7
slug: php-design-pattern
description: 单例/工厂/策略/观察者/责任链等在 PHP 里的真实用法、判断标准与过度设计的反例
---
# PHP 项目常用设计模式实战与反例

> **适用场景**：一段 `if/else` 越写越长、加一个支付渠道要改十几个文件、单元测试没法写、接手老项目看不懂调用链。
> **一句话原则**：设计模式是**应对变化**的手段，不是目标。判断标准永远是"这里未来会不会变、变的时候要改几处"，而不是"这里能不能套个模式"。

## 目录

- [1. 先想清楚：到底需不需要模式](#1-先想清楚到底需不需要模式)
- [2. 创建型模式](#2-创建型模式)
- [3. 结构型模式](#3-结构型模式)
- [4. 行为型模式](#4-行为型模式)
- [5. 框架里已经在用的模式](#5-框架里已经在用的模式)
- [6. 过度设计与反模式](#6-过度设计与反模式)
- [7. 决策速查表](#7-决策速查表)

---

## 1. 先想清楚：到底需不需要模式

### 1.1 三个判断问题

1. **变化点在哪？** 是"新增一种实现"（支付渠道、导出格式），还是"新增一个步骤"（流程），还是"新增一个组合"（功能叠加）？
2. **现在有几份实现？** 只有一份、而且看不到第二份 → 先写直白代码。**Rule of Three**：出现第三次重复再抽象。
3. **改动会波及几处？** 加一个渠道要改 10 个文件 → 值得引入工厂/策略；只改 1 处配置 → 不值得。

### 1.2 不用模式的直白写法（先这样写）

```php
<?php
declare(strict_types=1);

final class ShippingCalculator
{
    public function calculate(string $type, int $weight): int
    {
        if ($type === 'sf') {
            return 1500 + $weight * 200;
        }
        if ($type === 'jd') {
            return 1200 + $weight * 250;
        }
        throw new InvalidArgumentException("未知快递: {$type}");
    }
}
```

两个渠道、公式简单、几乎不会变 —— **这个写法就是对的**，别急着上策略模式。等到第四五个渠道、每个渠道还有各自的下单/取消/查件逻辑时，再重构（见 4.1）。

---

## 2. 创建型模式

### 2.1 单例：用它的场景比你想的少

```php
<?php
declare(strict_types=1);

final class Config
{
    private static ?self $instance = null;
    private array $items = [];

    private function __construct() {}
    private function __clone() {}

    public static function getInstance(): self
    {
        return self::$instance ??= new self();
    }
}
```

**什么时候可以接受**：真正的进程级唯一资源（配置、只读字典、连接管理器），且框架没有依赖注入容器。

**反例**（单例的三大罪）：

- 变成全局变量的马甲：`Config::getInstance()->set('x', 1)` 散落各处，谁改的都不知道；
- 无法替换实现 → 单元测试里没法注入假对象；
- 常驻进程（Swoole/Hyperf）里存请求数据 → **内存泄漏 + 请求间数据串味**。

```php
// ✗ 常驻进程里这样写，请求 A 的数据会漏给请求 B
final class Context { public static array $user = []; }

// ✓ 用容器管理生命周期，请求级对象用完即弃
$container->set(UserContext::class, fn () => new UserContext());
```

### 2.2 工厂：把 `new` 收敛到一处

```php
<?php
declare(strict_types=1);

interface PaymentGateway
{
    public function pay(string $orderNo, int $amount): string;
}

final class PaymentGatewayFactory
{
    /** @param array<string, class-string<PaymentGateway>> $map */
    public function __construct(private array $map) {}

    public function make(string $channel): PaymentGateway
    {
        if (!isset($this->map[$channel])) {
            throw new InvalidArgumentException("不支持的支付渠道: {$channel}");
        }
        return new $this->map[$channel]();
    }
}

// 调用方只依赖工厂 + 接口，加渠道只改一行映射（或配置）
$gateway = $factory->make($order->channel);
$gateway->pay($order->no, $order->amount);
```

好处不是"看起来高级"，而是**新增实现不用改调用方**。用容器时更简单：`$container->get($map[$channel])`。

### 2.3 抽象工厂：一整套实现族

当"渠道"要成组切换（支付 + 退款 + 对账 + 通知都是同一家的实现）时，用抽象工厂返回**一族**对象，避免出现"用 A 家支付、B 家退款"这种错配。

```php
interface PaymentSuite
{
    public function gateway(): PaymentGateway;
    public function refund(): RefundService;
    public function reconciler(): Reconciler;
}

final class AlipaySuite implements PaymentSuite { /* ... */ }
final class WechatSuite implements PaymentSuite { /* ... */ }
```

**别用**：只有一个产品、未来也不会成套切换时，这是纯粹的类爆炸。

### 2.4 建造者：参数多且有可选组合

```php
<?php
declare(strict_types=1);

final class QueryBuilder
{
    private array $wheres = [];
    private array $orders = [];
    private ?int $limit = null;

    public function where(string $sql, mixed ...$bind): self
    {
        $this->wheres[] = [$sql, $bind];
        return $this;
    }

    public function orderBy(string $column, string $dir = 'ASC'): self
    {
        $this->orders[] = "{$column} {$dir}";
        return $this;
    }

    public function limit(int $n): self
    {
        $this->limit = $n;
        return $this;
    }

    public function toSql(): string { /* ... */ }
}
```

**PHP 8 的替代品**：命名参数 + 只读属性，很多时候比建造者更直接。

```php
new Report(from: $start, to: $end, groupBy: 'day', format: 'xlsx');
```

**什么时候还是需要建造者**：步骤有顺序约束、需要复用中间状态、要生成多种最终产物（SQL / 参数数组 / 缓存键）。

### 2.5 原型：克隆时小心浅拷贝

```php
$copy = clone $original;   // 属性是对象时，克隆的是"引用"，两个对象共享同一个子对象

public function __clone()
{
    $this->items = clone $this->items;   // 需要深拷贝就显式写在这里
}
```

---

## 3. 结构型模式

### 3.1 适配器：对接第三方 SDK 的唯一正确姿势

```php
<?php
declare(strict_types=1);

interface SmsSender
{
    public function send(string $phone, string $text): bool;
}

// 第三方 SDK 长这样：sendSms($mobile, $content, $templateId)
final class AliyunSmsAdapter implements SmsSender
{
    public function __construct(private AliyunClient $client, private string $templateId) {}

    public function send(string $phone, string $text): bool
    {
        $resp = $this->client->sendSms($phone, $text, $this->templateId);
        return ($resp['Code'] ?? '') === 'OK';
    }
}
```

**收益**：业务代码只依赖 `SmsSender`。将来换服务商、或者测试时塞一个假实现，都不用动业务代码。

### 3.2 装饰器：叠加功能，而不是继承爆炸

```php
<?php
declare(strict_types=1);

interface Fetcher { public function fetch(string $url): string; }

final class HttpFetcher implements Fetcher { /* 真实请求 */ }

final class CacheDecorator implements Fetcher
{
    public function __construct(private Fetcher $inner, private Cache $cache, private int $ttl = 60) {}

    public function fetch(string $url): string
    {
        $key = 'fetch:' . md5($url);
        return $this->cache->remember($key, $this->ttl, fn () => $this->inner->fetch($url));
    }
}

final class RetryDecorator implements Fetcher
{
    public function __construct(private Fetcher $inner, private int $times = 3) {}

    public function fetch(string $url): string
    {
        $last = null;
        for ($i = 0; $i < $this->times; $i++) {
            try { return $this->inner->fetch($url); } catch (Throwable $e) { $last = $e; usleep(200_000); }
        }
        throw $last;
    }
}

// 组合出"带缓存 + 失败重试"的抓取器，不用为每种组合写一个类
$fetcher = new RetryDecorator(new CacheDecorator(new HttpFetcher(), $cache), 3);
```

**对比继承**：`CachedRetryingHttpFetcher`、`CachedHttpFetcher`、`RetryingHttpFetcher`… 组合数一多就爆炸。

### 3.3 代理：延迟加载与访问控制

和装饰器结构一样，但**目的不同**：装饰器是增强功能，代理是控制访问（懒加载大对象、加权限校验、远程调用本地化）。

```php
final class LazyReportProxy
{
    private ?HeavyReport $real = null;

    public function __construct(private string $path) {}

    public function render(): string
    {
        return ($this->real ??= new HeavyReport($this->path))->render();
    }
}
```

### 3.4 门面：给子系统一个入口

```php
final class VideoFacade
{
    public function convert(string $file, string $format): string
    {
        // 内部编排：探测 → 转码 → 水印 → 上传 CDN
        return $this->uploader->upload($this->watermark->apply($this->transcoder->run($file, $format)));
    }
}
```

**注意**：门面只是**简化调用**，不是把一堆逻辑塞进一个"上帝类"。判断标准是"门面里只有编排，没有业务规则"。

### 3.5 组合：树形结构（菜单、权限、分类）

```php
interface Node { public function render(int $depth = 0): string; }

final class Leaf implements Node { /* 单条 */ }
final class Branch implements Node
{
    /** @param Node[] $children */
    public function __construct(private array $children = []) {}

    public function add(Node $node): void { $this->children[] = $node; }

    public function render(int $depth = 0): string
    {
        return implode('', array_map(fn (Node $c) => $c->render($depth + 1), $this->children));
    }
}
```

叶子节点和组合节点**接口一致**，递归处理不用区分类型。

---

## 4. 行为型模式

### 4.1 策略：消灭越写越长的 `if/else`

把 1.2 的场景重构：

```php
<?php
declare(strict_types=1);

interface ShippingStrategy
{
    public function fee(int $weight): int;
}

final class ShunfengStrategy implements ShippingStrategy
{
    public function fee(int $weight): int { return 1500 + $weight * 200; }
}

final class JdStrategy implements ShippingStrategy
{
    public function fee(int $weight): int { return 1200 + $weight * 250; }
}

final class ShippingCalculator
{
    /** @param array<string, ShippingStrategy> $strategies */
    public function __construct(private array $strategies) {}

    public function calculate(string $type, int $weight): int
    {
        // 用映射表代替 if/else，加渠道 = 注册一个新策略
        if (!isset($this->strategies[$type])) {
            throw new InvalidArgumentException("未知快递: {$type}");
        }
        return $this->strategies[$type]->fee($weight);
    }
}
```

**何时值得**：分支超过 3 个、每个分支还有多行逻辑、分支会持续新增、需要单测每个分支。

**何时不值得**：只有两个分支且逻辑一行 —— `if/else` 比一堆类更好读。

### 4.2 观察者：解耦"发生了什么事"和"要做什么事"

```php
<?php
declare(strict_types=1);

final class OrderPaid
{
    public function __construct(public readonly string $orderNo, public readonly int $amount) {}
}

final class EventDispatcher
{
    /** @var array<string, callable[]> */
    private array $listeners = [];

    public function on(string $event, callable $listener): void
    {
        $this->listeners[$event][] = $listener;
    }

    public function dispatch(object $event): void
    {
        foreach ($this->listeners[$event::class] ?? [] as $listener) {
            $listener($event);
        }
    }
}
```

**收益**：支付成功后要发通知、加积分、写统计 —— 三个监听器各自独立，主流程只 `dispatch` 一次。

**注意**：监听器里**不要抛异常影响主流程**，也别在里面同步做重活（发短信、调第三方）→ 丢队列异步做。调试时要能列出"这个事件有哪些监听器"，否则会变成"代码里找不到谁改了数据"。

### 4.3 责任链：中间件 / 审批流

```php
<?php
declare(strict_types=1);

interface Handler
{
    public function handle(Request $request): Response;
}

abstract class Middleware implements Handler
{
    protected ?Handler $next = null;

    public function setNext(Handler $next): Handler
    {
        $this->next = $next;
        return $next;
    }
}

final class AuthMiddleware extends Middleware
{
    public function handle(Request $request): Response
    {
        if (!$request->hasValidToken()) {
            return Response::unauthorized();     // 中断链
        }
        return $this->next->handle($request);    // 继续往下
    }
}
```

**典型落点**：鉴权 → 限流 → 参数校验 → 业务处理 → 日志。每一步只关心自己的事，顺序可以配置。

### 4.4 命令：把"操作"变成对象

```php
interface Command { public function execute(): void; }

final class RefundOrderCommand implements Command
{
    public function __construct(private OrderRepository $orders, private string $orderNo) {}

    public function execute(): void { $this->orders->markRefunded($this->orderNo); }
}
```

**用途**：丢队列异步执行、支持撤销（再写一个反向命令）、操作留痕（谁在什么时候执行了什么）。

### 4.5 模板方法：流程固定、步骤可变

```php
abstract class ImportTemplate
{
    final public function run(string $file): int
    {
        $rows = $this->parse($file);
        $valid = array_filter($rows, fn ($r) => $this->validate($r));
        $this->persist($valid);
        return count($valid);
    }

    abstract protected function parse(string $file): array;
    abstract protected function validate(array $row): bool;
    abstract protected function persist(array $rows): void;
}
```

`final` 锁住流程，子类只能换步骤 —— 这是它和策略的区别：**策略换整体算法，模板方法换部分步骤**。

**注意**：步骤超过 5 个、子类之间还要互相调用时，继承会让耦合变重，考虑改成组合（把步骤拆成注入的策略）。

### 4.6 状态：状态机而不是满屏 `if`

```php
enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Shipped = 'shipped';
    case Done = 'done';

    public function canTransferTo(self $next): bool
    {
        return match ($this) {
            self::Pending => $next === self::Paid,
            self::Paid => $next === self::Shipped,
            self::Shipped => $next === self::Done,
            default => false,
        };
    }
}
```

**收益**：非法流转被集中拦截，前端也能拿去渲染按钮；比散落各处的 `if ($status == 'paid' && ...)` 可靠得多。

### 4.7 迭代器 / 生成器：大数据集不要一次进内存

```php
/** @return iterable<array> */
function readCsv(string $path): iterable
{
    $fh = fopen($path, 'r');
    try {
        while (($row = fgetcsv($fh)) !== false) {
            yield $row;
        }
    } finally {
        fclose($fh);
    }
}

foreach (readCsv($path) as $row) { /* 内存恒定 */ }
```

---

## 5. 框架里已经在用的模式

不用刻意"用模式"，主流框架已经把大部分模式封装好了：

| 框架机制 | 对应模式 | 用法 |
| --- | --- | --- |
| `app()->make(Foo::class)` | 工厂 + 容器（注册表） | 依赖注入，别自己 new |
| `Illuminate\Support\Facades\DB` | 门面 | 静态调用转发到容器里的服务 |
| 中间件 `handle($request, $next)` | 责任链 | 鉴权、限流、日志 |
| `Event::dispatch()` / `Listener` | 观察者 | 业务事件解耦 |
| `Illuminate\Pipeline` | 责任链 | 多步骤处理同一份数据 |
| `Cursor` / `LazyCollection` | 迭代器 | 大数据集流式处理 |
| Hyperf 的 `#[Inject]`、AOP 切面 | 依赖注入 + 代理 | 日志、事务、缓存切面 |

**结论**：在 Laravel/Hyperf 里，你需要的往往是"用对框架机制"，而不是"手写一个单例/工厂"。

---

## 6. 过度设计与反模式

| 反模式 | 表现 | 怎么改 |
| --- | --- | --- |
| 为了模式而模式 | 只有一个实现却抽了接口 + 工厂 + 策略三层 | 删掉抽象，等第二个实现出现再说 |
| 单例滥用 | 到处 `Xxx::getInstance()`，状态互相污染 | 换成容器 + 请求级生命周期 |
| 上帝类 | 一个 `OrderService` 2000 行，什么都管 | 按业务动作拆分（下单/支付/退款各自服务） |
| 贫血模型 | 实体只有 getter/setter，规则全在 Service | 把不变量放进实体方法（`$order->pay()` 内部校验状态） |
| 继承代替组合 | 5 层继承改一个行为要动全家族 | 改成装饰器/策略组合 |
| 抽象泄漏 | 上层被迫处理底层细节（如到处传 PDO 语句） | 在边界处做适配，异常也翻译成业务异常 |
| 事件滥用 | 主流程靠事件串联，链路完全看不出来 | 核心流程显式调用，副作用才用事件 |
| 接口过细 | 20 个只有一个方法的接口 | 按变化点合并 |

**自检问题**：一个新同事能否在 10 分钟内看懂一条完整调用链？加一个同类实现需要改几个文件？改不了这两点，说明抽象过度或不足。

---

## 7. 决策速查表

| 你遇到的情况 | 推荐 | 别用 |
| --- | --- | --- |
| 新增一种"同类实现"（渠道、导出格式、算法） | 策略 + 工厂（映射表注册） | 无脑 `if/else` 或为每个组合建父子类 |
| 一整套实现要成组切换 | 抽象工厂 / 依赖注入绑定一组接口 | 全部塞进一个类 |
| 对象参数多、可选组合多 | 建造者，或 PHP 8 命名参数 | 10 个参数的构造函数 |
| 对接第三方 SDK | 适配器（自定义接口 + 适配类） | 业务代码直接调 SDK |
| 不改原类叠加功能（缓存、重试、日志） | 装饰器 | 继承出 `XxxWithCacheAndRetry` |
| 延迟加载 / 权限拦截 | 代理 | 把懒加载逻辑塞进业务方法 |
| 主流程后要触发多件互不相关的事 | 观察者 / 事件（副作用异步） | 在主流程里顺序写 8 个调用 |
| 流程固定、步骤可变 | 模板方法 | 每步都用 `if` 判断 |
| 处理步骤可插拔、可排序 | 责任链 / 中间件 | 一个巨型 `handle()` |
| 状态多、流转有规则 | 状态机（枚举 + 流转表） | 到处 `if ($status === ...)` |
| 大数据集遍历 | 迭代器 / 生成器 | 一次性 `fetchAll()` 进数组 |
| 只有一份实现、看不到第二份 | 直接写，等第三次重复再抽象 | 先抽接口和工厂 |
