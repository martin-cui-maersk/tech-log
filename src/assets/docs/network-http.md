---
title: 网络与 HTTP 排障实战指南
navTitle: 网络与 HTTP 排障
category: 网络
order: 6
description: 请求链路逐层排查、状态码与缓存头、TLS 证书、TCP TIME_WAIT/CLOSE_WAIT、DNS 与抓包定位耗时
---
# 网络与 HTTP 排障实战指南

> **适用场景**：接口"有时候很慢"、页面白屏、502/504、证书报错、`TIME_WAIT` 堆积、改了解析不生效。
> **排查思路**：先确定**慢在哪一层**（DNS / 连接 / TLS / 首字节 / 传输），再深入那一层，不要一上来就重启服务。

## 目录

- [1. 一个请求的完整链路](#1-一个请求的完整链路)
- [2. HTTP 协议要点](#2-http-协议要点)
- [3. HTTPS 与 TLS 排查](#3-https-与-tls-排查)
- [4. TCP 层排障](#4-tcp-层排障)
- [5. DNS 解析与排查](#5-dns-解析与排查)
- [6. 抓包与耗时定位](#6-抓包与耗时定位)
- [7. 现象对照速查表](#7-现象对照速查表)

---

## 1. 一个请求的完整链路

```
浏览器
  │  ① DNS 解析：域名 → IP（可能经过本地缓存、/etc/hosts、递归 DNS）
  │  ② TCP 三次握手（SYN → SYN/ACK → ACK）
  │  ③ TLS 握手（证书校验、密钥协商）
  │  ④ 发 HTTP 请求 → 等第一个字节（TTFB）
  │  ⑤ 传响应体
  ▼
负载均衡 / Nginx（反向代理）
  │  ⑥ 转发到上游（upstream）
  ▼
PHP-FPM / 应用 → MySQL / Redis / 外部 API
```

每层出问题的典型表现：

| 层 | 典型现象 | 先看什么 |
| --- | --- | --- |
| DNS | 偶发超时、换网络就正常、"Unknown host" | `dig`、`/etc/resolv.conf`、TTL |
| TCP 连接 | 连接超时、连接被拒 | `ss`、安全组/防火墙、`SYN` 是否回 `RST` |
| TLS | 证书报错、握手慢 | `openssl s_client`、证书链 |
| HTTP 首字节 | TTFB 高但传输快 | 应用日志、SQL 慢查询、`slowlog` |
| 传输 | 首字节快但下载慢 | 带宽、`gzip`/`br`、CDN |
| 上游 | 502 / 504 | Nginx error log、PHP-FPM 状态 |

---

## 2. HTTP 协议要点

### 2.1 方法与幂等

| 方法 | 幂等 | 语义 |
| --- | --- | --- |
| `GET` | 是 | 只读，可缓存 |
| `POST` | 否 | 创建/提交，不可缓存 |
| `PUT` | 是 | 整体替换，重复执行结果一致 |
| `PATCH` | 否 | 局部更新 |
| `DELETE` | 是 | 删除 |

幂等的方法可以安全重试，`POST` 重试要有幂等键（`Idempotency-Key`）。

### 2.2 状态码

| 码 | 含义 | 常见原因 |
| --- | --- | --- |
| `301` / `302` | 永久/临时跳转 | **会把方法改成 GET**，`POST` 别用 |
| `307` | 临时跳转且保持方法 | 需要保持 `POST` 时用 |
| `308` | 永久跳转且保持方法 | 同上 |
| `304` | 未修改 | 协商缓存命中，正常 |
| `401` / `403` | 未认证 / 无权限 | 前者该去登录，后者登录了也不给 |
| `429` | 触发限流 | 看 `Retry-After` |
| `499` | **Nginx 自定义**：客户端提前断开 | 上游太慢，用户等不及关了页面 |
| `502` | 网关收到上游无效响应 | PHP-FPM 挂了/超时被 kill、端口没监听 |
| `503` | 服务不可用 | 过载、维护、`max_children` 占满排队 |
| `504` | 网关等上游超时 | 应用处理超过 `fastcgi_read_timeout` |

### 2.3 排查必看的头

```http
Host: example.com                  # 虚拟主机路由依据，反代时别丢
X-Forwarded-For: 1.2.3.4, 10.0.0.1 # 客户端 IP 链，第一个才是真实客户端
X-Real-IP: 1.2.3.4                 # Nginx 单层代理时等价
X-Forwarded-Proto: https           # 应用判断原始协议，决定是否生成 https 链接
Content-Type: application/json     # 少了它很多框架不解析 body
Transfer-Encoding: chunked         # 流式响应
```

多层代理时取真实 IP 要**从右往左跳过可信代理**，不能直接取第一个（可伪造）。

### 2.4 缓存头

| 头 | 作用 |
| --- | --- |
| `Cache-Control: max-age=3600` | 浏览器缓存 1 小时 |
| `Cache-Control: s-maxage=600` | 只作用于 CDN/共享缓存 |
| `Cache-Control: no-cache` | **可以缓存，但每次都要回源校验** |
| `Cache-Control: no-store` | 完全不缓存（敏感数据用这个） |
| `Cache-Control: immutable` | 带 hash 的静态资源，过期前不回源校验 |
| `ETag` / `If-None-Match` | 协商缓存，命中回 304 |
| `Last-Modified` / `If-Modified-Since` | 时间精度只到秒，不如 ETag 可靠 |
| `Vary: Accept-Encoding` | 同一 URL 因编码不同要分开缓存；漏了会串味 |

**静态资源版本化的正确姿势**：文件名带内容 hash + `max-age=31536000, immutable`；HTML 本身用 `no-cache`。

### 2.5 连接复用与协议版本

- HTTP/1.1 默认 `Connection: keep-alive`，但同一域名浏览器一般只开 6 个并发连接，**大文件会互相阻塞**；
- HTTP/2 多路复用解决了队头阻塞（应用层），但 TCP 层丢包仍会阻塞所有流；头部用 HPACK 压缩；
- HTTP/3 走 QUIC（UDP），把连接建立和 TLS 合并，弱网下收益明显；
- 反代场景注意 `proxy_http_version 1.1` + `proxy_set_header Connection ""`，否则到上游是短连接，`TIME_WAIT` 会暴涨。

---

## 3. HTTPS 与 TLS 排查

### 3.1 握手做了什么

```
Client                        Server
  │── ClientHello（支持的版本、套件、SNI、随机数）──▶│
  │◀─ ServerHello + 证书链 + （1.3 直接算密钥）──────│
  │── 校验证书（域名、有效期、签发链、吊销）─────────│
  │── Finished / 之后所有数据加密 ─────────────────▶│
```

TLS 1.2 需要 2-RTT，TLS 1.3 只要 1-RTT（会话恢复可 0-RTT）。所以"握手慢"通常意味着 RTT 高或证书链有问题。

### 3.2 证书问题一把梭

```bash
# 看完整证书链和握手过程
openssl s_client -connect example.com:443 -servername example.com -showcerts </dev/null

# 只看证书有效期与主题
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates

# 检查证书链是否完整（缺中间证书是"部分客户端正常、部分报错"的元凶）
openssl s_client -connect example.com:443 -servername example.com -verify_return_error </dev/null
```

| 报错 | 原因 | 处理 |
| --- | --- | --- |
| `unable to get local issuer certificate` | 服务端没发中间证书 | 补全 `fullchain.pem` |
| `certificate has expired` | 忘了续期 | certbot/acme.sh 自动续期 + 监控到期日 |
| `hostname mismatch` | 证书域名与 SNI 不一致 | 补 SAN 或改 `server_name` |
| `sslv3 alert handshake failure` | 协议/套件不匹配 | 别只开 TLS1.3 又用老客户端 |

其它要点：

- **SNI**：一台机器多个域名靠 SNI 区分证书，用 IP 直连测试会拿到默认站点证书；
- **HSTS**：`Strict-Transport-Security: max-age=31536000; includeSubDomains`，一旦下发，浏览器在有效期内拒绝 HTTP，**上线前确认全站 HTTPS 可用**；
- **混合内容**：HTTPS 页面里加载 `http://` 资源会被浏览器拦截，检查 CDN 和写死的 http 链接；
- 反向代理终止 TLS 时，到上游可以再加密（`proxy_pass https://`）或走内网明文，但**必须设 `X-Forwarded-Proto`**，否则应用生成的跳转链接会退回 http。

---

## 4. TCP 层排障

### 4.1 握手与挥手

```
三次握手：SYN → SYN/ACK → ACK
四次挥手：FIN → ACK → FIN → ACK
```

谁先调用 `close()`，谁进入 `TIME_WAIT`，持续 **2MSL（Linux 默认 60 秒）**。

| 状态 | 出现在哪 | 含义 | 常见原因 |
| --- | --- | --- | --- |
| `TIME_WAIT` | 主动关闭方 | 等对端最后的 FIN，正常现象 | 短连接多、反代没开 keepalive；数量大但不占资源 |
| `CLOSE_WAIT` | 被动关闭方 | 对方已关，**本端还没 close** | 应用/连接池没释放连接 → 这是代码问题 |
| `SYN_RECV` 堆积 | 服务端 | 半连接队列满 | SYN Flood 或 `somaxconn`/`tcp_max_syn_backlog` 太小 |
| `ESTABLISHED` 异常多 | 两端 | 连接泄漏 | 没设超时，连接池只增不减 |

**`CLOSE_WAIT` 一直涨 = 应用 bug**，不是内核参数问题（很多人第一反应去调 `tcp_tw_reuse`，方向就错了）。用下面的命令定位是谁：

```bash
ss -tan state close-wait | head
lsof -p <pid> | grep -c CLOSE_WAIT
```

### 4.2 常用命令

```bash
ss -s                                 # 各状态连接数汇总
ss -lntp                              # 监听端口和对应进程
ss -tan state time-wait | wc -l       # TIME_WAIT 数量
ss -tni dst 10.0.0.5                  # 看 rtt、重传、拥塞窗口
netstat -s | grep -iE "retrans|overflow|drop"   # 重传/队列溢出，丢包的直接证据
mtr -rwzbc 20 example.com             # 连续探测每跳丢包
traceroute -T -p 443 example.com      # TCP 路径探测（很多机器禁 ICMP）
```

```nginx
# 反代到上游开启长连接，能显著减少 TIME_WAIT
upstream backend {
    server 127.0.0.1:9000;
    keepalive 32;
}
location / {
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}
```

---

## 5. DNS 解析与排查

解析顺序：应用/浏览器缓存 → 系统缓存（systemd-resolved/nscd）→ `/etc/hosts` → `/etc/resolv.conf` 里的递归解析器 → 根 → TLD → 权威。

```bash
dig example.com +short                # 直接问默认 DNS
dig @8.8.8.8 example.com +short       # 换解析器对比，判断是不是本地 DNS 的问题
dig +trace example.com                # 从根开始逐级追踪，定位是哪一级配错
dig +noall +answer example.com TXT    # 查特定记录类型
getent hosts example.com              # 走系统解析（含 /etc/hosts），和 dig 结果可能不同
cat /etc/resolv.conf                  # 容器里常见 127.0.0.11 / 169.254.169.254
```

| 现象 | 原因 |
| --- | --- |
| 改了解析不生效 | 本地/系统缓存 + TTL 未过期；把 TTL 调小要**提前**做 |
| 部分机器不通 | `/etc/hosts` 里写死了旧 IP，或本地 DNS 缓存 |
| 容器里解析失败 | `resolv.conf` 指向的 DNS 不可达、`ndots` 配置导致多打几次查询 |
| 偶发解析超时 | DNS 服务器负载或网络抖动，配多个 nameserver + 应用侧重试 |
| 解析到多个 IP | 轮询/就近接入，注意客户端是否做了缓存与重试 |

---

## 6. 抓包与耗时定位

### 6.1 用 curl 的 `-w` 一次看清各阶段耗时

```bash
curl -o /dev/null -s -w '\n
dns      : %{time_namelookup}s
connect  : %{time_connect}s
tls      : %{time_appconnect}s
ttfb     : %{time_starttransfer}s
total    : %{time_total}s
http     : %{http_code}  size: %{size_download}\n' https://example.com/api
```

判断方法：

- `time_namelookup` 大 → DNS 问题；
- `time_connect - time_namelookup` 大 → TCP 握手慢（网络/防火墙/半连接队列）；
- `time_appconnect - time_connect` 大 → TLS 握手慢（证书链、RTT、OCSP）；
- `time_starttransfer - time_appconnect` 大 → **服务端处理慢**（查应用日志、SQL、上游接口）；
- `time_total - time_starttransfer` 大 → 传输慢（响应体大、带宽、没开压缩）。

### 6.2 其他常用姿势

```bash
curl -v https://example.com                   # 完整握手 + 请求响应头
curl -I https://example.com                   # 只看响应头
curl --resolve example.com:443:10.0.0.5 https://example.com   # 绕过 DNS 直连某台机器验证
curl -k https://example.com                   # 忽略证书错误（仅排障用）
curl --http2 -v https://example.com           # 验证是否走 HTTP/2
curl -x http://127.0.0.1:8080 https://example.com             # 走代理抓包

# 抓包：先只抓 80/443 与目标 IP，控制文件大小
tcpdump -i any -nn -s0 -A 'host 10.0.0.5 and port 9000' -w /tmp/upstream.pcap

# 看 TLS SNI（不用解密就能知道访问的域名）
tcpdump -i any -nn -A 'tcp port 443' | grep -i -m1 'Host\|SNI'
```

浏览器侧：DevTools → Network，看 **Timing** 面板把 DNS/连接/TLS/TTFB/下载拆开，和 curl 的结论互相印证；导出 HAR 可以给后端同学看。

---

## 7. 现象对照速查表

| 现象 | 先查 | 常见结论 |
| --- | --- | --- |
| 偶发超时，重试就好 | `curl -w` 分段耗时、客户端 DNS | DNS 抖动；或上游偶发慢，需要超时 + 重试 + 熔断 |
| 502 Bad Gateway | Nginx error log、`ss -lntp` | PHP-FPM 进程挂了、端口没监听、被 OOM Kill |
| 504 Gateway Timeout | 应用日志、`slowlog`、上游接口 | 应用处理超过 `fastcgi_read_timeout`，先把慢查询解决 |
| 503 Service Unavailable | `fpm-status`、`pm.max_children` | 并发打满，请求排队；要么扩进程要么降耗时 |
| 页面白屏但接口 200 | DevTools Console / Network | 混合内容被拦、JS 报错、CORS 预检失败 |
| 首字节快、下载慢 | 响应体大小、`Content-Encoding` | 没开 gzip/br、响应体没分页、CDN 回源慢 |
| `TIME_WAIT` 几万 | `ss -s`、接入层是否 keepalive | 短连接太多，开长连接；不要盲目调内核参数 |
| `CLOSE_WAIT` 持续增长 | `lsof`、连接池配置 | 应用没关闭连接，改代码/连接池 |
| 证书部分客户端报错 | `openssl s_client -showcerts` | 证书链缺中间证书 |
| 换网络就好了 | `mtr`、`ss -tni` | 链路丢包/MTU 问题，看重传计数 |
