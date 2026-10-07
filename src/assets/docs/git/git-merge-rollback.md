---
title: Git 合并方向搞错（gray 合进 feat/xxx）如何回滚
navTitle: 合并错误回滚
category: Git
order: 3
description: 误把 gray 合并进 feat/xxx 后，按"是否已推送""有没有后续提交"分情况回滚 feat/xxx
---
# Git 合并方向搞错（gray 合进 feat/xxx）如何回滚

> **场景**：在 `feat/xxx` 上误执行了 `git merge gray`（或 `git pull origin gray`），把测试分支的代码合进了自己的开发分支，方向反了。
> **原则**：先判断「这次合并推送出去了没有」「合并之后有没有继续提交」，再决定用 `reset` 还是 `revert`。**动历史之前先备份分支**。
>
> 下面每条命令的结论都在 git 2.39 上的临时仓库里实测过，包括容易踩的快进合并和 revert merge 两个坑。

## 目录

- [1. 先判断现状（四条命令）](#1-先判断现状四条命令)
- [2. 情况一：合并卡在冲突中，还没提交](#2-情况一合并卡在冲突中还没提交)
- [3. 情况二：合并已提交，还没推送](#3-情况二合并已提交还没推送)
- [4. 情况三：合并之后又提交了新东西](#4-情况三合并之后又提交了新东西)
- [5. 情况四：已经推送到远端](#5-情况四已经推送到远端)
- [6. reset 的三种模式](#6-reset-的三种模式)
- [7. 回滚后怎么确认干净了](#7-回滚后怎么确认干净了)
- [8. 怎么防止再犯](#8-怎么防止再犯)
- [9. 速查表](#9-速查表)

---

## 1. 先判断现状（四条命令）

```bash
git status                            # 合并还在冲突中吗（Unmerged paths / MERGE_HEAD）
git log --oneline --graph -5          # 有 "Merge branch 'gray'"（非快进）还是直接跳到 gray（快进）
git reflog show feat/xxx | head -5    # 合并前的位置在哪（最关键的一步）
git branch -r --contains HEAD         # 这个合并提交有没有已经推出去
```

| 现象 | 属于哪种情况 | 怎么办 |
| --- | --- | --- |
| `git status` 里有 `Unmerged paths` | 冲突中，没提交 | 情况一 → `git merge --abort` |
| `git log` 里有 `Merge branch 'gray'` | 非快进合并 | 情况二 / 三 / 四 |
| `git log` 里没有 merge 提交，HEAD 直接是 gray 的提交 | 快进合并 | 情况二（**注意 `HEAD^` 不能用**） |
| `git branch -r --contains HEAD` 有输出 | 已经推送 | 情况四 |

## 2. 情况一：合并卡在冲突中，还没提交

```bash
git merge --abort
git status          # 应该干净，冲突标记也一并消失
```

`git merge --abort` 就是「有 `MERGE_HEAD` 时」的 `git reset --merge`。实测：冲突标记、索引里的改动全部清掉，回到合并前的状态。

如果 abort 报错说本地有未提交改动，先存起来再回来：

```bash
git stash
git merge --abort
git stash pop
```

## 3. 情况二：合并已提交，还没推送

这是最常见也最好处理的情况。**先备份**，20 秒换一条命：

```bash
git branch backup/feat-xxx-$(date +%Y%m%d%H%M)
```

### 3.1 非快进合并（有 merge 提交）

```bash
git log --oneline -3          # 看到 "Merge branch 'gray' into feat/xxx"
git reset --hard ORIG_HEAD    # ORIG_HEAD = 这次合并开始前的位置
```

实测：`ORIG_HEAD` 和 `HEAD^` 都指向合并前的 `feat/xxx`（merge 提交的第一父提交就是它）。**推荐用 `ORIG_HEAD`**，因为它不要求「合并提交正好是当前最后一个提交」。

### 3.2 快进合并（没有 merge 提交，最容易搞错）

快进合并不产生 merge 提交，`feat/xxx` 的指针直接跳到 gray 的最新提交。此时 **`HEAD^` 指向的是 gray 的上一个提交，不是你原来的 `feat/xxx`**。

实测数据：`feat/ff` 合并前是 `78604b6`，快进合并 gray 之后 `HEAD` = `c66a6bd`，而 `HEAD^` = `31868ee` —— 这是 gray 的历史。用 `git reset --hard HEAD^` 会留下一部分 gray 的代码。

```bash
git reflog show feat/xxx | head -5
# 9c21028 feat/xxx@{0}: merge gray: Merge made by the 'ort' strategy.
# 78604b6 feat/xxx@{1}: commit: feat: xxxxxx     ← 合并前的位置

git reset --hard 'feat/xxx@{1}'
```

实测补充：**`git merge` 即使是快进，也会设置 `ORIG_HEAD`**，所以 `git reset --hard ORIG_HEAD` 同样是有效的。但 `ORIG_HEAD` 会被之后的 merge / rebase / reset / pull 覆盖，拿不准时就用 reflog（只存在本地、默认保留 90 天）。

## 4. 情况三：合并之后又提交了新东西

这时候直接 `reset --hard ORIG_HEAD` 会把新提交一起丢掉 —— 实测：合并后写的 `later.txt` 直接没了，因为 `ORIG_HEAD` 停在合并前。

想「丢掉这次合并，但保留合并之后的提交」，用 `rebase --onto`：

```bash
MERGE=$(git rev-parse HEAD^)     # 定位那个 merge 提交（也可以用 git log 里的 SHA）
git rebase --onto "$MERGE^" "$MERGE" feat/xxx
```

实测结果：gray 带进来的文件消失，合并之后自己写的提交保留。

如果合并之后的提交依赖了 gray 的代码，rebase 会报冲突 —— 这种情况别硬 rebase，改用 [5.2 的 revert 方案](#52-别人可能已经拉过或者这是共享分支-用-revert-加一个反向提交)。

## 5. 情况四：已经推送到远端

先确认推送状态：

```bash
git branch -r --contains HEAD    # 输出 origin/feat/xxx 就说明已经推上去了
git log --oneline @{u}..HEAD     # 本地比远端多几个提交（0 个就是已同步）
```

### 5.1 分支是你一个人的 → 重写历史 + 强制推送（最干净）

```bash
git reset --hard ORIG_HEAD        # 或第 4 节的 rebase --onto 方案
git push --force-with-lease origin feat/xxx
```

用 `--force-with-lease` 而不是 `--force`：如果远端在你 reset 之后又被别人推过，它会直接拒绝，避免把别人的提交覆盖掉。推完记得在群里说一声「我重置了 feat/xxx」。

### 5.2 别人可能已经拉过、或者这是共享分支 → 用 revert 加一个「反向提交」

```bash
git revert -m 1 --no-edit <merge提交的SHA>
```

`-m 1` 表示保留 1 号父提交（也就是你当时所在的分支 `feat/xxx`），撤销 gray 带进来的改动。实测：gray 的文件被删除、历史保持完整、**不需要 force push**。

> **⚠️ 必须知道的坑**：revert 掉 merge 之后，git 会认为 gray「已经合并过了」，之后再执行 `git merge gray` 只会显示 `Already up to date.`，**不会把 gray 的代码带回来**（实测确认）。要重新合并，得先撤销那个 revert：

```bash
git revert --no-edit <刚才那个 revert 提交的SHA>    # 先 revert 掉 revert
git merge gray                                      # 这时才能把 gray 的内容合回来
```

### 5.3 远端还是好的 → 直接和远端对齐（最省事）

如果远端上仍是合并前的状态，只有本地乱了：

```bash
git fetch origin
git reset --hard origin/feat/xxx
```

实测：本地立刻和远端一致，不用去翻 `ORIG_HEAD` 和 reflog。前提是本地没有想保留的提交（有就先备份分支或 cherry-pick 出来）。

## 6. reset 的三种模式

| 命令 | HEAD | 暂存区 | 工作区 | 典型用途 |
| --- | --- | --- | --- | --- |
| `git reset --soft <目标>` | 移动 | 保留（改动变成已暂存） | 保留 | 想重新整理提交内容 |
| `git reset --mixed <目标>`（默认） | 移动 | 重置 | 保留 | 撤销提交、保留代码 |
| `git reset --hard <目标>` | 移动 | 重置 | **丢弃** | 回滚误合并（本文用的就是这个） |

`--hard` 会丢掉工作区里没提交的改动，动手前先 `git status`，有东西就 `git stash`。

## 7. 回滚后怎么确认干净了

```bash
git log --oneline --graph -6                  # 没有 "Merge branch 'gray'" 了
git diff --stat <合并前的SHA> HEAD            # 应该没有任何输出
git status                                    # 干净
git branch -r --contains HEAD                 # 推送过的话，确认远端也要跟着更新
```

`git diff` 没有输出，就说明工作区已经和合并前一模一样。

## 8. 怎么防止再犯

几个一次性配置，能挡掉大部分误操作：

```bash
git config --global pull.rebase true      # pull 走 rebase，不要自动 merge
git config --global pull.ff only          # 需要 merge 时才允许的操作用 --no-ff 显式做，避免默默合并
git config --global alias.undo-merge 'reset --hard ORIG_HEAD'
git branch --show-current                 # 操作前先确认自己在哪个分支
```

习惯上加几条：

- 在 `feat/xxx` 上同步测试分支，用 `git rebase gray`，不要 `git merge gray`；
- `git pull` 之前先 `git status` + `git branch --show-current`，看清分支再拉；
- 合并方向交给 MR / PR 去做，服务端把 `gray`、`master` 设成保护分支，禁止直接 push；
- 记住合并永远是**单向**的：`feat/xxx → gray → master`，反方向只会给自己添麻烦。

## 9. 速查表

| 情况 | 命令 |
| --- | --- |
| 冲突中，还没提交 | `git merge --abort` |
| 已提交、未推送、有 merge 提交 | `git reset --hard ORIG_HEAD` |
| 已提交、未推送、快进合并 | `git reset --hard 'feat/xxx@{1}'`（reflog） |
| 合并之后还有新提交 | `git rebase --onto <merge>^ <merge> feat/xxx` |
| 已推送、个人分支 | `git reset --hard ORIG_HEAD && git push --force-with-lease` |
| 已推送、共享分支 | `git revert -m 1 <merge>` |
| 远端还是好的 | `git fetch && git reset --hard origin/feat/xxx` |
| 动手前的保命操作 | `git branch backup/feat-xxx-$(date +%Y%m%d%H%M)` |
