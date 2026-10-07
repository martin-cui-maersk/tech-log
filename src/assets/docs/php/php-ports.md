  ---
title: PHP 常用端口完整指南
navTitle: PHP 常用端口
category: PHP
order: 1
description: PHP 开发与部署中涉及的常用端口、配置方法及冲突排查
---
# PHP 常用端口完整指南

> **适用场景**：PHP 开发、部署、运维过程中，需要了解各服务默认端口、修改端口配置或排查端口冲突。
> **核心说明**：PHP 本身是一种服务器端脚本语言，不直接监听任何端口[reference:0]。PHP 通过 Web 服务器（Nginx / Apache）接收请求，并通过 PHP-FPM 与 Web 服务器通信，再连接数据库、缓存等服务。本文列出 PHP 生态中常见的端口及其用途。

---

## 目录

- [1. PHP 端口基础概念](#1-php-端口基础概念)
- [2. Web 服务器端口](#2-web-服务器端口)
  - [2.1 Nginx 默认端口](#21-nginx-默认端口)
  - [2.2 Apache 默认端口](#22-apache-默认端口)
- [3. PHP-FPM 端口](#3-php-fpm-端口)
  - [3.1 默认 TCP 端口 9000](#31-默认-tcp-端口-9000)
  - [3.2 Unix Socket 方式](#32-unix-socket-方式)
  - [3.3 修改 PHP-FPM 端口](#33-修改-php-fpm-端口)
- [4. 数据库端口](#4-数据库端口)
  - [4.1 MySQL / MariaDB（3306）](#41-mysql--mariadb3306)
  - [4.2 PostgreSQL（5432）](#42-postgresql5432)
  - [4.3 MongoDB（27017）](#43-mongodb27017)
- [5. 缓存与队列端口](#5-缓存与队列端口)
  - [5.1 Redis（6379）](#51-redis6379)
  - [5.2 Memcached（11211）](#52-memcached11211)
- [6. 调试与开发工具端口](#6-调试与开发工具端口)
  - [6.1 Xdebug（9003 / 9000）](#61-xdebug9003--9000)
  - [6.2 PHP 内置 Web 服务器（8000）](#62-php-内置-web-服务器8000)
- [7. 其他常用端口](#7-其他常用端口)
- [8. 端口冲突排查（重点）](#8-端口冲突排查重点)
- [9. 端口速查表](#9-端口速查表)
- [10. 注意事项](#10-注意事项)

---

## 1. PHP 端口基础概念

PHP 本身不占用端口，它是一种运行在 Web 服务器上的脚本语言。PHP 请求的处理链路如下：

```
客户端 → Web服务器（Nginx/Apache，监听80/443） → PHP-FPM（监听9000或Unix Socket） → 数据库/缓存（3306/6379等）
```

- **Web 服务器端口**：对外提供 HTTP/HTTPS 服务，默认 80 / 443。
- **PHP-FPM 端口**：Web 服务器将 `.php` 请求转发给 PHP-FPM 处理，默认 9000/TCP 或 Unix Socket[reference:1]。
- **数据库端口**：PHP 通过扩展（mysqli / PDO / pgsql / mongodb）连接数据库。
- **缓存端口**：PHP 通过扩展（Redis / Memcached）连接缓存服务。

---

## 2. Web 服务器端口

### 2.1 Nginx 默认端口

| 端口 | 协议 | 用途 |
|---|---|---|
| 80 | TCP | HTTP，未加密的网页请求 |
| 443 | TCP | HTTPS，通过 SSL/TLS 加密的网页请求 |

Nginx 默认监听 80（HTTP）和 443（HTTPS）[reference:2]。可在 `server` 块中修改：

```nginx
server {
    listen 8080;           # 修改 HTTP 端口
    listen 443 ssl http2;  # 保留 HTTPS
    # ...
}
```

修改后重载：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 2.2 Apache 默认端口

Apache 默认监听 80 端口，启用 SSL 后监听 443 端口[reference:3]。可在配置文件中修改：

```apache
Listen 8080
```

---

## 3. PHP-FPM 端口

### 3.1 默认 TCP 端口 9000

PHP-FPM 默认监听 `127.0.0.1:9000`，Web 服务器将 `.php` 请求转发到该端口[reference:4][reference:5]。

配置文件位置（以 Ubuntu 为例）：

```
/etc/php/{php_version}/fpm/pool.d/www.conf
```

默认配置：

```ini
listen = 127.0.0.1:9000
```

### 3.2 Unix Socket 方式

生产环境更推荐使用 Unix Socket，性能更好且无需开放 TCP 端口[reference:6]：

```ini
listen = /run/php/php8.1-fpm.sock
```

Nginx 对应配置：

```nginx
fastcgi_pass unix:/run/php/php8.1-fpm.sock;
```

使用 Socket 方式时，无需在防火墙中放行 9000/TCP[reference:7]。

### 3.3 修改 PHP-FPM 端口

编辑 `www.conf`，修改 `listen` 项：

```ini
listen = 127.0.0.1:9001
```

重启 PHP-FPM 生效：

```bash
sudo systemctl restart php{version}-fpm
```

同时更新 Nginx / Apache 的 `fastcgi_pass` 配置。

---

## 4. 数据库端口

### 4.1 MySQL / MariaDB（3306）

MySQL 默认端口为 **3306**。PHP 的 `mysqli` 和 `PDO_MySQL` 扩展默认使用 3306 端口[reference:8]。

PHP 配置（`php.ini`）：

```ini
mysqli.default_port = 3306
mysqli.default_socket = /tmp/mysql.sock
```

PHP 连接示例：

```php
$mysqli = new mysqli("127.0.0.1", "user", "password", "database", 3306);
```

> **注意**：`localhost` 在 PHP 中表示使用 Unix Socket 连接，而非 TCP[reference:9]。如需 TCP 连接，使用 `127.0.0.1`。

### 4.2 PostgreSQL（5432）

PostgreSQL 默认端口为 **5432**[reference:10]。

PHP 连接示例：

```php
$conn = pg_connect("host=127.0.0.1 port=5432 dbname=mydb user=postgres password=secret");
```

### 4.3 MongoDB（27017）

MongoDB 默认端口为 **27017**。PHP MongoDB 驱动如果不指定端口，默认使用 27017[reference:11]。

PHP 连接示例：

```php
$client = new MongoDB\Client("mongodb://127.0.0.1:27017");
```

---

## 5. 缓存与队列端口

### 5.1 Redis（6379）

Redis 默认端口为 **6379**。PHP 通过 `phpredis` 扩展或 `predis` 库连接[reference:12]。

```php
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);
```

Laravel 等框架配置：

```php
'redis' => [
    'host' => env('REDIS_HOST', '127.0.0.1'),
    'port' => env('REDIS_PORT', 6379),
],
```

### 5.2 Memcached（11211）

Memcached 默认端口为 **11211**。PHP `memcache` / `memcached` 扩展默认连接 11211 端口[reference:13]。

```php
$mem = new Memcached();
$mem->addServer('127.0.0.1', 11211);
```

---

## 6. 调试与开发工具端口

### 6.1 Xdebug（9003 / 9000）

Xdebug 2 默认端口为 **9000**，Xdebug 3 默认端口改为 **9003**，以避免与 PHP-FPM 的 9000 端口冲突[reference:14]。

`php.ini` 配置（Xdebug 3）：

```ini
xdebug.mode = debug
xdebug.client_port = 9003
xdebug.client_host = 127.0.0.1
xdebug.idekey = PHPSTORM
```

PhpStorm 默认同时监听 9003 和 9000 两个端口，兼容新旧版本[reference:15]。

### 6.2 PHP 内置 Web 服务器（8000）

PHP 内置开发服务器默认监听 **8000** 端口[reference:16]：

```bash
php -S 0.0.0.0:8000 -t public/
```

也可指定其他端口：

```bash
php -S 0.0.0.0:8080 -t public/
```

---

## 7. 其他常用端口

| 服务 | 默认端口 | 说明 |
|---|---|---|
| FTP | 21 | 文件传输控制端口 |
| SSH | 22 | 远程登录 |
| SMTP | 25 / 465 | 邮件发送 |
| DNS | 53 | 域名解析 |
| HTTP（备用） | 8080 | 常用备用 HTTP 端口 |
| phpMyAdmin | 888 | 部分面板的默认端口 |

---

## 8. 端口冲突排查（重点）

| 错误现象 | 可能原因 | 解决方法 |
|---|---|---|
| `Address already in use` | 端口被其他进程占用 | 用 `netstat` 或 `lsof` 查找占用进程并停止或更换端口 |
| PHP-FPM 启动失败 | 9000 端口被 Xdebug 2 占用 | 将 Xdebug 升级到 3（默认 9003），或修改 PHP-FPM 端口[reference:17] |
| Nginx 启动失败 | 80 / 443 被 Apache 或其他服务占用 | 停止冲突服务，或修改 Nginx 监听端口 |
| 数据库连接超时 | 防火墙未放行 3306 / 5432 / 6379 | 检查防火墙和安全组规则 |
| Web 服务器无法访问 PHP-FPM | Socket 路径不匹配 | 确认 `fastcgi_pass` 与 PHP-FPM 的 `listen` 配置一致 |

**排查命令：**

```bash
# 查看端口占用
sudo netstat -tulnp | grep 9000
# 或
sudo lsof -i :9000
# 或
ss -tulpen | grep ':9000'

# 查看所有监听端口
sudo netstat -tulnp
```

**防火墙放行（Ubuntu UFW）：**

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3306/tcp   # MySQL
sudo ufw allow 6379/tcp   # Redis（生产环境建议限制来源）
```

**防火墙放行（CentOS firewalld）：**

```bash
sudo firewall-cmd --permanent --zone=public --add-port=80/tcp
sudo firewall-cmd --permanent --zone=public --add-port=443/tcp
sudo firewall-cmd --reload
```

---

## 9. 端口速查表

| 服务 | 默认端口 | 协议 | 用途 |
|---|---|---|---|
| HTTP | 80 | TCP | 网页访问 |
| HTTPS | 443 | TCP | 加密网页访问 |
| Apache | 80 / 443 | TCP | Web 服务器 |
| Nginx | 80 / 443 | TCP | Web 服务器 |
| PHP-FPM | 9000 | TCP | FastCGI 进程管理 |
| PHP 内置服务器 | 8000 | TCP | 开发调试 |
| MySQL / MariaDB | 3306 | TCP | 关系型数据库 |
| PostgreSQL | 5432 | TCP | 关系型数据库 |
| MongoDB | 27017 | TCP | 文档数据库 |
| Redis | 6379 | TCP | 缓存 / 消息队列 |
| Memcached | 11211 | TCP | 缓存 |
| Xdebug 3 | 9003 | TCP | 调试器 |
| Xdebug 2 | 9000 | TCP | 调试器（旧版） |
| FTP | 21 | TCP | 文件传输 |
| SSH | 22 | TCP | 远程登录 |

---

## 10. 注意事项

- PHP 本身不监听端口，端口属于 Web 服务器、PHP-FPM、数据库等周边服务。
- PHP-FPM 推荐使用 Unix Socket 替代 TCP 9000，性能更好且无需开放端口。
- Xdebug 3 默认端口为 9003，避免与 PHP-FPM 的 9000 冲突。升级 Xdebug 后需同步更新 IDE 配置。
- MySQL 的 `localhost` 在 PHP 中走 Unix Socket，`127.0.0.1` 走 TCP。连接问题排查时需注意这一区别。
- 数据库和缓存端口（3306、5432、6379、11211）在生产环境应限制访问来源，不要对公网开放。
- 云服务器需同时检查安全组 / NACL 的入站规则，仅放行必要端口。
- 修改任何端口后，需同步更新防火墙、Web 服务器配置、PHP 连接配置和 IDE 调试配置。

---
