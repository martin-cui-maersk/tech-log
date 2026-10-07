---
title: Linux 分类与搜索详解（grep 与 find）
navTitle: Linux grep 与 find
category: linux
order: 1
description: Linux 常见分类、文件类型、grep 与 find 搜索命令详解
---
# Linux 分类与搜索详解（grep 与 find）

> **适用场景**：Linux 日常运维、开发排查、日志分析、文件定位、批量处理。
> **核心内容**：先了解 Linux 常见分类，再重点掌握 `grep` 与 `find` 两大搜索命令。

---

## 目录

- [1. Linux 常见分类](#1-linux-常见分类)
  - [1.1 按发行版分类](#11-按发行版分类)
  - [1.2 按文件类型分类](#12-按文件类型分类)
  - [1.3 按目录用途分类（FHS）](#13-按目录用途分类fhs)
  - [1.4 按权限与所有者分类](#14-按权限与所有者分类)
- [2. 搜索命令概览](#2-搜索命令概览)
- [3. grep 搜索详解](#3-grep-搜索详解)
  - [3.1 基本语法](#31-基本语法)
  - [3.2 常用选项](#32-常用选项)
  - [3.3 正则表达式](#33-正则表达式)
  - [3.4 递归搜索](#34-递归搜索)
  - [3.5 上下文查看](#35-上下文查看)
  - [3.6 包含与排除](#36-包含与排除)
  - [3.7 与管道配合](#37-与管道配合)
  - [3.8 常见示例](#38-常见示例)
- [4. find 搜索详解](#4-find-搜索详解)
  - [4.1 基本语法](#41-基本语法)
  - [4.2 按名称与路径搜索](#42-按名称与路径搜索)
  - [4.3 按文件类型搜索](#43-按文件类型搜索)
  - [4.4 按大小搜索](#44-按大小搜索)
  - [4.5 按时间搜索](#45-按时间搜索)
  - [4.6 按权限、用户、组搜索](#46-按权限用户组搜索)
  - [4.7 逻辑组合](#47-逻辑组合)
  - [4.8 执行动作](#48-执行动作)
  - [4.9 排除与深度控制](#49-排除与深度控制)
  - [4.10 常见示例](#410-常见示例)
- [5. grep 与 find 对比](#5-grep-与-find-对比)
- [6. 常见组合场景](#6-常见组合场景)
- [7. 性能与安全注意事项](#7-性能与安全注意事项)
- [8. 速查表](#8-速查表)
- [9. 总结](#9-总结)

---

## 1. Linux 常见分类

### 1.1 按发行版分类

| 系列 | 代表发行版 | 包管理 | 特点 |
|---|---|---|---|
| Debian 系 | Debian、Ubuntu、Linux Mint | `apt` / `dpkg` | 生态大，Ubuntu 适合新手和服务器 |
| Red Hat 系 | RHEL、CentOS、Fedora、Rocky、Alma | `yum` / `dnf` / `rpm` | 企业级，稳定，服务器常用 |
| Arch 系 | Arch、Manjaro | `pacman` | 滚动更新，适合进阶用户 |
| SUSE 系 | openSUSE、SLES | `zypper` / `rpm` | 欧洲企业常用 |
| Alpine | Alpine Linux | `apk` | 极小，容器常用 |
| Gentoo | Gentoo | `portage` | 源码编译，高度定制 |

### 1.2 按文件类型分类

`ls -l` 第一列可判断文件类型：

| 符号 | 类型 | 说明 |
|---|---|---|
| `-` | 普通文件 | 文本、二进制、压缩包等 |
| `d` | 目录 | 文件夹 |
| `l` | 符号链接 | 软链接，类似快捷方式 |
| `b` | 块设备 | 硬盘、分区等 |
| `c` | 字符设备 | 终端、串口等 |
| `s` | 套接字 | 进程间通信 |
| `p` | 管道 | 命名管道 |

示例：

```bash
ls -l /dev/sda
ls -l /etc/nginx/nginx.conf
```

### 1.3 按目录用途分类（FHS）

| 目录 | 用途 |
|---|---|
| `/bin` | 基础用户命令 |
| `/sbin` | 系统管理命令 |
| `/etc` | 配置文件 |
| `/var` | 可变数据，如日志、缓存 |
| `/usr` | 用户程序与资源 |
| `/home` | 普通用户家目录 |
| `/root` | root 家目录 |
| `/tmp` | 临时文件 |
| `/opt` | 第三方软件 |
| `/proc` | 进程与内核信息 |
| `/sys` | 内核与硬件信息 |
| `/dev` | 设备文件 |
| `/mnt` | 临时挂载点 |
| `/media` | 可移动媒体挂载点 |
| `/srv` | 服务数据 |

### 1.4 按权限与所有者分类

Linux 权限分为读、写、执行：

| 权限 | 数字 | 说明 |
|---|---|---|
| `r` | 4 | 读 |
| `w` | 2 | 写 |
| `x` | 1 | 执行 |
| `-` | 0 | 无权限 |

权限对象：

- `u`：所有者
- `g`：所属组
- `o`：其他人

特殊权限：

- SUID：`4xxx`
- SGID：`2xxx`
- Sticky Bit：`1xxx`

示例：

```bash
chmod 755 script.sh
chmod 644 config.php
chown www-data:www-data /var/www/html
```

---

## 2. 搜索命令概览

| 命令 | 搜索对象 | 典型用途 |
|---|---|---|
| `grep` | 文件内容 | 在文本中查找关键字、正则匹配 |
| `find` | 文件/目录元数据 | 按名称、类型、大小、时间、权限查找文件 |
| `locate` | 文件名 | 基于数据库快速查找，需 `updatedb` |
| `which` | 可执行文件路径 | 查找命令位置 |
| `whereis` | 命令、手册、源码 | 查找命令相关文件 |
| `rg` / `ripgrep` | 文件内容 | 更快的 grep 替代品 |

本文重点：`grep` 与 `find`。

---

## 3. grep 搜索详解

`grep` 用于在文件内容中搜索匹配的行，支持普通字符串和正则表达式。

### 3.1 基本语法

```bash
grep [选项] "模式" [文件...]
```

示例：

```bash
grep "error" app.log
grep "root" /etc/passwd
```

### 3.2 常用选项

| 选项 | 说明 |
|---|---|
| `-i` | 忽略大小写 |
| `-r` / `-R` | 递归搜索目录 |
| `-n` | 显示行号 |
| `-v` | 反向匹配，显示不包含模式的行 |
| `-w` | 匹配完整单词 |
| `-x` | 匹配整行 |
| `-c` | 统计匹配行数 |
| `-l` | 只显示包含匹配的文件名 |
| `-L` | 只显示不包含匹配的文件名 |
| `-o` | 只输出匹配部分 |
| `-q` | 静默模式，不输出，靠退出码判断 |
| `-s` | 不显示错误信息 |
| `-a` | 将二进制文件当文本处理 |
| `-I` | 忽略二进制文件 |
| `-E` | 使用扩展正则（ERE） |
| `-F` | 按固定字符串匹配，不解析正则 |
| `-P` | 使用 Perl 正则（PCRE），部分系统支持 |
| `-A n` | 显示匹配行后 n 行 |
| `-B n` | 显示匹配行前 n 行 |
| `-C n` | 显示匹配行前后各 n 行 |
| `--include` | 只搜索指定文件 |
| `--exclude` | 排除指定文件 |
| `--exclude-dir` | 排除指定目录 |
| `--color=auto` | 高亮匹配 |

### 3.3 正则表达式

| 类型 | 说明 | 示例 |
|---|---|---|
| BRE | 基本正则，默认 | `grep "^root" file` |
| ERE | 扩展正则，`-E` | `grep -E "error|warning" file` |
| PCRE | Perl 正则，`-P` | `grep -P "\d{4}-\d{2}-\d{2}" file` |
| 固定字符串 | `-F` | `grep -F "a.b" file` |

常用正则符号：

| 符号 | 含义 |
|---|---|
| `^` | 行首 |
| `$` | 行尾 |
| `.` | 任意单字符 |
| `*` | 前一项零次或多次 |
| `+` | 前一项一次或多次 |
| `?` | 前一项零次或一次 |
| `[]` | 字符集合 |
| `[^]` | 排除字符集合 |
| `\|` 或 `|` | 或 |
| `()` | 分组 |
| `\d` | 数字，PCRE |
| `\w` | 单词字符，PCRE |
| `\s` | 空白字符，PCRE |

### 3.4 递归搜索

```bash
grep -r "TODO" .
grep -rn "function" ./src
grep -rni "error" /var/log/
```

只搜索指定文件：

```bash
grep -rn "TODO" ./src --include="*.php"
grep -rn "TODO" ./src --include="*.{php,js}"
```

排除目录：

```bash
grep -rn "TODO" . --exclude-dir=vendor --exclude-dir=node_modules
```

### 3.5 上下文查看

```bash
grep -C 3 "Exception" app.log
grep -A 5 "ERROR" app.log
grep -B 2 "Fatal" app.log
```

### 3.6 包含与排除

```bash
grep -rn "redis" . --include="*.conf"
grep -rn "password" . --exclude="*.log"
grep -rn "cache" . --exclude-dir=.git
```

### 3.7 与管道配合

```bash
ps aux | grep nginx
cat /etc/passwd | grep "/bin/bash"
history | grep git
```

避免匹配到 `grep` 自身：

```bash
ps aux | grep '[n]ginx'
```

### 3.8 常见示例

```bash
# 忽略大小写搜索
grep -i "error" app.log

# 显示行号并递归
grep -rn "TODO" ./src

# 反向过滤注释和空行
grep -v "^#" nginx.conf | grep -v "^$"

# 扩展正则
grep -E "error|warning|critical" app.log

# 只显示文件名
grep -rl "mysql" /etc/

# 统计出现次数
grep -c "404" access.log

# 只输出匹配内容
grep -o "[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}" access.log
```

---

## 4. find 搜索详解

`find` 用于按文件元数据查找文件或目录，功能非常强大。

### 4.1 基本语法

```bash
find [搜索路径] [表达式] [动作]
```

示例：

```bash
find . -name "*.php"
find /var/log -type f -name "*.log"
```

### 4.2 按名称与路径搜索

```bash
find . -name "nginx.conf"
find . -iname "README.md"
find . -path "*/config/*.php"
find . -name "*.log" -not -path "./vendor/*"
```

### 4.3 按文件类型搜索

| 类型 | 说明 |
|---|---|
| `f` | 普通文件 |
| `d` | 目录 |
| `l` | 符号链接 |
| `b` | 块设备 |
| `c` | 字符设备 |
| `s` | 套接字 |
| `p` | 管道 |

示例：

```bash
find . -type f
find . -type d
find . -type l
```

### 4.4 按大小搜索

| 单位 | 说明 |
|---|---|
| `c` | 字节 |
| `k` | KB |
| `M` | MB |
| `G` | GB |

示例：

```bash
find . -type f -size +100M
find . -type f -size -1k
find . -type f -size 10M
```

### 4.5 按时间搜索

| 选项 | 说明 |
|---|---|
| `-mtime n` | 修改时间，n 天前 |
| `-atime n` | 访问时间 |
| `-ctime n` | 状态改变时间 |
| `-mmin n` | 修改时间，n 分钟前 |
| `-amin n` | 访问时间，分钟 |
| `-cmin n` | 状态改变时间，分钟 |

示例：

```bash
find /var/log -type f -mtime +7
find . -type f -mmin -30
find . -type f -newer file.txt
```

### 4.6 按权限、用户、组搜索

```bash
find . -type f -perm 777
find . -type f -perm -u+w
find . -user www-data
find . -group www-data
find . -nouser
find . -nogroup
```

### 4.7 逻辑组合

| 操作 | 说明 |
|---|---|
| `-a` | 与，默认 |
| `-o` | 或 |
| `!` | 非 |
| `\( \)` | 分组 |

示例：

```bash
find . -type f \( -name "*.jpg" -o -name "*.png" \)
find . -type f -name "*.log" ! -name "access.log"
find . -type f -name "*.php" -a -size +10k
```

### 4.8 执行动作

```bash
find . -type f -name "*.log" -print
find . -type f -name "*.tmp" -delete
find . -type f -name "*.php" -exec grep -n "TODO" {} \;
find . -type f -name "*.log" -exec grep -l "ERROR" {} +
find . -type f -name "*.bak" -ok rm {} \;
```

说明：

- `{}`：当前找到的文件。
- `\;`：每个文件执行一次命令。
- `+`：尽可能多文件一次执行，效率更高。
- `-ok`：执行前询问。
- `-delete`：删除，建议先用 `-print` 确认。

### 4.9 排除与深度控制

```bash
find . -maxdepth 2 -type f
find . -mindepth 1 -type d
find . -path "./vendor" -prune -o -name "*.php" -print
find . -type d -name "node_modules" -prune -o -type f -name "*.js" -print
```

### 4.10 常见示例

```bash
# 查找 7 天前的日志
find /var/log -type f -name "*.log" -mtime +7 -print

# 查找大于 100M 的文件
find / -type f -size +100M 2>/dev/null

# 查找权限为 777 的文件
find . -type f -perm 777

# 查找最近 30 分钟修改的文件
find . -type f -mmin -30

# 查找并删除临时文件
find /tmp -type f -name "*.tmp" -print
find /tmp -type f -name "*.tmp" -delete

# 查找 PHP 文件并搜索 TODO
find ./src -type f -name "*.php" -exec grep -n "TODO" {} +

# 查找空文件
find . -type f -empty
find . -type d -empty

# 查找并压缩旧日志
find /var/log -type f -name "*.log" -mtime +7 -exec gzip {} \;
```

---

## 5. grep 与 find 对比

| 维度 | grep | find |
|---|---|---|
| 搜索对象 | 文件内容 | 文件/目录元数据 |
| 核心用途 | 文本匹配、日志过滤 | 文件定位、批量处理 |
| 是否递归 | 需 `-r` | 默认递归 |
| 正则支持 | 支持 BRE / ERE / PCRE | 名称支持通配符，部分支持正则 |
| 按时间 | 不支持 | 支持 |
| 按大小 | 不支持 | 支持 |
| 按权限 | 不支持 | 支持 |
| 执行命令 | 一般配合管道 | 支持 `-exec` / `-delete` |
| 性能 | 内容扫描，依赖文件数 | 元数据扫描，依赖目录树 |

简单记：

- **找文件**：用 `find`。
- **找内容**：用 `grep`。
- **先筛文件再搜内容**：`find + grep`。

---

## 6. 常见组合场景

### 6.1 在指定类型文件中搜索内容

```bash
find ./src -type f -name "*.php" -exec grep -n "TODO" {} +
```

等价于：

```bash
grep -rn "TODO" ./src --include="*.php"
```

### 6.2 查找旧日志并压缩

```bash
find /var/log -type f -name "*.log" -mtime +7 -exec gzip {} \;
```

### 6.3 查找大文件并排序

```bash
find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k5 -h
```

### 6.4 查找包含关键字的配置文件

```bash
find /etc -type f -name "*.conf" -exec grep -l "listen" {} +
```

### 6.5 清理临时文件

```bash
find /tmp -type f -name "*.tmp" -mtime +1 -print
find /tmp -type f -name "*.tmp" -mtime +1 -delete
```

### 6.6 统计某类文件数量

```bash
find . -type f -name "*.php" | wc -l
```

---

## 7. 性能与安全注意事项

- `grep -r` 会遍历大量文件，尽量配合 `--include`、`--exclude-dir` 缩小范围。
- `find /` 从根目录搜索时，使用 `2>/dev/null` 忽略权限错误。
- `find -delete` 前先用 `-print` 确认结果。
- `find -exec rm` 风险高，建议先 `ls` 或 `-ok`。
- `grep -P` 依赖 PCRE 支持，部分系统不可用。
- 大文件搜索可用 `rg`、`ag`、`ack` 替代，速度更快。
- 生产环境避免在高峰期执行全盘 `find`。
- 搜索敏感文件时注意权限与审计要求。

---

## 8. 速查表

### grep 速查

```bash
grep -i "error" file.log              # 忽略大小写
grep -rn "TODO" ./src                 # 递归并显示行号
grep -v "^#" nginx.conf               # 反向匹配
grep -E "error|warning" app.log       # 扩展正则
grep -C 3 "Exception" app.log         # 前后 3 行
grep -rl "mysql" /etc                 # 只显示文件名
grep -c "404" access.log              # 统计行数
ps aux | grep '[n]ginx'               # 管道过滤
```

### find 速查

```bash
find . -name "*.php"                          # 按名称
find . -iname "readme.md"                     # 忽略大小写
find . -type f                                # 普通文件
find . -type d                                # 目录
find . -size +100M                            # 大于 100M
find . -mtime +7                              # 7 天前修改
find . -mmin -30                              # 30 分钟内修改
find . -perm 777                              # 权限 777
find . -user www-data                         # 按用户
find . -empty                                 # 空文件/目录
find . -name "*.log" -delete                  # 删除
find . -name "*.php" -exec grep -n "TODO" {} + # 执行命令
find . -path "./vendor" -prune -o -name "*.php" -print # 排除目录
```

---

## 9. 总结

- Linux 分类可从发行版、文件类型、目录用途、权限等维度理解。
- `grep` 负责搜索文件内容，适合日志分析、代码检索、管道过滤。
- `find` 负责搜索文件本身，适合按名称、类型、大小、时间、权限定位和批量处理。
- 实际工作中最常用的是 **`find` 缩小文件范围 + `grep` 搜索内容**。
- 使用 `find -delete`、`-exec rm` 时务必先确认，避免误删。
- 大范围搜索注意性能，优先缩小路径、文件类型和目录范围。

---
