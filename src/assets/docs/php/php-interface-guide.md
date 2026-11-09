# 什么时候该用接口（Interface）

## 一句话总纲

> **接口唯一的作用是：让调用方不知道（或不关心）背后是谁。**
>
> **如果调用方无论如何都会知道是哪个类，接口就是多余的。**

---

## 判断三步

拿到任何一个接口，问三个问题。**三个里有一个答「是」→ 留，全「否」→ 删。**

| # | 问题 | 说明 |
|---|---|---|
| 1 | 有**多个实现**，且调用方要**运行时选择**吗？ | 配置决定、环境决定、用户偏好决定 |
| 2 | 这个接口是否**跨包/跨层**，被其他 composer 包或上层模块依赖？ | 领域层不能依赖基础设施层、对外 SDK 等 |
| 3 | 调用方是否**真的不关心**背后是哪个实现？ | 调用方只调方法，不 new 具体类 |

---

## 该留接口的场景

### 场景 1：多个实现 + 运行时切换

**例子：支付网关**

```php
interface PaymentGatewayInterface
{
    public function pay(int $orderId, int $amount): bool;
    public function refund(int $orderId, int $amount): bool;
}

final class WechatPay implements PaymentGatewayInterface
{
    public function __construct(private readonly WechatSdk $sdk) {}

    public function pay(int $orderId, int $amount): bool
    {
        return $this->sdk->unifiedOrder($orderId, $amount);
    }

    public function refund(int $orderId, int $amount): bool
    {
        return $this->sdk->refund($orderId, $amount);
    }
}

final class AlipayPay implements PaymentGatewayInterface
{
    public function __construct(private readonly AlipaySdk $sdk) {}

    public function pay(int $orderId, int $amount): bool
    {
        return $this->sdk->tradeCreate($orderId, $amount);
    }

    public function refund(int $orderId, int $amount): bool
    {
        return $this->sdk->tradeRefund($orderId, $amount);
    }
}

// 调用方：完全不知道背后是哪个
final class OrderService
{
    public function __construct(
        private readonly PaymentGatewayInterface $pay,
    ) {}

    public function checkout(int $orderId, int $amount): void
    {
        if (!$this->pay->pay($orderId, $amount)) {
            throw new BusinessException('支付失败');
        }
    }
}

// 容器里根据配置决定注入哪个
$this->app->bind(PaymentGatewayInterface::class, fn () =>
    match (config('payment.channel')) {
        'wechat'  => new WechatPay(app(WechatSdk::class)),
        'alipay'  => new AlipayPay(app(AlipaySdk::class)),
    }
);
```

**为什么留：**

- 3 个实现，配置决定用哪个
- `OrderService` 只调 `pay()`，不知道是微信还是支付宝
- 新增渠道 → 加一个类，`OrderService` 一个字不改

---

### 场景 2：跨包/跨层的契约（PSR 标准）

**例子：HTTP 中间件**

```php
// psr/http-server-handler 包里的接口
interface RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface;
}
```

```php
// 你的中间件：接收「下一个 handler」，但不关心是谁
final class AuthMiddleware implements MiddlewareInterface
{
    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,   // ← 接口：下一个可能是任意中间件或 Controller
    ): ResponseInterface {
        // 认证逻辑...
        try {
            return $handler->handle($request);  // 交给下一个
        } finally {
            // 清理逻辑...
        }
    }
}
```

**为什么留：**

- `RequestHandlerInterface` 有无数个实现（每个中间件、每个 Controller）
- 中间件链是**运行时动态拼的**，`AuthMiddleware` 完全不知道下一个是谁
- 新增中间件 → 改配置数组，框架代码零改动
- 跨 composer 包（PSR 标准），全 PHP 生态共用

---

### 场景 3：统一处理横切逻辑的「请求对象」

**例子：外部 API 请求**

```php
interface OsBackendRequestInterface
{
    public function method(): string;
    public function path(): string;
    public function query(): array;
    public function json(): array;
    public function options(): array;
}

final class ValidateTokenRequest implements OsBackendRequestInterface
{
    public function __construct(
        private readonly string $token,
        private readonly int $systemType,
    ) {}

    public function method(): string  { return 'POST'; }
    public function path(): string    { return '/openapi/token/validate'; }
    public function query(): array    { return []; }
    public function json(): array     { return ['token' => $this->token, 'system' => $this->systemType]; }
    public function options(): array  { return []; }
}

final class LatestNoticeRequest implements OsBackendRequestInterface
{
    public function method(): string  { return 'GET'; }
    public function path(): string    { return '/openapi/notice/latest'; }
    public function query(): array    { return ['channel' => 4]; }
    public function json(): array     { return []; }
    public function options(): array  { return []; }
}

// 统一处理：签名、校验、发 HTTP 全在这一处
final class OsBackendClient
{
    public function request(OsBackendRequestInterface $request): array
    {
        return $this->httpClient->requestJson(
            'os_backend',
            $request->method(),
            $request->path(),
            $this->signedOptions($request),
        );
    }
}
```

**为什么留：**

- 4+ 个实现，每个 API 一个 Request 类
- `request()` 里的签名、校验、HTTP 逻辑**只写一次**，所有 API 共用
- 新增 API → 加一个 Request 类，`request()` 零改动

---

## 不该留接口的场景

### 反例 1：单实现 + 无切换可能

```php
// ❌ 多余
interface AuthUserTreeReaderInterface
{
    public function tree(int $userId, string $permission, EmployeeScopeEnum $scope): array;
}

final class AuthUserTreeProvider implements AuthUserTreeReaderInterface
{
    public function tree(int $userId, string $permission, EmployeeScopeEnum $scope): array
    {
        // 真干活
    }
}

// 调用方
final class UserService
{
    public function __construct(private readonly AuthUserTreeReaderInterface $tree) {}

    public function authUserTree(array $params): array
    {
        return $this->tree->tree(...);
    }
}
```

**为什么多余：**

- 只有 1 个实现，永远不会换
- `UserService` 直接注入 `AuthUserTreeProvider`，行为完全一样
- `AuthUserTreeProvider` 内部 private 方法（`loadDeparts`、`buildTree`）本来就看不见，接口没挡住任何东西

**改法：**

```php
// 删掉接口，去掉 implements，调用方直接注入具体类
final class UserService
{
    public function __construct(
        private readonly AuthUserTreeProvider $tree,
    ) {}

    public function authUserTree(array $params): array
    {
        return $this->tree->tree(...);   // 一行直达
    }
}
```

---

### 反例 2：单实现 + 名字暗示未来可能有，但实际没有

```php
// ❌ 多余（除非团队明确排期要加第二种）
interface TokenAuthenticatorInterface
{
    public function validate(string $token, int $system): array;
    public function getCompanyInfo(string $host): array;
}

final class TokenAuthenticatorOpenApi implements TokenAuthenticatorInterface
{
    // ...
}
```

**判断要点：**

- 名字带 `OpenApi` 后缀，只说明「作者想过以后可能有 SSO/JWT」
- **「以后可能有」不是理由，「已经排期要加」才是理由**
- 代码里没有任何证据：没有配置项、没有第二个类、没有注释说「以后加」

**改法：**

1. 删接口
2. 类名去掉后缀：`TokenAuthenticatorOpenApi` → `TokenAuthenticator`
3. 调用方注入具体类

```php
public function __construct(
    private readonly TokenAuthenticator $tokenAuthenticator,
) {}
```

**如果团队真的排期要加第二种认证**（比如下个迭代接 SSO），那接口可以留，但必须真的在容器里做绑定：

```php
$this->app->bind(TokenAuthenticatorInterface::class, fn () =>
    match (config('auth.mode')) {
        'sso'     => new TokenAuthenticatorSso(...),
        'openapi' => new TokenAuthenticatorOpenApi(...),
    }
);
```

---

### 反例 3：多实现，但调用方写死了用哪个

```php
// ⚠️ 看起来该留，实际多余
interface NameFormatterInterface
{
    public function format(string $name): string;
}

final class UpperFormatter implements NameFormatterInterface { /* ... */ }
final class LowerFormatter implements NameFormatterInterface { /* ... */ }

// 调用方 A：写死用大写
final class UserList
{
    public function __construct(private readonly UpperFormatter $formatter) {}
}

// 调用方 B：写死用小写
final class UserExport
{
    public function __construct(private readonly LowerFormatter $formatter) {}
}
```

**为什么多余：**

- 有 2 个实现，但**没有任何调用方通过接口注入**
- 每个调用方都明确知道用哪个
- 接口没被任何地方用来「统一调用」

**改法：** 删接口，调用方保持注入具体类。**多实现但没有统一调用方时，接口就是装饰。**

---

## 快速决策表

| 情况 | 结论 |
|---|---|
| 单实现 + 同包同层 + 无第二实现计划 | **删** |
| 单实现 + 跨包/跨层（领域层依赖基础设施） | **留** |
| 单实现 + 对外 SDK（别人不该看到实现） | **留** |
| 多实现 + 调用方注入接口、运行时切换 | **留** |
| 多实现 + 每个调用方写死用哪个 | **删** |
| 多实现 + 统一处理横切逻辑（签名/校验/鉴权） | **留** |

---

## 三个常见误区

### 误区 1：「只有一个 implements 就该删」

**错。** 判断标准不是 `implements` 数量，是「有没有多个实现真的被统一调用、且调用方不关心是谁」。

`RequestHandlerInterface` 有无数实现，必留；`AuthUserTreeReaderInterface` 只有一个实现，该删。**数量只是线索，不是判据。**

---

### 误区 2：「不在同一个目录就必须留接口」

**错。** 目录只是边界的**影子**，不是边界本身。

真正的边界是：

- `composer.json` 里规定不能依赖
- 团队明文规定分层规则（如 deptrac、PHPArkitect 静态检查）
- 对外发布的包

**没有这些规则约束时，目录不同不影响判断。**

---

### 误区 3：「以后可能会加第二种实现，所以先留着」

**错。** 「以后可能会」不是理由，「已经排期要加」才是。

抽接口是几行代码的事，真到要加的那天再抽也不迟。**提前一年为不存在的需求付维护成本，是典型的技术债。**

---

## 一个简单验证法

**把接口删掉，改成注入具体类。然后问自己：**

> 有哪个调用方会受影响？

- **答不上来** → 删对了
- **有一个或几个调用方真的需要切换** → 接口该留，恢复它

这个验证法比任何理论都直接。**删了能跑且行为一样，就是多余的。**

---

## 最后

> **接口不是「有个类实现了它」才存在，而是「有个调用方需要不知道背后是谁」才存在。**
>
> **拿到任何一个接口，删掉它试试。如果代码能跑、行为不变、调用方不会多看到任何东西——删。**
