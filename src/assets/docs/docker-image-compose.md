---
title: Docker 镜像瘦身与 Compose 编排实战
navTitle: Docker 实战
category: Docker
order: 10
description: 分层与构建缓存、多阶段构建瘦身、CMD/ENTRYPOINT 与信号坑、PHP 项目 Compose 编排、排查命令
---
# Docker 镜像瘦身与 Compose 编排实战

> **适用场景**：镜像 1 GB 起步、每次构建都要重装依赖、容器停不掉（信号没传到）、挂载卷权限 500、`depends_on` 起来了但数据库还没好。
> **一句话原则**：镜像大小靠**多阶段构建 + 精简基础镜像**，构建速度靠**分层顺序**，容器稳定靠**正确的入口与健康检查**。

## 目录

- [1. 分层与构建缓存](#1-分层与构建缓存)
- [2. 多阶段构建与镜像瘦身](#2-多阶段构建与镜像瘦身)
- [3. 七个最常见的坑](#3-七个最常见的坑)
- [4. 一个可用的 PHP 项目 Dockerfile](#4-一个可用的-php-项目-dockerfile)
- [5. Compose 编排](#5-compose-编排)
- [6. 资源限制与日志](#6-资源限制与日志)
- [7. 排查命令](#7-排查命令)
- [8. 上线检查清单](#8-上线检查清单)

---

## 1. 分层与构建缓存

每条 `RUN`/`COPY`/`ADD` 都是一层，**上一层缓存失效，后面所有层都要重建**。

```dockerfile
# ✗ 改一行代码，composer install 全部重跑
COPY . /app
RUN composer install --no-dev

# ✓ 依赖文件没变就能命中缓存
COPY composer.json composer.lock /app/
RUN composer install --no-dev --no-scripts --no-autoloader
COPY . /app
RUN composer dump-autoload --optimize
```

**顺序原则**：变化频率低的放前面（基础镜像 → 系统依赖 → 语言依赖清单 → 源码）。

`.dockerignore` 一定要写，否则 `COPY . .` 会把 `node_modules`、`.git`、`vendor`、日志全打进上下文，构建又慢又大：

```
.git
.idea
node_modules
vendor
storage/logs
*.log
.env
tests
```

```bash
docker build --no-cache -t app:test .     # 强制不用缓存
DOCKER_BUILDKIT=1 docker build -t app .   # 用 BuildKit，支持 cache mount
docker history --no-trunc app:latest      # 看每层大小，定位"哪层胖了"
dive app:latest                           # 交互式分析层与浪费空间
```

BuildKit 的缓存挂载能把 composer/npm 缓存留在构建机，不污染镜像：

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=cache,target=/root/.composer \
    composer install --no-dev --no-interaction
```

---

## 2. 多阶段构建与镜像瘦身

```dockerfile
# syntax=docker/dockerfile:1
# ---------- 构建阶段：编译扩展、装依赖，产物只带走需要的文件 ----------
FROM php:8.2-fpm-alpine AS builder

RUN apk add --no-cache $PHPIZE_DEPS \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql opcache

WORKDIR /app
COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/root/.composer \
    composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

# ---------- 运行阶段：只带运行时需要的东西 ----------
FROM php:8.2-fpm-alpine

# 复制构建阶段编译好的扩展
COPY --from=builder /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=builder /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/
COPY --from=builder /app/vendor /app/vendor
COPY . /app

WORKDIR /app
```

| 基础镜像 | 体积量级 | 特点 |
| --- | --- | --- |
| `debian` / `bookworm` | 100 MB+ | glibc，兼容性最好，扩展好装 |
| `slim` | 70 MB 左右 | 去掉文档和部分工具，仍是 glibc |
| `alpine` | 5~10 MB | musl libc：**体积最小**，但少数预编译二进制跑不了、时区/字体要自己装 |
| `distroless` | 更小 | 没有 shell，安全性好，**排障困难**（进不去） |

选型建议：**能接受 musl 就用 alpine，扩展编译麻烦或有 .so 依赖就用 slim**；别为了省 20 MB 让自己排障时进不去容器。

---

## 3. 七个最常见的坑

### 3.1 `CMD` vs `ENTRYPOINT`，与 exec/shell 形式

```dockerfile
# exec 形式：进程就是 PID 1，能收到 SIGTERM，能优雅退出 ✓
ENTRYPOINT ["php-fpm", "-F"]
CMD ["--nodaemonize"]

# shell 形式：PID 1 是 /bin/sh，docker stop 的信号传不到应用 ✗
CMD php-fpm -F
```

- `ENTRYPOINT` 固定入口，`CMD` 提供默认参数（可被 `docker run` 覆盖）；
- 容器里 PID 1 要负责**回收僵尸进程 + 转发信号**，应用做不到就加 `init: true`（Compose）或 `docker run --init`；
- 现象："`docker stop` 要等 10 秒才被 `SIGKILL` 干掉" → 十有八九是信号没传到。

### 3.2 时区

```dockerfile
# alpine 默认没有时区数据
RUN apk add --no-cache tzdata \
 && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
 && echo "Asia/Shanghai" > /etc/timezone
ENV TZ=Asia/Shanghai
```

PHP 还要确认 `date.timezone`；只在 `docker run -e TZ=...` 里设而镜像里没有 tzdata，时间仍然不对。

### 3.3 中文与字体

生成 PDF/图片、导出 Excel 时缺字体会变方块：

```dockerfile
RUN apk add --no-cache font-noto-cjk ttf-dejavu
```

### 3.4 挂载卷的权限

容器内用户 UID 与宿主机目录属主不一致 → 写不进去：

```yaml
services:
  php:
    user: "1000:1000"          # 对齐宿主机 UID:GID
```

或在镜像里创建同 UID 的用户：

```dockerfile
ARG UID=1000
RUN adduser -u ${UID} -D -s /bin/sh app && chown -R app:app /app
USER app
```

### 3.5 容器里的 `localhost` 不是宿主机

容器内的 `127.0.0.1` 指容器自己。Compose 内用**服务名**互访（`mysql:3306`），连宿主机用 `host.docker.internal`（Mac/Windows）或宿主内网 IP（Linux）。

### 3.6 `ENV` 与 `ARG`，以及别把密钥写进构建参数

| 指令 | 生效范围 | 是否留在镜像 |
| --- | --- | --- |
| `ENV` | 构建 + 运行时 | 是（`docker inspect` 能看到） |
| `ARG` | 仅构建期 | 不在最终环境变量里，但**会出现在 `docker history`** |

密钥要用 BuildKit secret：

```dockerfile
RUN --mount=type=secret,id=composer_auth \
    COMPOSER_AUTH="$(cat /run/secrets/composer_auth)" composer install --no-dev
```

```bash
DOCKER_BUILDKIT=1 docker build --secret id=composer_auth,src=auth.json -t app .
```

### 3.7 日志写文件而不是 stdout

容器应该**把日志打到 stdout/stderr**，由 Docker 收集；写进容器内文件既拿不到也会撑大容器层。

```ini
# php-fpm：把错误日志指向标准错误
[global]
error_log = /proc/self/fd/2
[www]
access.log = /proc/self/fd/2
catch_workers_output = yes
```

---

## 4. 一个可用的 PHP 项目 Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM php:8.2-fpm-alpine

ARG UID=1000

RUN apk add --no-cache tzdata fcgi \
 && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
 && echo "Asia/Shanghai" > /etc/timezone \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql opcache bcmath

# opcache 生产配置（发布时通过 reload 生效）
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/zz-opcache.ini
COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-app.ini

# 非 root 用户
RUN adduser -u ${UID} -D -s /bin/sh app

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/root/.composer \
    composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

COPY --chown=app:app . /app

USER app

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD php-fpm-healthcheck || exit 1

EXPOSE 9000
ENTRYPOINT ["php-fpm", "-F"]
```

```ini
; docker/php/opcache.ini
opcache.enable=1
opcache.memory_consumption=192
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
opcache.save_comments=1
```

---

## 5. Compose 编排

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:1.27-alpine
    ports: ["8080:80"]
    volumes:
      - ./:/app:ro
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      php:
        condition: service_healthy      # 等健康，不是等启动
    networks: [backend]

  php:
    build:
      context: .
      args: { UID: "1000" }
    env_file: [.env]
    init: true                          # 让 tini 当 PID 1，正确转发信号
    volumes:
      - ./:/app
    healthcheck:
      test: ["CMD", "php-fpm-healthcheck"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 20s                 # 启动期不计失败
    depends_on:
      mysql: { condition: service_healthy }
      redis: { condition: service_started }
    networks: [backend]

  mysql:
    image: mysql:8.0
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: app
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [backend]

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lfu --appendonly yes
    volumes:
      - redis-data:/data
    networks: [backend]

volumes:
  mysql-data:
  redis-data:

networks:
  backend:
    driver: bridge
```

四个要点：

1. **`depends_on` 默认只等容器"启动"，不等"可用"** → 必须配 `healthcheck` + `condition: service_healthy`；
2. **数据一定要用命名卷或宿主机目录**，`docker compose down -v` 会删掉匿名卷数据；
3. **配置用 `.env`**（`env_file` / `${VAR}` 插值），别写死在 compose 里提交；
4. **开发和生产用不同文件叠加**：`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`，prod 里去掉源码挂载、加资源限制。

---

## 6. 资源限制与日志

```yaml
services:
  php:
    deploy:
      resources:
        limits:   { cpus: "2.0", memory: 1g }
        reservations: { cpus: "0.5", memory: 512m }
    logging:
      driver: json-file
      options:
        max-size: "10m"     # 单文件上限
        max-file: "3"       # 最多保留 3 个
```

不限制日志大小是**磁盘被打满的头号原因**（`/var/lib/docker/containers/*/*-json.log`）。

```bash
docker stats --no-stream                 # 实时看 CPU/内存/网络/IO
docker inspect -f '{{.State.OOMKilled}}' <container>   # 是否被 OOM 杀掉
```

---

## 7. 排查命令

```bash
docker ps -a                             # 含已退出的容器（看 ExitCode）
docker logs -f --tail 200 <container>    # 看日志
docker inspect <container> | less        # 配置、挂载、网络、健康状态
docker exec -it <container> sh           # 进容器（distroless 没有 sh）
docker top <container>                   # 容器内进程
docker stats                             # 资源占用
docker network inspect <net>             # 容器 IP、别名
docker system df                         # 镜像/容器/卷占了多少磁盘
docker system prune -a --volumes         # 清理（-a 会删掉未使用镜像，--volumes 删卷，谨慎）
```

| 现象 | 排查思路 |
| --- | --- |
| 容器起来就退出 | `docker logs` + `docker inspect -f '{{.State.ExitCode}}'`；多半是前台进程跑完了 |
| `docker stop` 要等 10 秒 | 信号没传到应用：改 exec 形式 + `init: true` |
| 端口占用 | `docker ps` 看映射，宿主 `ss -lntp \| grep 8080` |
| 容器间连不通 | `docker exec app ping mysql`、`docker network inspect` 看是否同一网络 |
| 卷里没权限 | 对齐 UID（`user:` 或 `--chown`），检查宿主机目录属主 |
| 构建缓存不命中 | `COPY` 顺序、`.dockerignore`、`--no-cache` 对比，`docker history` 看哪层重建 |
| 镜像太大 | 多阶段构建、换 slim/alpine、清 apt/apk 缓存、别把源码和 `.git` 打进去 |
| 时间不对 | 镜像内装 tzdata + 设 `TZ`，PHP 再确认 `date.timezone` |

---

## 8. 上线检查清单

- [ ] 多阶段构建，运行阶段不含编译工具链和开发依赖（`--no-dev`）
- [ ] `.dockerignore` 排除了 `.git`、`vendor`、`node_modules`、日志、`.env`
- [ ] `COPY` 顺序让依赖安装能命中缓存；用 BuildKit cache mount
- [ ] 入口用 **exec 形式** + `init: true`，`docker stop` 能秒退
- [ ] 镜像里装了 tzdata 并设了 `TZ`，中文场景装了字体
- [ ] 容器以非 root 运行，UID 与挂载目录属主对齐
- [ ] 密钥走 BuildKit secret 或运行时环境变量，**没有写进 `ENV`/`ARG`**
- [ ] 日志输出到 stdout/stderr，并限制了 `max-size` / `max-file`
- [ ] 关键的 `depends_on` 都配了 `healthcheck` + `condition: service_healthy`
- [ ] 数据用命名卷，`deploy.resources.limits` 设了 CPU 和内存上限
- [ ] 知道怎么快速排障：`docker logs` / `inspect` / `exec` / `stats` / `system df`
