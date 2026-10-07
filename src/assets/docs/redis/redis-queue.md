---
title: Redis 队列与延迟队列实现详解
navTitle: Redis 队列实现
category: Redis
order: 2
description: Redis 普通队列与延迟队列的实现方案、原理、对比及实战
---
# Redis 队列与延迟队列实现详解

> **适用场景**：轻量级消息队列、异步任务处理、订单超时关闭、定时通知、重试补偿等。
> **核心内容**：Redis 实现普通队列和延迟队列的多种方案、原理、代码示例及选型建议。

---

## 目录

- [1. Redis 队列概述](#1-redis-队列概述)
- [2. 基于 List 实现普通队列](#2-基于-list-实现普通队列)
  - [2.1 基本原理](#21-基本原理)
  - [2.2 BRPOP 阻塞消费](#22-brpop-阻塞消费)
  - [2.3 可靠队列 RPOPLPUSH](#23-可靠队列-rpoplpush)
  - [2.4 优缺点](#24-优缺点)
- [3. 基于 ZSet 实现延迟队列](#3-基于-zset-实现延迟队列)
  - [3.1 基本原理](#31-基本原理)
  - [3.2 基本流程](#32-基本流程)
  - [3.3 Lua 脚本保证原子性](#33-lua-脚本保证原子性)
  - [3.4 多消费者并发处理](#34-多消费者并发处理)
  - [3.5 优化轮询频率](#35-优化轮询频率)
  - [3.6 优缺点](#36-优缺点)
- [4. 基于 Stream 实现可靠队列](#4-基于-stream-实现可靠队列)
  - [4.1 基本原理](#41-基本原理)
  - [4.2 消费者组](#42-消费者组)
  - [4.3 消息确认与重试](#43-消息确认与重试)
  - [4.4 死信队列](#44-死信队列)
  - [4.5 优缺点](#45-优缺点)
- [5. 基于 Keyspace Notification 实现延迟队列](#5-基于-keyspace-notification-实现延迟队列)
  - [5.1 基本原理](#51-基本原理)
  - [5.2 实现步骤](#52-实现步骤)
  - [5.3 优缺点与风险](#53-优缺点与风险)
- [6. 基于 Redisson 实现延迟队列](#6-基于-redisson-实现延迟队列)
  - [6.1 基本原理](#61-基本原理)
  - [6.2 使用方式](#62-使用方式)
  - [6.3 内部结构](#63-内部结构)
  - [6.4 优缺点](#64-优缺点)
- [7. 方案对比与选型建议](#7-方案对比与选型建议)
- [8. 可靠性保障](#8-可靠性保障)
  - [8.1 消息丢失场景与解决](#81-消息丢失场景与解决)
  - [8.2 重复消费与幂等](#82-重复消费与幂等)
  - [8.3 死信队列设计](#83-死信队列设计)
- [9. 实战场景](#9-实战场景)
  - [9.1 订单超时关闭](#91-订单超时关闭)
  - [9.2 异步任务队列](#92-异步任务队列)
  - [9.3 延迟重试](#93-延迟重试)
- [10. 性能与注意事项](#10-性能与注意事项)
- [11. 速查表](#11-速查表)
- [12. 总结](#12-总结)

---

## 1. Redis 队列概述

Redis 本身不是专业的消息队列中间件，但凭借其高性能和丰富的数据结构，可以实现轻量级的消息队列。常用的方案有：

| 方案 | 数据结构 | 适用场景 |
|---|---|---|
| List | 列表 | 简单 FIFO 队列 |
| ZSet | 有序集合 | 延迟队列、优先级队列 |
| Stream | 流 | 可靠队列、消费者组 |
| Pub/Sub | 发布订阅 | 实时通知（不持久化） |
| Keyspace Notification | 键空间通知 | 延迟任务（不推荐生产） |

Redis 5.0 引入 Stream 后，队列能力大幅增强，支持消费者组、消息确认、消息回溯等特性[reference:0]。

---

## 2. 基于 List 实现普通队列

### 2.1 基本原理

List 是最简单的队列实现方式。生产者使用 `LPUSH` 将消息推入列表头部，消费者使用 `RPOP` 从列表尾部弹出消息，保证 FIFO 顺序[reference:1]。

```
生产者 → LPUSH queue msg1
                    msg2
                    msg3  → 队列: [msg3, msg2, msg1]

消费者 ← RPOP queue     ← 弹出 msg1（最早入队）
```

也可以反方向使用：`RPUSH` + `LPOP`，只要保证生产和消费操作不同方向即可。

### 2.2 BRPOP 阻塞消费

直接使用 `RPOP` 的问题：队列为空时返回 `NULL`，消费者需要不断轮询，造成 CPU 空转[reference:2]。

解决方案：使用 `BRPOP`（阻塞式弹出），队列为空时阻塞等待，直到有新消息或超时[reference:3]。

```bash
# 阻塞式消费，超时 0 表示永久阻塞
BRPOP my_queue 0
```

```php
// PHP 消费者示例
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);

while (true) {
    // 阻塞等待，超时 30 秒
    $result = $redis->brPop(['my_queue'], 30);
    if ($result) {
        $message = $result[1];
        processMessage($message);
    }
}
```

> **注意**：如果超时时间设置太长，连接长期不活跃可能被 Redis 服务器判定为无效连接并断开，客户端需要实现重连机制[reference:4]。

### 2.3 可靠队列 RPOPLPUSH

List 队列的致命问题：消费者 `RPOP` 取出消息后如果宕机，消息就永久丢失了[reference:5]。

解决方案：使用 `RPOPLPUSH`（或 `BRPOPLPUSH`），将消息原子性地从主队列转移到"处理中队列"，处理完成后再删除。

```
LPUSH queue msg1       # 生产者入队
BRPOPLPUSH queue processing 30  # 消费者：从 queue 弹出，同时推入 processing
# 处理成功 → LREM processing 1 msg1
# 处理失败/超时 → 消息仍在 processing 中，可重新处理
```

```php
// 可靠消费示例
while (true) {
    // 从主队列取出，同时放入处理中队列
    $message = $redis->brPopLPush('queue', 'processing', 30);
    if ($message) {
        try {
            processMessage($message);
            // 处理成功，从处理中队列删除
            $redis->lRem('processing', $message, 1);
        } catch (Exception $e) {
            // 处理失败，消息留在 processing 中，由后台补偿任务处理
            logError($e);
        }
    }
}
```

### 2.4 优缺点

| 维度 | 说明 |
|---|---|
| 优点 | 实现简单，FIFO 顺序，支持阻塞消费 |
| 缺点 | 不支持重复消费，不支持消费者组，无 ACK 机制 |
| 消息丢失 | 消费者取出后宕机，消息丢失 |
| 适用场景 | 简单异步任务，允许偶尔丢失 |

---

## 3. 基于 ZSet 实现延迟队列

### 3.1 基本原理

延迟队列的本质是"时间驱动的队列"：生产者指定任务的执行时间，消费者只在任务到期时才取出处理[reference:6]。

ZSet（有序集合）的每个元素有一个 `score`，利用 `score` 存储任务到期时间戳，ZSet 自动按 score 排序，最早到期的任务排在最前面[reference:7]。

```
ZADD delay_queue 1694505600 '{"task_id": 1, "type": "email"}'
ZADD delay_queue 1694505900 '{"task_id": 2, "type": "sms"}'

ZSet 内部按 score 排序：
  score=1694505600 → task 1（先到期，先执行）
  score=1694505900 → task 2
```

### 3.2 基本流程

**生产者（添加延迟任务）：**

```bash
# 将任务序列化，用执行时间戳作为 score
ZADD delay_queue <execute_timestamp> <task_json>
```

**消费者（轮询到期任务）：**

```bash
# 查询 score ≤ 当前时间的任务
ZRANGEBYSCORE delay_queue -inf <current_timestamp> LIMIT 0 10
# 处理完成后删除
ZREM delay_queue <task_json>
```

```php
// PHP 生产者示例
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);

function addDelayedTask($redis, $queue, $delaySeconds, $task) {
    $executeTime = time() + $delaySeconds;
    $redis->zAdd($queue, $executeTime, json_encode($task));
}

// 添加一个 30 秒后执行的任务
addDelayedTask($redis, 'delay_queue', 30, [
    'task_id' => 123,
    'type' => 'close_order',
    'order_id' => 'ORD20261007001'
]);
```

```php
// PHP 消费者示例
while (true) {
    $now = time();
    // 获取到期的任务（最多 10 条）
    $tasks = $redis->zRangeByScore('delay_queue', '-inf', $now, [
        'limit' => [0, 10]
    ]);

    if (!empty($tasks)) {
        foreach ($tasks as $taskJson) {
            $task = json_decode($taskJson, true);
            processTask($task);
            // 处理成功后从 ZSet 删除
            $redis->zRem('delay_queue', $taskJson);
        }
    } else {
        // 没有到期任务，休眠 1 秒
        sleep(1);
    }
}
```

### 3.3 Lua 脚本保证原子性

**问题**：多消费者并发时，"查询到期任务"和"删除任务"是两个独立操作，可能出现多个消费者同时查询到同一条任务，导致重复消费[reference:8]。

**解决**：使用 Lua 脚本将"查询 + 删除 + 返回"合并为原子操作[reference:9]。

```lua
-- 原子化获取到期任务
-- KEYS[1]: ZSet key
-- ARGV[1]: 当前时间戳
-- ARGV[2]: 一次最多获取数量
local tasks = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
if #tasks > 0 then
    redis.call('ZREM', KEYS[1], unpack(tasks))
end
return tasks
```

```php
// PHP 调用 Lua 脚本
$luaScript = <<<LUA
local tasks = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
if #tasks > 0 then
    redis.call('ZREM', KEYS[1], unpack(tasks))
end
return tasks
LUA;

$tasks = $redis->eval($luaScript, ['delay_queue', time(), 10], 1);
```

> **说明**：`ZREM` 和 `ZRANGEBYSCORE` 通过 Lua 脚本保证原子执行，多个消费者不会拿到同一条任务[reference:10]。

### 3.4 多消费者并发处理

多消费者场景下，推荐的做法是：

1. **Lua 脚本原子取出**：确保每个任务只被一个消费者获取。
2. **任务 ID 幂等**：任务体中包含唯一 ID，消费逻辑保证幂等。
3. **独立 worker 进程**：每个消费者进程独立轮询，互不干扰。

```
┌──────────┐
│ Producer │  ZADD delay_queue <ts> task
└────┬─────┘
     │
     ▼
┌──────────────┐
│  ZSet 队列   │  score = 到期时间戳
└──────┬───────┘
       │ Lua 脚本原子取出
       │
  ┌────┴────┐
  ▼         ▼
┌──────┐  ┌──────┐
│Worker│  │Worker│   并发消费，互不重复
│  A   │  │  B   │
└──────┘  └──────┘
```

### 3.5 优化轮询频率

ZSet 没有阻塞命令，消费者必须轮询。为降低轮询开销，可以：

- **动态 sleep**：根据最近任务的到期时间计算下一次轮询时间。
- **减小轮询间隔**：精度要求高时用 1 秒，精度要求低时用 5-10 秒。
- **分批处理**：一次取出多条任务，减少 Redis 调用次数。

```php
// 动态 sleep 优化
while (true) {
    $now = time();
    $tasks = $redis->eval($luaScript, ['delay_queue', $now, 20], 1);

    if (!empty($tasks)) {
        foreach ($tasks as $taskJson) {
            processTask(json_decode($taskJson, true));
        }
        continue; // 有任务，立即继续
    }

    // 查询下一个最近的到期时间
    $next = $redis->zRange('delay_queue', 0, 0, true);
    if ($next) {
        $nextTime = array_values($next)[0];
        $sleep = max(1, $nextTime - time());
        sleep(min($sleep, 10)); // 最多休眠 10 秒
    } else {
        sleep(5); // 队列为空，休眠 5 秒
    }
}
```

### 3.6 优缺点

| 维度 | 说明 |
|---|---|
| 优点 | 实现简单，精度可做到秒级，支持延迟/定时任务 |
| 缺点 | 需要轮询，有 CPU 开销；无 ACK 机制；ZSet 不支持重复元素 |
| 时间精度 | 秒级（取决于轮询间隔） |
| 适用场景 | 订单超时、延迟通知、重试补偿 |

---

## 4. 基于 Stream 实现可靠队列

### 4.1 基本原理

Stream 是 Redis 5.0 引入的数据结构，专为消息队列设计。它是一个只允许追加的日志结构，消息有唯一 ID，支持消费者组、消息确认和消息回溯[reference:11]。

```bash
# 添加消息
XADD mystream * field1 value1 field2 value2
# 返回消息 ID: 1699980000000-0

# 读取消息
XREAD COUNT 10 STREAMS mystream 0
```

### 4.2 消费者组

消费者组是 Stream 最强大的特性：多个消费者可以共同消费同一个 Stream，每条消息只会被组内一个消费者处理[reference:12]。

```bash
# 创建消费者组
XGROUP CREATE mystream mygroup 0

# 消费者组内消费（> 表示新消息）
XREADGROUP GROUP mygroup consumer1 COUNT 10 BLOCK 5000 STREAMS mystream >
```

```php
// PHP Stream 生产者
$redis->xAdd('task_stream', '*', [
    'task_id' => '123',
    'type' => 'send_email',
    'payload' => json_encode(['to' => 'user@example.com'])
]);

// PHP Stream 消费者组
try {
    $redis->xGroup('CREATE', 'task_stream', 'workers', '0', true);
} catch (Exception $e) {
    // 组已存在，忽略
}

while (true) {
    $messages = $redis->xReadGroup(
        'workers',           // 消费者组
        'worker-1',          // 消费者名
        ['task_stream' => '>'], // 读取新消息
        10,                  // 每次最多 10 条
        5000                 // 阻塞 5 秒
    );

    if ($messages) {
        foreach ($messages['task_stream'] as $id => $data) {
            try {
                processTask($data);
                // 处理成功，确认
                $redis->xAck('task_stream', 'workers', $id);
            } catch (Exception $e) {
                // 处理失败，不 ACK，消息留在 PEL 中
                logError($e);
            }
        }
    }
}
```

### 4.3 消息确认与重试

Stream 的消费者组维护一个 **PEL（Pending Entries List，待处理条目列表）** ：消费者读取消息后，消息进入 PEL，直到调用 `XACK` 确认后才会移除[reference:13]。

如果消费者崩溃，未确认的消息留在 PEL 中，可以用 `XAUTOCLAIM`（Redis 6.2+）将超时未确认的消息重新分配给其他消费者[reference:14]。

```php
// 后台补偿任务：回收超时未确认的消息
$pending = $redis->xPending('task_stream', 'workers', '-', '+', 10);
// 或使用 XAUTOCLAIM（Redis 6.2+）
$claimed = $redis->xAutoClaim('task_stream', 'workers', 'worker-2', 60000, '0');
```

### 4.4 死信队列

当消息重试超过最大次数后，将其转入死信队列（DLQ），避免无限重试[reference:15]。

```php
// 检查消息投递次数
$pendingInfo = $redis->xPending('task_stream', 'workers', $messageId, $messageId, 1);
$deliveryCount = $pendingInfo[0][3] ?? 0; // 投递次数

if ($deliveryCount >= 3) {
    // 超过最大重试次数，转入死信队列
    $redis->xAdd('dead_letter_stream', '*', $data);
    $redis->xAck('task_stream', 'workers', $messageId);
    $redis->xDel('task_stream', $messageId);
}
```

### 4.5 优缺点

| 维度 | 说明 |
|---|---|
| 优点 | 支持消费者组、ACK 确认、消息回溯、PEL 自动重试 |
| 缺点 | 操作相对复杂；需要 Redis 5.0+；内存占用比 List 高 |
| 可靠性 | 最高，消息不会因消费者崩溃而丢失 |
| 适用场景 | 需要可靠消费、多消费者、消息确认的场景 |

---

## 5. 基于 Keyspace Notification 实现延迟队列

### 5.1 基本原理

Keyspace Notification 允许客户端订阅 Redis 的键过期事件。将一个 key 设置 TTL，到期后 Redis 通过 Pub/Sub 发布通知，客户端监听后执行对应任务[reference:16]。

```bash
# 开启键空间通知（Ex 表示过期事件）
CONFIG SET notify-keyspace-events Ex

# 设置一个 30 秒后过期的 key
SET order:123 "pending" EX 30

# 监听过期事件
SUBSCRIBE __keyevent@0__:expired
```

```php
// PHP 监听过期事件
$redis->config('SET', 'notify-keyspace-events', 'Ex');
$redis->subscribe(['__keyevent@0__:expired'], function ($redis, $channel, $key) {
    // $key 是过期的键名，如 "order:123"
    processExpiredKey($key);
});
```

### 5.2 实现步骤

1. 配置 `notify-keyspace-events` 为 `Ex`[reference:17]。
2. 生产者将任务存入 Redis 并设置 TTL。
3. 消费者订阅 `__keyevent@<db>__:expired` 频道。
4. 收到过期事件后，根据 key 名执行对应任务。

### 5.3 优缺点与风险

| 维度 | 说明 |
|---|---|
| 优点 | 实现简单，无需轮询 |
| 缺点 | **不可靠**：Redis 不保证过期事件准时发送 |
| 关键风险 | 过期事件采用"发送即忘"策略，Redis 宕机、消费者下线都会丢消息 |
| 时间精度 | 不精确，过期删除是惰性+定期扫描，可能延迟数秒到数分钟 |
| 适用场景 | **不推荐生产环境使用**，仅适合对可靠性要求极低的场景 |

> Redis 官方文档明确指出：Redis 从未保证会在设定的过期时间立即删除并发送过期通知[reference:18]。

---

## 6. 基于 Redisson 实现延迟队列

### 6.1 基本原理

Redisson 是 Redis 的 Java 客户端，提供了开箱即用的 `RDelayedQueue`，底层基于 ZSet + Pub/Sub 实现[reference:19]。

核心流程：将延迟消息存入 ZSet（score = 到期时间），后台线程轮询 ZSet，到期后转移到目标队列，消费者从目标队列阻塞获取[reference:20]。

### 6.2 使用方式

```java
// 生产者
RBlockingQueue<String> blockingQueue = redissonClient.getBlockingQueue("delay-queue");
RDelayedQueue<String> delayedQueue = redissonClient.getDelayedQueue(blockingQueue);
delayedQueue.offer("测试延迟消息", 5, TimeUnit.SECONDS);

// 消费者
String msg = blockingQueue.take(); // 阻塞获取
processMessage(msg);
```

### 6.3 内部结构

Redisson 内部使用三个队列协同工作[reference:21]：

| 队列 | 作用 |
|---|---|
| 消息延时队列（ZSet） | score = 到期时间戳，按时间排序 |
| 消息顺序队列（List） | 记录插入顺序 |
| 消息目标队列（List） | 存放到期消息，供消费者消费 |

后台线程轮询延时队列，将到期消息从 ZSet 移除并推入目标队列。

### 6.4 优缺点

| 维度 | 说明 |
|---|---|
| 优点 | 开箱即用，封装完整，支持分布式 |
| 缺点 | 仅 Java 生态；依赖 Redisson 框架 |
| 适用场景 | Java 项目中的延迟队列需求 |

---

## 7. 方案对比与选型建议

| 方案 | 可靠性 | 时间精度 | 消费者组 | ACK | 实现复杂度 | 推荐场景 |
|---|---|---|---|---|---|---|
| List | 低 | N/A | 不支持 | 不支持 | 低 | 简单异步任务 |
| List + RPOPLPUSH | 中 | N/A | 不支持 | 支持 | 中 | 需要基本可靠性的任务 |
| ZSet | 中 | 秒级 | 不支持 | 不支持 | 中 | 延迟队列 |
| Stream | 高 | 毫秒级 | 支持 | 支持 | 高 | 可靠队列、多消费者 |
| Keyspace Notification | 极低 | 秒~分钟 | 不支持 | 不支持 | 低 | 不推荐生产 |
| Redisson | 高 | 秒级 | 支持 | 支持 | 低（Java） | Java 延迟队列 |

**选型建议：**

- **简单任务分发**：List + BRPOP。
- **延迟任务（订单超时等）** ：ZSet + Lua 脚本。
- **可靠消费、多消费者**：Stream + 消费者组。
- **Java 项目延迟队列**：Redisson `RDelayedQueue`。
- **生产环境不要用 Keyspace Notification**。

---

## 8. 可靠性保障

### 8.1 消息丢失场景与解决

| 丢失场景 | 原因 | 解决方案 |
|---|---|---|
| 消费者取出后崩溃 | List 消息已被删除 | 使用 RPOPLPUSH + 处理中队列 |
| Redis 宕机 | 内存数据丢失 | 开启 AOF 持久化 |
| 队列满时新消息被丢弃 | 内存淘汰策略 | 设置合理的 maxmemory-policy |
| ZSet 轮询期间宕机 | 任务已被删除但未处理 | 使用 Lua 脚本原子取出，确保取出即已删除；配合幂等 |
| Stream 消费者崩溃 | 消息未 ACK | 消息留在 PEL，用 XAUTOCLAIM 重新分配 |

### 8.2 重复消费与幂等

消息队列通常保证 **至少一次（at-least-once）** 投递，因此消费端必须保证幂等。

常用幂等方案：

1. **Redis 去重**：用消息 ID 作为 key，`SET NX` 标记已处理，设置合理 TTL[reference:22]。
2. **数据库唯一索引**：业务表加唯一索引，重复插入报错即忽略[reference:23]。
3. **状态机**：任务有明确状态流转，已处理状态不可重复处理。

```php
// Redis 幂等去重
$messageId = $task['task_id'];
$idempotentKey = "idempotent:task:{$messageId}";

// SET NX 原子操作
$isFirstTime = $redis->set($idempotentKey, '1', ['nx', 'ex' => 86400]);

if (!$isFirstTime) {
    // 已处理过，跳过
    return;
}

processTask($task);
```

### 8.3 死信队列设计

消息重试超过最大次数后，应转入死信队列，避免无限重试。

```php
// 死信队列设计
$maxRetries = 3;
$retryKey = "retry:task:{$messageId}";
$retryCount = $redis->incr($retryKey);
$redis->expire($retryKey, 86400);

if ($retryCount > $maxRetries) {
    // 转入死信队列
    $redis->lPush('dead_letter_queue', json_encode([
        'task' => $task,
        'error' => $errorMessage,
        'retry_count' => $retryCount,
        'failed_at' => date('Y-m-d H:i:s')
    ]));
} else {
    // 重新入队，延迟重试
    $delay = pow(2, $retryCount) * 10; // 指数退避
    addDelayedTask($redis, 'delay_queue', $delay, $task);
}
```

---

## 9. 实战场景

### 9.1 订单超时关闭

**需求**：用户下单后 30 分钟未支付，自动关闭订单。

**方案**：ZSet 延迟队列。

```php
// 下单时添加延迟任务
function onOrderCreated($redis, $orderId) {
    $executeTime = time() + 1800; // 30 分钟
    $redis->zAdd('order_timeout_queue', $executeTime, json_encode([
        'task_id' => "close_order:{$orderId}",
        'order_id' => $orderId,
        'action' => 'close_order'
    ]));
}

// 消费者轮询
function processTimeoutOrders($redis) {
    $luaScript = <<<LUA
local tasks = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
if #tasks > 0 then
    redis.call('ZREM', KEYS[1], unpack(tasks))
end
return tasks
LUA;

    $tasks = $redis->eval($luaScript, ['order_timeout_queue', time(), 20], 1);
    foreach ($tasks as $taskJson) {
        $task = json_decode($taskJson, true);
        $order = getOrder($task['order_id']);
        if ($order && $order['status'] === 'pending') {
            closeOrder($task['order_id']);
        }
    }
}
```

### 9.2 异步任务队列

**需求**：用户注册后异步发送欢迎邮件、短信。

**方案**：Stream 消费者组。

```php
// 生产者
$redis->xAdd('async_tasks', '*', [
    'type' => 'send_welcome_email',
    'user_id' => $userId,
    'email' => $email
]);

// 消费者（多个 worker 水平扩展）
$messages = $redis->xReadGroup('workers', 'worker-1', ['async_tasks' => '>'], 10, 5000);
foreach ($messages['async_tasks'] as $id => $data) {
    try {
        match($data['type']) {
            'send_welcome_email' => sendWelcomeEmail($data),
            'send_sms' => sendSms($data),
        };
        $redis->xAck('async_tasks', 'workers', $id);
    } catch (Exception $e) {
        logError($e);
    }
}
```

### 9.3 延迟重试

**需求**：支付回调失败后，按指数退避策略重试。

**方案**：ZSet 延迟队列 + 死信队列。

```php
function scheduleRetry($redis, $task, $retryCount) {
    $maxRetries = 5;
    if ($retryCount >= $maxRetries) {
        // 转入死信
        $redis->lPush('dead_letter_queue', json_encode($task));
        return;
    }

    // 指数退避：10s, 20s, 40s, 80s, 160s
    $delay = 10 * pow(2, $retryCount);
    $task['retry_count'] = $retryCount + 1;
    $redis->zAdd('retry_queue', time() + $delay, json_encode($task));
}
```

---

## 10. 性能与注意事项

- **List**：`LPUSH` / `RPOP` 时间复杂度 O(1)，性能最好。
- **ZSet**：`ZADD` 复杂度 O(M*log(N))，`ZRANGEBYSCORE` 复杂度 O(log(N)+M)，N 为元素数量[reference:24]。
- **Stream**：`XADD` 复杂度 O(1)，`XREADGROUP` 复杂度 O(log(N))。
- **轮询开销**：ZSet 方案需要轮询，频率越高精度越高但 CPU 消耗越大。秒级精度建议 1 秒轮询[reference:25]。
- **内存占用**：Stream 比 List 占用更多内存，因为需要维护 PEL 和消息 ID。
- **ZSet 不能存重复元素**：如果任务体完全相同，`ZADD` 不会新增，需要用任务 ID 保证唯一性。
- **大 key 风险**：延迟队列可能积累大量任务，注意监控 ZSet 的元素数量和内存占用。
- **持久化**：生产环境必须开启 AOF，确保 Redis 重启后队列数据不丢失。
- **集群限制**：Redis Cluster 下多 key 操作需在同一 slot，Lua 脚本也受此限制。
- **专业 MQ**：对于大规模、高并发、强一致的场景，建议使用 RabbitMQ、Kafka、RocketMQ 等专业消息中间件。

---

## 11. 速查表

### 普通队列

```bash
# List 队列
LPUSH queue msg            # 生产
RPOP queue                 # 消费（非阻塞）
BRPOP queue 30             # 消费（阻塞，超时 30s）
RPOPLPUSH queue processing # 可靠消费

# Stream 队列
XADD stream * field value  # 生产
XREADGROUP GROUP g c COUNT 10 BLOCK 5000 STREAMS stream >  # 消费
XACK stream g id           # 确认
XAUTOCLAIM stream g c 60000 0  # 回收超时消息
```

### 延迟队列

```bash
# ZSet 延迟队列
ZADD delay_queue <timestamp> <task>              # 添加延迟任务
ZRANGEBYSCORE delay_queue -inf <now> LIMIT 0 10  # 查询到期任务
ZREM delay_queue <task>                           # 删除任务

# Lua 原子取出
EVAL "local t=redis.call('ZRANGEBYSCORE',KEYS[1],'-inf',ARGV[1],'LIMIT',0,ARGV[2]);if #t>0 then redis.call('ZREM',KEYS[1],unpack(t)) end;return t" 1 delay_queue <now> 10
```

### 常用命令对比

| 操作 | List | ZSet | Stream |
|---|---|---|---|
| 生产 | LPUSH | ZADD | XADD |
| 消费 | BRPOP | ZRANGEBYSCORE | XREADGROUP |
| 删除 | RPOP 自动 | ZREM | XACK + XDEL |
| 阻塞 | BRPOP | 不支持 | XREADGROUP BLOCK |
| 消费者组 | 不支持 | 不支持 | 支持 |

---

## 12. 总结

- **普通队列**：List + BRPOP 最简单；需要可靠性加 RPOPLPUSH。
- **延迟队列**：ZSet + Lua 脚本是标准方案，秒级精度，实现简单。
- **可靠队列**：Stream 消费者组 + XACK + XAUTOCLAIM，支持消息确认和自动重试。
- **生产环境**：不要用 Keyspace Notification 做延迟队列，不可靠。
- **幂等设计**：所有队列消费端必须保证幂等，用 Redis SET NX 或数据库唯一索引。
- **死信队列**：重试超过上限后转入 DLQ，避免无限重试。
- **持久化**：生产环境开启 AOF，防止 Redis 重启丢数据。
- **选型原则**：简单任务用 List，延迟任务用 ZSet，可靠消费用 Stream，大规模高并发用专业 MQ。

---
