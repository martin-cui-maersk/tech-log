---
title: Redis 其他核心知识点
navTitle: Redis 其他核心知识点
category: Redis
order: 5
description: Redis 其他核心知识点
---

# Redis 其他核心知识点

> 本文覆盖 Redis 常见面试与实战知识点：数据结构、线程模型、过期淘汰、高可用、缓存问题、分布式锁、性能运维等。

## 目录

- [1. 数据结构与底层编码](#1-数据结构与底层编码)
- [2. 线程模型与高性能原理](#2-线程模型与高性能原理)
- [3. 过期删除与内存淘汰](#3-过期删除与内存淘汰)
- [4. 持久化简述](#4-持久化简述)
- [5. 主从复制](#5-主从复制)
- [6. 哨兵 Sentinel](#6-哨兵-sentinel)
- [7. Cluster 集群](#7-cluster-集群)
- [8. 事务](#8-事务)
- [9. Lua 脚本](#9-lua-脚本)
- [10. Pipeline](#10-pipeline)
- [11. 发布订阅与 Stream](#11-发布订阅与-stream)
- [12. 缓存三大问题与一致性](#12-缓存三大问题与一致性)
- [13. 分布式锁](#13-分布式锁)
- [14. 性能与运维](#14-性能与运维)
- [15. 常见命令与安全](#15-常见命令与安全)
- [16. 版本特性](#16-版本特性)
- [17. 总结](#17-总结)

## 1. 数据结构与底层编码

### 1.1 常用数据类型

| 类型 | 说明 | 典型场景 |
|---|---|---|
| String | 二进制安全，最大 512MB | 缓存、计数器、分布式锁 |
| List | 双向链表 / quicklist | 消息队列、最新列表 |
| Hash | 字段值映射 | 对象存储 |
| Set | 无序唯一 | 标签、去重、交并集 |
| ZSet | 有序唯一，按 score 排序 | 排行榜、延迟队列 |
| Bitmap | 位操作 | 签到、布隆过滤器 |
| HyperLogLog | 基数统计，标准误差 0.81% | UV 统计 |
| GEO | 地理位置 | 附近的人、距离计算 |
| Stream | 持久化消息队列 | 消费者组、消息回溯 |

### 1.2 底层编码

- String：SDS（简单动态字符串），支持二进制安全、预分配、惰性释放。
- List：3.2 前 ziplist + linkedlist，3.2+ quicklist，7.0+ listpack + quicklist。
- Hash：ziplist / listpack 或 hashtable。
- Set：intset 或 hashtable。
- ZSet：ziplist / listpack 或 skiplist + dict。
- 7.0 开始逐步用 listpack 替代 ziplist。

常见阈值：

```conf
hash-max-listpack-entries 128
hash-max-listpack-value 64
zset-max-listpack-entries 128
zset-max-listpack-value 64
set-max-intset-entries 512
list-max-listpack-size -2
```

## 2. 线程模型与高性能原理

- Redis 6.0 前：命令执行单线程。
- Redis 6.0+：多线程 IO，但命令执行仍是单线程。
- 后台线程处理：关闭文件、AOF fsync、惰性删除等。
- IO 多路复用：epoll / kqueue / select。
- 高性能原因：
  - 纯内存操作。
  - 单线程避免锁竞争和上下文切换。
  - IO 多路复用。
  - 高效数据结构。
  - 自定义协议 RESP。

## 3. 过期删除与内存淘汰

### 3.1 过期删除

- 惰性删除：访问 key 时判断是否过期。
- 定期删除：周期性随机抽查，删除过期 key。
- 定期删除不是全量扫描，避免阻塞。

### 3.2 内存淘汰策略

| 策略 | 含义 |
|---|---|
| `noeviction` | 不淘汰，写入报错 |
| `allkeys-lru` | 所有 key 中淘汰最近最少使用 |
| `allkeys-lfu` | 所有 key 中淘汰最不经常使用 |
| `allkeys-random` | 所有 key 中随机淘汰 |
| `volatile-lru` | 设置了过期时间的 key 中 LRU |
| `volatile-lfu` | 设置了过期时间的 key 中 LFU |
| `volatile-random` | 设置了过期时间的 key 中随机 |
| `volatile-ttl` | 设置了过期时间的 key 中优先淘汰 TTL 短的 |

配置：

```conf
maxmemory 4gb
maxmemory-policy allkeys-lru
```

## 4. 持久化简述

- RDB：快照，恢复快，文件小，可能丢数据。
- AOF：命令日志，数据更安全，文件更大，恢复慢。
- 混合持久化：RDB 打底 + AOF 增量，4.0+ 支持。
- 启动恢复优先 AOF，AOF 关闭时才用 RDB。
- 生产常用：AOF `everysec` + 混合持久化 + RDB 定期备份。

## 5. 主从复制

- 全量同步：
  - 从节点发送 `PSYNC`。
  - 主节点 `BGSAVE` 生成 RDB。
  - 发送 RDB，期间写命令写入 repl buffer。
  - 从节点加载 RDB，再重放 buffer。
- 增量同步：
  - 基于 `repl_backlog`、`runid`、`offset`。
  - 断线重连后尽量增量同步。
- 特点：
  - 异步复制，存在延迟。
  - 读写分离，从节点可分担读。
  - 主从切换需配合哨兵或 Cluster。
- 注意：
  - 复制风暴：多个从节点同时全量同步。
  - 主从延迟导致读到旧数据。

## 6. 哨兵 Sentinel

- 功能：监控、通知、自动故障转移、配置中心。
- 主观下线：单个 Sentinel 认为节点不可用。
- 客观下线：多个 Sentinel 确认，达到 quorum。
- 领导者选举：Raft 算法选出 Sentinel 领导者。
- 故障转移：选新主、切换从节点、通知客户端。
- 脑裂：
  - 原主可能仍在写。
  - 可用 `min-replicas-to-write`、`min-replicas-max-lag` 降低风险。

## 7. Cluster 集群

- 分片：16384 个 slot，`CRC16(key) % 16384`。
- 节点通信：Gossip 协议。
- 重定向：
  - `MOVED`：slot 已迁移。
  - `ASK`：临时重定向。
- 故障转移：主节点故障，从节点提升。
- 限制：
  - 多 key 操作需在同一 slot。
  - 可用 hash tag `{user}:1`、`{user}:2` 保证同 slot。
  - Lua 脚本、事务也受 slot 限制。
- 集群总线端口：默认 10000 + 端口。

## 8. 事务

- 命令：`MULTI`、`EXEC`、`DISCARD`、`WATCH`。
- 特点：
  - 命令入队，`EXEC` 时顺序执行。
  - 不支持回滚。
  - 语法错误导致入队失败，`EXEC` 整体失败。
  - 运行时错误继续执行，其他命令不受影响。
- `WATCH`：乐观锁，监控 key 是否被修改。
- 与 Lua 区别：Lua 更灵活，可做复杂逻辑，原子性更强。

## 9. Lua 脚本

- 原子性：脚本执行期间阻塞其他命令。
- 命令：`EVAL`、`EVALSHA`、`SCRIPT LOAD`。
- 优点：
  - 减少网络往返。
  - 复杂逻辑原子执行。
- 注意：
  - 不要写死循环或长时间运行。
  - 避免随机命令导致主从不一致。
  - 使用 `redis.call` / `redis.pcall`。
  - 脚本尽量短小。

## 10. Pipeline

- 批量发送命令，减少 RTT。
- 不保证原子性，可能被其他命令插入。
- 适合批量读写，不适合超大 batch。
- 与事务区别：
  - Pipeline 是网络优化。
  - 事务是命令打包执行。

## 11. 发布订阅与 Stream

### 11.1 Pub/Sub

- 命令：`PUBLISH`、`SUBSCRIBE`、`PSUBSCRIBE`。
- 特点：
  - 不持久化。
  - 不保证送达。
  - 适合实时通知，不适合可靠消息。

### 11.2 Stream

- 命令：`XADD`、`XREAD`、`XREADGROUP`、`XACK`、`XPENDING`、`XCLAIM`。
- 特点：
  - 持久化。
  - 支持消费者组。
  - 支持 ACK、待处理列表、消息回溯。
  - 适合轻量级消息队列。

## 12. 缓存三大问题与一致性

### 12.1 缓存穿透

- 问题：查询不存在的数据，请求打到数据库。
- 解决：
  - 布隆过滤器。
  - 空值缓存，设置短 TTL。
  - 接口限流、参数校验。

### 12.2 缓存击穿

- 问题：热点 key 过期，大量请求打到数据库。
- 解决：
  - 互斥锁，只让一个请求重建缓存。
  - 逻辑过期，异步更新。
  - 热点 key 永不过期。

### 12.3 缓存雪崩

- 问题：大量 key 同时过期或 Redis 宕机。
- 解决：
  - 过期时间加随机值。
  - 高可用架构：主从、哨兵、Cluster。
  - 限流、降级、熔断。
  - 多级缓存。

### 12.4 缓存一致性

- 常用模式：Cache Aside。
- 推荐：先更新数据库，再删除缓存。
- 延迟双删：更新 DB 后删缓存，延迟再删一次。
- 最终一致：订阅 binlog，异步更新缓存。
- 强一致很难，通常追求最终一致。

## 13. 分布式锁

- 基本实现：

```lua
SET lock_key unique_value NX PX 30000
```

- 释放锁：Lua 脚本比较 value 再删除，避免误删。
- 续期：Redisson 看门狗机制。
- Redlock：多节点加锁，存在争议。
- 注意：
  - 锁过期时间要合理。
  - 业务执行时间可能超过锁时间。
  - 必须保证解锁原子性。

## 14. 性能与运维

### 14.1 慢查询

```conf
slowlog-log-slower-than 10000
slowlog-max-len 128
```

- 查看：`SLOWLOG GET`、`SLOWLOG LEN`、`SLOWLOG RESET`。

### 14.2 大 key

- 定义：
  - String > 10KB。
  - 集合元素 > 5000。
- 发现：
  - `redis-cli --bigkeys`
  - `SCAN` + `MEMORY USAGE`
- 处理：
  - 拆分 key。
  - 使用 `UNLINK` 异步删除。
  - 避免 `DEL` 阻塞。

### 14.3 热 key

- 发现：
  - `MONITOR`（慎用）。
  - 代理层统计。
  - `redis-cli --hotkeys`。
- 处理：
  - 本地缓存。
  - 读写分离。
  - key 打散。
  - 限流。

### 14.4 内存与连接

- 内存碎片：`mem_fragmentation_ratio`。
- 碎片整理：`activedefrag`。
- 连接：`maxclients`、`timeout`、`tcp-keepalive`。
- 监控：`INFO`、QPS、命中率、内存、连接数、延迟。

## 15. 常见命令与安全

### 15.1 常见命令

- 通用：`TYPE`、`TTL`、`EXPIRE`、`PERSIST`、`SCAN`。
- 批量：`MGET`、`MSET`、Pipeline。
- 运维：`INFO`、`CLIENT LIST`、`CONFIG GET`。
- 慎用：`KEYS`、`FLUSHALL`、`FLUSHDB`、`MONITOR`。

### 15.2 安全

```conf
bind 127.0.0.1
requirepass yourpassword
rename-command KEYS ""
rename-command FLUSHALL ""
```

- 使用 ACL 控制用户权限。
- 不要暴露公网。
- 开启防火墙、SSL。

## 16. 版本特性

| 版本 | 主要特性 |
|---|---|
| 4.0 | 模块、混合持久化、LFU、UNLINK |
| 5.0 | Stream、新 ZSet 命令 |
| 6.0 | 多线程 IO、ACL、SSL、RESP3 |
| 7.0 | Multi-part AOF、Function、Sharded Pub/Sub、listpack |
| 8.0 | 新特性持续演进，关注官方发布 |

## 17. 总结

- 缓存场景：关注穿透、击穿、雪崩、一致性。
- 高可用：主从 + 哨兵 / Cluster。
- 数据安全：RDB + AOF 混合持久化 + 定期备份。
- 性能：避免大 key、热 key、慢查询、阻塞命令。
- 分布式锁：SET NX PX + Lua 释放 + 续期。
- 消息队列：轻量用 Stream，可靠消息建议专业 MQ。
- 生产原则：监控、限流、降级、备份、恢复演练。
