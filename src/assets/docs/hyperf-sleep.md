# Hyperf 协程机制与阻塞处理指南

本文档总结了 Hyperf 框架中协程（Coroutine）的工作原理、为什么推荐使用 `\Hyperf\Coroutine\Coroutine::sleep()`，以及常见的阻塞场景与优化方案。

---

## 一、为什么使用 `Coroutine::sleep()`？

在 Hyperf 中，推荐使用 `\Hyperf\Coroutine\Coroutine::sleep($sleep)`（或简写为 `Hyperf\Coroutine\sleep($sleep)`）而非原生 PHP 的 `sleep()`，核心原因在于**避免阻塞当前的 Worker 进程**。

### 1. 核心差异

| 特性 | 原生 `sleep()` | `Coroutine::sleep()` |
| :--- | :--- | :--- |
| **阻塞粒度** | **进程级**（整个 Worker 进程挂起） | **协程级**（仅挂起当前协程） |
| **CPU 控制权** | 独占并死等，无法处理其他请求 | 释放（Yield）控制权，供其他协程使用 |
| **并发能力** | 严重降低并发（排队串行） | 极高并发（非阻塞异步） |

### 2. 性能对比示例

假设单进程 Worker 接收 100 个并发请求，每个请求需要休眠 1 秒：

* **使用原生 `sleep(1)`**：
  * 请求只能串行处理，处理完 100 个请求总共耗时 **100 秒**。
* **使用 `Coroutine::sleep(1)`**：
  * 毫秒内切换并挂起 100 个协程，1 秒定时器到期后批量唤醒，处理完总共仅耗时 **约 1 秒**。

---

## 二、协程唤醒与“资源”挂起机制

### 1. 什么是协程的“资源”？
在单进程协程模型中，最主要的资源就是 **CPU 时间片（Worker 进程的控制权）**。

### 2. 休眠到期后的恢复流程
当 `Coroutine::sleep()` 到期时，底层 EventLoop（事件循环）会将该协程标记为**“就绪（Ready）”**状态并放入队列：
* **进程空闲**：立刻恢复（Resume）协程继续执行。
* **进程繁忙**（如正执行 CPU 密集任务）：协程继续排队，直到当前任务让出 CPU。

> **公式**：实际恢复时间 = `sleep 时间` + `排队等待 CPU 的时间`

---

## 三、Hyperf 中常见的阻塞场景与函数

为了保证协程的高并发能力，应尽量避免在代码中使用以下阻塞函数：

### 1. 进程休眠与系统调用
* **阻塞函数**：`sleep()`、`usleep()`、`exec()`、`shell_exec()`、`system()`
* **替代方案**：
  * 休眠：`Hyperf\Coroutine\Coroutine::sleep()`
  * 命令执行：`Hyperf\Coroutine\System::exec($cmd)`

### 2. 文件与磁盘 I/O
* **阻塞函数**：`file_get_contents()`、`file_put_contents()`、`fread()`、`fwrite()`
* **替代方案**：使用异步/协程文件组件，或投递到 Task Worker 进程中处理。

### 3. 网络与 Socket 请求
* **阻塞函数**：`fsockopen()`、`curl_exec()`（未开启 Hook 时）、`gethostbyname()`（同步 DNS）
* **替代方案**：
  * HTTP 请求：`Hyperf\Guzzle\ClientFactory`
  * DNS 解析：`Hyperf\Coroutine\Coroutine::gethostbyname()`

### 4. 数据库与缓存（未适配协程）
* **阻塞场景**：直接实例化原生 `PDO`、原生 `mysqli`，或使用未协程化的第三方 SDK。
* **替代方案**：使用 Hyperf 官方连接池组件（`Hyperf\DbConnection`、`Hyperf\Redis`）。

### 5. CPU 密集型计算（逻辑阻塞）
* **阻塞场景**：大数组深层循环遍历、图片/视频处理、复杂加解密算法（如 `openssl_encrypt()`）。
* **优化策略**：
  * 长循环中主动让出 CPU：`Hyperf\Engine\Coroutine::yield()`
  * 将密集计算投递给 Swoole Task 进程处理。

---

## 四、最佳实践总结

1. **显式使用协程 API**：虽然 Swoole 提供了 Hook 机制，但显式调用 `Coroutine::sleep()` 等函数更具安全性和可读性。
2. **警惕纯 CPU 密集计算**：协程最擅长处理 **I/O 密集型** 任务；对于纯 CPU 计算，必须控制时长或切分任务。
3. **保持连接池充分**：使用协程数据库/Redis 连接池时，确保池大小配置合理，避免协程因等待空闲连接而挂起超时。