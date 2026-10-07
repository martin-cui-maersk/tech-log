---
title: Git 合并流程完整指南（合并到 gray / master）
navTitle: Git 合并指南
category: Git
order: 1
description: 功能分支合并到 gray/master 的完整流程
---
# Git 合并流程完整指南（合并到 gray / master）

> **适用场景**：功能分支 `feat/xxx` 开发完成后，需先合并到 `gray` 进行测试，测试通过后再合并到 `master` 上线。
> **核心要求**：所有合并操作**必须产生合并提交（merge commit）**，便于追溯和回滚。

---

## 目录

- [1. 准备工作（无论合并到哪个分支，先执行）](#1-准备工作无论合并到哪个分支先执行)
- [2. 合并到测试分支 `gray`](#2-合并到测试分支-gray)
  - [2.1 切换到 gray 并拉取最新代码](#21-切换到-gray-并拉取最新代码)
  - [2.2 执行合并（强制产生合并提交）](#22-执行合并强制产生合并提交)
  - [2.3 如果出现冲突（Automatic merge failed）](#23-如果出现冲突automatic-merge-failed)
  - [2.4 推送 gray 到远程](#24-推送-gray-到远程)
- [3. 合并到生产分支 `master`](#3-合并到生产分支-master)
  - [3.1 切换到 master 并拉取最新代码](#31-切换到-master-并拉取最新代码)
  - [3.2 执行合并（强制产生合并提交）](#32-执行合并强制产生合并提交)
  - [3.3 处理冲突（同 2.3 节）](#33-处理冲突同-23-节)
  - [3.4 推送 master 到远程](#34-推送-master-到远程)
- [4. （可选）将 master 最新代码同步到 gray](#4-可选将-master-最新代码同步到-gray)
- [5. 常见错误及排解（重点）](#5-常见错误及排解重点)
- [6. 验证合并结果（查看干净的主线历史）](#6-验证合并结果查看干净的主线历史)
- [7. 快速命令清单（速查）](#7-快速命令清单速查)
- [8. 注意事项](#8-注意事项)
- [9. GitLab 受保护分支与非保护分支冲突处理策略](#9-gitlab-受保护分支与非保护分支冲突处理策略)
  - [9.1 受保护分支（master / main）冲突处理](#91-受保护分支master--main冲突处理)
  - [9.2 非保护分支（gray / test）冲突处理](#92-非保护分支gray--test冲突处理)
  - [9.3 核心原则与注意事项](#93-核心原则与注意事项)

---

## 1. 准备工作（无论合并到哪个分支，先执行）

```bash
# 确保本地所有分支信息是最新的
git fetch --all

# 确保当前在要合并的目标分支（例如 gray 或 master）上
git checkout <目标分支>
git pull origin <目标分支>
```

---

## 2. 合并到测试分支 `gray`

### 2.1 切换到 gray 并拉取最新代码
```bash
git checkout gray
git pull origin gray
```

### 2.2 执行合并（强制产生合并提交）
```bash
git merge feat/xxx --no-ff -m "feat: 合并 xxx 功能到 gray 测试"
```

> **说明**：
> - `--no-ff` 确保即使可以快进（fast-forward），也生成一个双父提交。
> - `-m` 后面的信息可自定义，若不加会弹出编辑器让你编辑。

### 2.3 如果出现冲突（Automatic merge failed）
1. **查看冲突文件**：`git status`（红色 `both modified` 的文件）。
2. **手动编辑冲突文件**：删除 `<<<<<<<`、`=======`、`>>>>>>>` 标记，保留你需要的内容。
3. **标记已解决**：`git add <冲突文件>`（可多个）。
4. **完成合并**：`git merge --continue`（会生成合并提交）。
5. **若想放弃本次合并**（比如冲突太复杂）：`git merge --abort` 回到合并前状态。

### 2.4 推送 gray 到远程
```bash
git push origin gray
```

---

## 3. 合并到生产分支 `master`

> **注意**：如果你的流程是直接从 `feat/xxx` 合到 `master`（而不经过 `gray`），请直接执行下面的步骤，跳过 `gray` 相关操作。

### 3.1 切换到 master 并拉取最新代码
```bash
git checkout master
git pull origin master
```

### 3.2 执行合并（强制产生合并提交）
```bash
git merge feat/xxx --no-ff -m "feat: 合并 xxx 功能上线"
```

### 3.3 处理冲突（同 2.3 节）
- 若出现冲突，按 2.3 的步骤解决并 `git merge --continue`。
- 若想中止：`git merge --abort`。

### 3.4 推送 master 到远程
```bash
git push origin master
```

---

## 4. （可选）将 master 最新代码同步到 gray
在 `master` 上线后，若 `gray` 需要同步最新生产代码（保持环境一致），可执行：
```bash
git checkout gray
git pull origin gray
git merge master --no-ff -m "chore: 同步 master 最新代码"
# 若有冲突，按 2.3 解决
git push origin gray
```

---

## 5. 常见错误及排解（重点）

| 错误现象 | 可能原因 | 解决方法 |
| :--- | :--- | :--- |
| `fatal: options '--squash' and '--no-ff.' cannot be used together` | 你的全局或仓库配置中默认开启了 `--no-ff`，而你错误地使用了 `--squash`。 | **既然我们要合并提交，就不使用 `--squash`**，只用 `git merge --no-ff`。 |
| `Automatic merge failed; fix conflicts` | 两个分支修改了同一文件的同一区域。 | 参照 2.3 节解决冲突，然后 `git add` + `git merge --continue`。 |
| `error: You have not concluded your merge (MERGE_HEAD exists)` | 之前有未完成（卡住）的合并。 | 执行 `git merge --abort` 放弃本次合并，重新开始。 |
| `fatal: refusing to merge unrelated histories` | 两个分支没有共同的祖先（例如新仓库）。 | 加上 `--allow-unrelated-histories` 重试：<br>`git merge feat/xxx --no-ff --allow-unrelated-histories`。 |
| 合并完成后想撤销（未推送） | 合并提交只在本地。 | 执行 `git reset --hard HEAD~1` 回退一个提交（丢弃改动）。 |
| 合并完成后想撤销（已推送） | 不能直接 `reset`，会破坏远程历史。 | 执行 `git revert -m 1 <合并提交的hash>` 生成反向提交，再推送。 |
| `git merge --continue` 报错 "no merge in progress" | 你误以为还在合并中，实际已结束。 | 无需继续，直接 `git push` 即可。 |

---

## 6. 验证合并结果（查看干净的主线历史）
```bash
git log --oneline --graph --first-parent
```
该命令会只显示当前分支的主干提交（每个合并点只显示一行），隐藏分支上的细碎提交，便于审查。

---

## 7. 快速命令清单（速查）

```bash
# 合并到 gray
git checkout gray && git pull
git merge feat/xxx --no-ff -m "feat: 合并 xxx 到 gray"
# 解决冲突（若有）
git push origin gray

# 合并到 master
git checkout master && git pull
git merge feat/xxx --no-ff -m "feat: 合并 xxx 上线"
# 解决冲突（若有）
git push origin master

# 同步 master 到 gray（可选）
git checkout gray && git pull
git merge master --no-ff -m "chore: 同步 master"
git push origin gray

# 中止卡住的合并
git merge --abort
```

---

## 8. 注意事项
- 合并前**务必确认**当前分支已切换正确（`git branch` 查看）。
- 所有合并操作前，**先拉取远程最新代码**（`git pull`），避免冲突。
- 如果 `feat/xxx` 分支已合并完毕，可以删除它（本地和远程）以保持整洁：
  ```bash
  git branch -d feat/xxx
  git push origin --delete feat/xxx
  ```

---

## 9. GitLab 受保护分支与非保护分支冲突处理策略

在 GitLab 中，合并请求（MR/PR）出现冲突时，处理方式取决于目标分支是否为受保护分支。核心原则：**受保护分支冲突时，将目标分支合并入源分支解决；非保护分支冲突时，直接在目标分支解决，避免反向合并污染源分支。**

### 9.1 受保护分支（master / main）冲突处理

受保护分支通常禁止直接 push，必须通过 MR 合并。当开发分支 `feature/xxx` 合并到 `master` 或 `main` 出现冲突时，标准做法：

1. 切换到源分支（开发分支）：
   ```bash
   git checkout feature/xxx
   git pull origin feature/xxx
   ```
2. 获取目标分支最新代码并合并到当前分支：
   ```bash
   git fetch origin
   git merge origin/master --no-ff -m "chore: 合并 master 解决冲突"
   # 或 git merge origin/main --no-ff ...
   ```
3. 解决冲突：编辑冲突文件，`git add`，`git merge --continue`。
4. 推送到远程源分支：
   ```bash
   git push origin feature/xxx
   ```
5. 回到 GitLab MR 页面，冲突消失，可继续合并。

> 说明：将 `master`/`main` 合并入 `feature` 分支，不会污染受保护分支，同时让 MR 变为可合并状态。

### 9.2 非保护分支（gray / test）冲突处理

非保护分支如 `gray`、`test` 通常允许直接 push，也不强制走 MR。当开发分支 `feature/xxx` 需要合并到 `gray` 出现冲突时：

- **推荐做法**：直接切换到目标分支（如 `gray`），拉取最新，然后合并开发分支并在目标分支解决冲突。
  ```bash
  git checkout gray
  git pull origin gray
  git merge feature/xxx --no-ff -m "feat: 合并 xxx 到 gray"
  # 解决冲突
  git add .
  git merge --continue
  git push origin gray
  ```
- **不要反向操作**：不要把 `gray` 或 `test` 合并回 `feature/xxx`。因为 `gray`/`test` 可能包含其他未上线的测试代码或临时提交，反向合并会把这些内容带入开发分支，污染开发分支，导致后续合并到 `master` 时引入不该上线的代码。

### 9.3 核心原则与注意事项

| 场景 | 目标分支 | 冲突解决方向 | 原因 |
|---|---|---|---|
| 开发分支 → 受保护分支 | `master` / `main` | 将目标分支合并入源分支（`master` → `feature`） | 受保护分支不能直接改，通过 MR 合并；避免污染受保护分支 |
| 开发分支 → 非保护分支 | `gray` / `test` | 直接在目标分支解决（`gray` 合并 `feature`） | 非保护分支可直接 push；避免反向合并污染开发分支 |
| 反向合并 | 任何情况 | 禁止将 `gray`/`test` 合并回 `feature` | 会引入测试环境代码，污染开发分支 |

- 无论使用命令行还是 PhpStorm、VS Code 等 IDE，合并逻辑一致。
- 解决冲突后，务必本地验证代码可运行，再 push。
- 受保护分支的 MR 冲突解决后，MR 会自动更新。

---
