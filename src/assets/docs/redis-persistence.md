---
title: Redis AOF 与 RDB 持久化对比及使用指南
navTitle: Redis 持久化
category: Redis
order: 4
description: Redis AOF 与 RDB 持久化对比及使用指南
---
# Redis AOF 与 RDB 持久化对比及使用指南

> 一句话：RDB 是“拍快照”，AOF 是“记流水账”。
> 生产常用：RDB 定期备份 + AOF everysec + 混合持久化。

## 目录

- [1. 核心区别](#1-核心区别)
- [2. 恢复优先级](#2-恢复优先级)
- [3. AOF 刷盘策略](#3-aof-刷盘策略)
- [4. 一般怎么用](#4-一般怎么用)
  - [4.1 普通生产业务，推荐组合](#41-普通生产业务推荐组合)
  - [4.2 纯缓存，数据可从数据库重建](#42-纯缓存数据可从数据库重建)
  - [4.3 极高数据安全，如订单、支付](#43-极高数据安全如订单支付)
  - [4.4 大数据量、高写入](#44-大数据量高写入)
- [5. 推荐配置示例](#5-推荐配置示例)
- [6. 运维注意事项](#6-运维注意事项)
- [7. 选型速查](#7-选型速查)
- [8. 总结](#8-总结)

## 1. 核心区别

| 维度 | RDB | AOF |
|---|---|---|
| 持久化内容 | 某一时刻的全量数据二进制快照 | 追加写命令日志；4.0+ 可混合：RDB 打底 + AOF 增量 |
| 触发方式 | `SAVE` / `BGSAVE`、`save m n`、关机、主从全量同步 | 写命令实时追加；`BGREWRITEAOF` 重写 |
| 数据安全 | 较低，丢两次快照之间的数据 | 较高：`everysec` 通常最多丢 1 秒，`always` 几乎不丢 |
| 文件大小 | 小、紧凑 | 通常更大 |
| 恢复速度 | 快，直接加载内存 | 慢，要重放命令；混合持久化后快很多 |
| 性能影响 | fork + COW，大数据量时可能内存膨胀、延迟抖动 | `fsync` 影响写性能；重写也会 fork |
| 可读性 | 二进制，不可读 | 旧版是文本命令；7.0 多部分 AOF，base 可能是 RDB |
| 适用场景 | 备份、灾难恢复、可容忍分钟级丢失 | 核心数据、要求低丢失 |

## 2. 恢复优先级

- 如果 `appendonly yes`，Redis 启动时优先从 AOF 恢复。
- 如果 AOF 不存在或不可用，才会考虑 RDB。
- 如果 AOF 存在但损坏，不会自动用 RDB 兜底，需要修复 AOF，或临时关闭 AOF 后再启动。
- 只有 AOF 关闭时，才主要从 RDB 恢复。

所以同时开启 AOF 和 RDB 时，RDB 主要用来备份、迁移，而不是启动恢复的首选。

## 3. AOF 刷盘策略

| 配置 | 含义 | 安全性 | 性能 |
|---|---|---|---|
| `appendfsync always` | 每条写命令都 fsync | 最高，几乎不丢 | 最差 |
| `appendfsync everysec` | 每秒 fsync | 较高，通常最多丢 1 秒 | 推荐默认 |
| `appendfsync no` | 交给操作系统决定 | 最低，丢失窗口不可控 | 最好 |

## 4. 一般怎么用

### 4.1 普通生产业务，推荐组合

- `appendonly yes`
- `appendfsync everysec`
- `aof-use-rdb-preamble yes`，开启混合持久化
- 同时保留 RDB 定时快照，用于冷备、迁移、快速恢复
- 配合主从、哨兵或 Cluster

### 4.2 纯缓存，数据可从数据库重建

- 可以 `appendonly no`
- 甚至可以关闭 RDB
- 建议至少保留低频 RDB，方便重启预热

### 4.3 极高数据安全，如订单、支付

- `appendonly yes`
- `appendfsync always`
- 必须配合主从 / 集群、定期备份
- 上线前压测确认性能可接受

### 4.4 大数据量、高写入

- 注意 fork、COW 内存膨胀、AOF 重写和磁盘 IO
- 可考虑在从库做持久化
- 但要做好故障切换，避免空主覆盖从库

## 5. 推荐配置示例

```conf
appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes

save 900 1
save 300 10
save 60 10000

dbfilename dump.rdb
dir /var/lib/redis
```

Redis 7.0 默认使用 multi-part AOF，AOF 文件在 `appendonlydir` 下，由 manifest 管理 base 和 incr 文件。

## 6. 运维注意事项

- AOF 文件损坏可用 `redis-check-aof --fix` 修复。
- RDB 文件可用 `redis-check-rdb` 检查。
- AOF 重写是根据当前内存数据生成新 AOF，不是回放旧 AOF。
- 同时开 AOF 和 RDB 时，不要以为 RDB 会自动兜底；启动恢复优先 AOF。
- 无论选哪种，都要定期把 `dump.rdb` 或 `appendonlydir` 备份到远程。
- 定期做恢复演练，确认备份真的可用。

## 7. 选型速查

| 场景 | 建议 |
|---|---|
| 纯缓存，可重建 | 关闭 AOF，低频 RDB 或直接不持久化 |
| 普通生产 | AOF `everysec` + 混合持久化 + RDB 备份 + 主从 |
| 不能容忍超过 1 秒丢失 | AOF `everysec` + 多副本，必要时评估 `always` |
| 极高安全要求 | AOF `always` + 主从/集群 + 定期备份 + 压测 |
| 大数据量高写入 | 注意 fork / COW / AOF 重写，可考虑从库持久化 |

## 8. 总结

- RDB：快照，恢复快，文件小，但可能丢数据。
- AOF：日志，数据更安全，但文件更大，恢复更慢。
- 生产推荐：**RDB 定期备份 + AOF everysec + 混合持久化 + 主从/集群**。
- 极端安全：**AOF always + 多副本 + 定期备份 + 恢复演练**。
