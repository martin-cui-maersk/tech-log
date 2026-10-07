---
title: MySQL 事务隔离级别详解
navTitle: 事务隔离级别详解
category: MySQL
order: 4
slug: mysql-transaction-isolation-levels
description: MySQL 中的“隔离模式”通常指 事务隔离级别（Transaction Isolation Level）。 它用于解决多个事务并发执行时产生的 脏读、不可重复读、幻读 等问题，本质是在 数据一致性 和 并发性能 之间做权衡。
---

# MySQL 事务隔离级别详解

> MySQL 中的“隔离模式”通常指 **事务隔离级别（Transaction Isolation Level）**。
> 它用于解决多个事务并发执行时产生的 **脏读、不可重复读、幻读** 等问题，本质是在 **数据一致性** 和 **并发性能** 之间做权衡。

## 目录

- [1. 并发事务常见问题](#1-并发事务常见问题)
- [2. MySQL 四种事务隔离级别](#2-mysql-四种事务隔离级别)
- [3. 每种隔离级别解决什么问题](#3-每种隔离级别解决什么问题)
  - [3.1 READ UNCOMMITTED](#31-read-uncommitted)
  - [3.2 READ COMMITTED](#32-read-committed)
  - [3.3 REPEATABLE READ](#33-repeatable-read)
  - [3.4 SERIALIZABLE](#34-serializable)
- [4. MySQL InnoDB 的实现机制](#4-mysql-innodb-的实现机制)
- [5. 查看和设置隔离级别](#5-查看和设置隔离级别)
- [6. 实际使用建议](#6-实际使用建议)
- [7. 总结](#7-总结)

## 1. 并发事务常见问题

| 问题 | 含义 |
|---|---|
| 脏读 | 事务 A 读到了事务 B **未提交** 的数据，B 回滚后 A 读到的就是脏数据 |
| 不可重复读 | 同一事务内两次读同一行，结果不同，因为其他事务提交了修改 |
| 幻读 | 同一事务内两次执行相同范围查询，结果集行数不同，因为其他事务插入/删除了数据 |
| 丢失更新 | 两个事务同时更新同一行，后提交的覆盖了先提交的，通常用锁或版本号解决 |

## 2. MySQL 四种事务隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 说明 |
|---|---|---|---|---|
| READ UNCOMMITTED 读未提交 | 可能 | 可能 | 可能 | 几乎不用，能读到未提交数据 |
| READ COMMITTED 读已提交 | 解决 | 可能 | 可能 | Oracle、PostgreSQL 默认；互联网高并发常用 |
| REPEATABLE READ 可重复读 | 解决 | 解决 | InnoDB 基本解决 | **MySQL 默认** |
| SERIALIZABLE 串行化 | 解决 | 解决 | 解决 | 全部加锁串行执行，并发最差 |

## 3. 每种隔离级别解决什么问题

### 3.1 READ UNCOMMITTED

- 最低级别。
- 事务可以读到其他事务未提交的数据。
- 什么问题都不解决，基本不用。

### 3.2 READ COMMITTED

- 只能读到其他事务 **已提交** 的数据。
- 解决：**脏读**。
- 未解决：**不可重复读、幻读**。
- 实现：每次 `SELECT` 都生成新的 Read View，所以能看到最新提交。
- 特点：并发较好，但同一事务内多次读可能不一致。

### 3.3 REPEATABLE READ

- MySQL InnoDB 默认级别。
- 解决：**脏读、不可重复读**。
- 幻读：
  - **快照读**：通过 MVCC 保证同一事务内读到的数据版本一致，不会幻读。
  - **当前读**：如 `SELECT ... FOR UPDATE`、`UPDATE`、`DELETE`，通过 **Next-Key Lock（临键锁 = 记录锁 + 间隙锁）** 阻止其他事务插入，基本解决幻读。
- 实现：事务第一次 `SELECT` 时生成 Read View，之后复用。
- 代价：间隙锁容易导致死锁，并发不如 RC。

### 3.4 SERIALIZABLE

- 最高级别。
- 读加共享锁，写加排他锁，事务串行执行。
- 解决：**脏读、不可重复读、幻读**。
- 代价：并发性能极差，一般只用于强一致、低并发场景。

## 4. MySQL InnoDB 的实现机制

### 4.1 MVCC（多版本并发控制）

- 通过 undo log + Read View 实现一致性读。
- RC：每次 `SELECT` 新建 Read View。
- RR：第一次 `SELECT` 建 Read View，后续复用。

### 4.2 Next-Key Lock

- 记录锁 + 间隙锁。
- RR 下用于防止当前读幻读。
- RC 下一般只加记录锁，不加间隙锁，所以 RC 可能有幻读。

### 4.3 间隙锁

- 锁住索引记录之间的间隙，防止插入。
- 只在 RR 及以下部分场景使用。

## 5. 查看和设置隔离级别

查看：

```sql
SELECT @@transaction_isolation;
-- MySQL 5.7 可能是：
SELECT @@tx_isolation;
```

设置会话级别：

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

设置全局级别：

```sql
SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

配置文件：

```ini
[mysqld]
transaction-isolation = READ-COMMITTED
```

## 6. 实际使用建议

- **默认用 REPEATABLE READ**：MySQL 默认，数据一致性较好。
- **高并发互联网业务常用 READ COMMITTED**：
  - 减少间隙锁，降低死锁概率。
  - 提高并发。
  - 但需要配合 `binlog_format=ROW`，否则 statement 格式可能导致主从不一致。
- **金融、强一致场景**：
  - 可用 RR，必要时用 `SELECT ... FOR UPDATE`。
  - 串行化性能太差，慎用。
- **丢失更新**：
  - 隔离级别不直接解决。
  - 用乐观锁（版本号）或悲观锁（`FOR UPDATE`）解决。

## 7. 总结

MySQL 的四种事务隔离级别，本质是在 **数据一致性** 和 **并发性能** 之间做权衡：

- 读未提交：什么都不解决。
- 读已提交：解决脏读。
- 可重复读：解决脏读、不可重复读，InnoDB 下基本解决幻读。
- 串行化：全部解决，但性能最差。

生产上：**MySQL 默认 RR；互联网高并发常用 RC + ROW binlog；强一致场景用 RR 或加锁。**
