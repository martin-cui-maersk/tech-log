---
title: Git 合并流程完整指南（test → gray → main）
navTitle: Git 合并指南
category: Git
order: 1
description: 功能分支经 test、gray 两级验证后合并到 main 的完整流程
---
# Git 合并流程完整指南（test → gray → main）

> **适用场景**：功能分支 `feat/xxx` 开发完成后，依次合并到 `test`（测试）、`gray`（灰度/预发布），验证通过后再合并到 `main` 上线。
> **分支链**：`feat/xxx → test → gray → main`，**只向前合并，禁止反向合并**。
> **核心要求**：所有合并操作**必须产生合并提交（merge commit）**，便于追溯和回滚。
> **命名口径**：`test` 为测试分支、`gray` 为灰度/预发布分支、`main` 为生产分支；本文与《Git 开发与部署标准作业流程 (SOP)》《Git 合并方向搞错如何回滚》使用同一套命名。

---

## 目录

- [1. 准备工作（无论合并到哪个分支，先执行）](#1-准备工作无论合并到哪个分支先执行)
- [2. 合并到测试分支 `test`（feat/xxx → test）](#2-合并到测试分支-testfeatxxx-test)
  - [2.1 切换到 test 并拉取最新代码](#21-切换到-test-并拉取最新代码)
  - [2.2 执行合并（强制产生合并提交）](#22-执行合并强制产生合并提交)
  - [2.3 如果出现冲突（Automatic merge failed）](#23-如果出现冲突automatic-merge-failed)
  - [2.4 推送 test 到远程](#24-推送-test-到远程)
- [3. 合并到灰度分支 `gray`（test → gray）](#3-合并到灰度分支-graytest-gray)
  - [3.1 切换到 gray 并拉取最新代码](#31-切换到-gray-并拉取最新代码)
  - [3.2 执行合并（test → gray）](#32-执行合并test-gray)
  - [3.3 处理冲突（同 2.3 节）](#33-处理冲突同-23-节)
  - [3.4 推送 gray 到远程](#34-推送-gray-到远程)
- [4. 合并到生产分支 `main`（gray → main）](#4-合并到生产分支-maingray-main)
  - [4.1 切换到 main 并拉取最新代码](#41-切换到-main-并拉取最新代码)
  - [4.2 执行合并（gray → main）](#42-执行合并gray-main)
  - [4.3 处理冲突（同 2.3 节）](#43-处理冲突同-23-节)
  - [4.4 推送 main 到远程](#44-推送-main-到远程)
- [5. （可选）将 main 最新代码同步回 gray / test](#5-可选将-main-最新代码同步回-gray-test)
- [6. 常见错误及排解（重点）](#6-常见错误及排解重点)
- [7. 验证合并结果（查看干净的主线历史）](#7-验证合并结果查看干净的主线历史)
- [8. 快速命令清单（速查）](#8-快速命令清单速查)
- [9. 注意事项](#9-注意事项)
- [10. GitLab 受保护分支与非保护分支冲突处理策略](#10-gitlab-受保护分支与非保护分支冲突处理策略)
  - [10.1 受保护分支（main / gray）冲突处理](#101-受保护分支main-gray冲突处理)
  - [10.2 非保护分支（test）冲突处理](#102-非保护分支test冲突处理)
  - [10.3 核心原则与注意事项](#103-核心原则与注意事项)

---

## 1. 准备工作（无论合并到哪个分支，先执行）

```bash
# 确保本地所有分支信息是最新的
git fetch --all

# 确保当前在要合并的目标分支（test / gray / main 之一）上
git checkout <目标分支>
git pull origin <目标分支>
```

---

## 2. 合并到测试分支 `test`（feat/xxx → test）

### 2.1 切换到 test 并拉取最新代码
```bash
git checkout test
git pull origin test
```

### 2.2 执行合并（强制产生合并提交）
```bash
git merge feat/xxx --no-ff -m "feat: 合并 xxx 功能到 test"
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

### 2.4 推送 test 到远程
```bash
git push origin test
```

---

## 3. 合并到灰度分支 `gray`（test → gray）

测试环境验证通过后，把 `test` 整体推进到 `gray` 做灰度/预发布验证。

### 3.1 切换到 gray 并拉取最新代码
```bash
git checkout gray
git pull origin gray
```

### 3.2 执行合并（test → gray）
```bash
git merge test --no-ff -m "chore: 合并 test 到 gray 灰度"
```

> **说明**：这里合并的是 `test`，**不要再合并 `feat/xxx`**。`test` 上可能同时包含多个功能分支的合并结果，逐级推进才能保证 `gray` 与 `main` 拿到的是同一批代码。

### 3.3 处理冲突（同 2.3 节）
- 若出现冲突，按 2.3 的步骤解决并 `git merge --continue`。
- 若想中止：`git merge --abort`。

### 3.4 推送 gray 到远程
```bash
git push origin gray
```

---

## 4. 合并到生产分支 `main`（gray → main）

灰度验证通过后，把 `gray` 推进到 `main` 上线。

### 4.1 切换到 main 并拉取最新代码
```bash
git checkout main
git pull origin main
```

### 4.2 执行合并（gray → main）
```bash
git merge gray --no-ff -m "release: 合并 gray 到 main 上线"
```

### 4.3 处理冲突（同 2.3 节）
- 若出现冲突，按 2.3 的步骤解决并 `git merge --continue`。
- `main` 通常是受保护分支，不能直接 push；冲突处理策略见第 10 节。

### 4.4 推送 main 到远程
```bash
git push origin main
```

---

## 5. （可选）将 main 最新代码同步回 gray / test

`main` 上线后（例如线上热修复），若 `gray`、`test` 需要同步最新生产代码以保持环境一致，按**从下游往回**的顺序执行：

```bash
# main → gray
git checkout gray && git pull origin gray
git merge main --no-ff -m "chore: 同步 main 最新代码到 gray"
# 若有冲突，按 2.3 解决
git push origin gray

# gray → test
git checkout test && git pull origin test
git merge gray --no-ff -m "chore: 同步 gray 最新代码到 test"
git push origin test
```

> ⚠️ 这是**唯一的反向同步场景**，目的是让测试/灰度环境追上生产代码；日常功能合并仍然只能 `feat/xxx → test → gray → main` 单向推进。

---

## 6. 常见错误及排解（重点）

| 错误现象 | 可能原因 | 解决方法 |
| :--- | :--- | :--- |
| `fatal: options '--squash' and '--no-ff.' cannot be used together` | 你的全局或仓库配置中默认开启了 `--no-ff`，而你错误地使用了 `--squash`。 | **既然我们要合并提交，就不使用 `--squash`**，只用 `git merge --no-ff`。 |
| `Automatic merge failed; fix conflicts` | 两个分支修改了同一文件的同一区域。 | 参照 2.3 节解决冲突，然后 `git add` + `git merge --continue`。 |
| `error: You have not concluded your merge (MERGE_HEAD exists)` | 之前有未完成（卡住）的合并。 | 执行 `git merge --abort` 放弃本次合并，重新开始。 |
| `fatal: refusing to merge unrelated histories` | 两个分支没有共同的祖先（例如新仓库）。 | 加上 `--allow-unrelated-histories` 重试：<br>`git merge feat/xxx --no-ff --allow-unrelated-histories`。 |
| 合并完成后想撤销（未推送） | 合并提交只在本地。 | 执行 `git reset --hard HEAD~1` 回退一个提交（丢弃改动）。 |
| 合并完成后想撤销（已推送） | 不能直接 `reset`，会破坏远程历史。 | 执行 `git revert -m 1 <合并提交的hash>` 生成反向提交，再推送。 |
| `git merge --continue` 报错 "no merge in progress" | 你误以为还在合并中，实际已结束。 | 无需继续，直接 `git push` 即可。 |
| `test` 的代码没进 `gray` | 在 `gray` 上又合并了 `feat/xxx`，跳过了 `test`。 | 按第 3 节从 `test` 逐级推进，不要跳级合并。 |

---

## 7. 验证合并结果（查看干净的主线历史）

```bash
git log --oneline --graph --first-parent
```
该命令会只显示当前分支的主干提交（每个合并点只显示一行），隐藏分支上的细碎提交，便于审查。

---

## 8. 快速命令清单（速查）

```bash
# ① feat/xxx → test
git checkout test && git pull
git merge feat/xxx --no-ff -m "feat: 合并 xxx 到 test"
# 解决冲突（若有）
git push origin test

# ② test → gray
git checkout gray && git pull
git merge test --no-ff -m "chore: 合并 test 到 gray"
git push origin gray

# ③ gray → main
git checkout main && git pull
git merge gray --no-ff -m "release: 合并 gray 到 main"
git push origin main

# 回同步（可选）：main → gray → test
git checkout gray && git pull && git merge main --no-ff -m "chore: 同步 main"
git push origin gray
git checkout test && git pull && git merge gray --no-ff -m "chore: 同步 gray"
git push origin test

# 中止卡住的合并
git merge --abort
```

---

## 9. 注意事项
- 合并前**务必确认**当前分支已切换正确（`git branch --show-current`）。
- 所有合并操作前，**先拉取远程最新代码**（`git pull`），避免冲突。
- **逐级推进**：`gray` 只从 `test` 合并，`main` 只从 `gray` 合并，不要跳级直接合 `feat/xxx`。
- 如果 `feat/xxx` 分支已合并完毕，可以删除它（本地和远程）以保持整洁：
  ```bash
  git branch -d feat/xxx
  git push origin --delete feat/xxx
  ```

---

## 10. GitLab 受保护分支与非保护分支冲突处理策略

在 GitLab 中，合并请求（MR/PR）出现冲突时，处理方式取决于目标分支是否为受保护分支。核心原则：**受保护分支冲突时，将目标分支合并入源分支解决；非保护分支冲突时，直接在目标分支解决，避免反向合并污染源分支。**

> 本节讲的是 MR 冲突的**通用处理方式**（GitLab 层面），示例只区分「源分支 / 目标分支」；正式的代码推进路径仍以第 2–4 节的 `feat/xxx → test → gray → main` 逐级推进为准，不要据此把功能分支直接合到 `gray` / `main`。

### 10.1 受保护分支（main / gray）冲突处理

受保护分支通常禁止直接 push，必须通过 MR 合并。当 MR 的目标分支是 `main` / `gray` 且出现冲突时，标准做法：

1. 切换到 MR 的源分支：
   ```bash
   git checkout <源分支>
   git pull origin <源分支>
   ```
2. 获取目标分支最新代码并合并到当前分支：
   ```bash
   git fetch origin
   git merge origin/main --no-ff -m "chore: 合并 main 解决冲突"
   # 目标是 gray 时：git merge origin/gray --no-ff ...
   ```
3. 解决冲突：编辑冲突文件，`git add`，`git merge --continue`。
4. 推送到远程源分支：
   ```bash
   git push origin <源分支>
   ```
5. 回到 GitLab MR 页面，冲突消失，可继续合并。

> 说明：将 `main` / `gray` 合并入 MR 的源分支，不会污染受保护分支，同时让 MR 变为可合并状态。这是**解决冲突的临时动作**，不改变 `test → gray → main` 的逐级推进规则。

### 10.2 非保护分支（test）冲突处理

非保护分支 `test` 通常允许直接 push，也不强制走 MR。当 `feat/xxx` 需要合并到 `test` 出现冲突时：

- **推荐做法**：直接切换到目标分支 `test`，拉取最新，然后合并功能分支并在目标分支解决冲突。
  ```bash
  git checkout test
  git pull origin test
  git merge feat/xxx --no-ff -m "feat: 合并 xxx 到 test"
  # 解决冲突
  git add .
  git merge --continue
  git push origin test
  ```
- **不要反向操作**：不要把 `test` 或 `gray` 合并回 `feat/xxx`。因为 `test` / `gray` 可能包含其他未上线的测试代码或临时提交，反向合并会把这些内容带入开发分支，导致后续推进到 `main` 时引入不该上线的代码。这类误操作的回滚方式见《Git 合并方向搞错如何回滚》。

### 10.3 核心原则与注意事项

| 场景 | 目标分支 | 冲突解决方向 | 原因 |
|---|---|---|---|
| MR 目标为受保护分支 | `main` / `gray` | 将目标分支合并入源分支（`main` → 源分支） | 受保护分支不能直接改，通过 MR 合并；避免污染受保护分支 |
| 合并目标为非保护分支 | `test` | 直接在目标分支解决（`test` 合并 `feat/xxx`） | 非保护分支可直接 push；避免反向合并污染开发分支 |
| 反向合并 | 任何情况 | 禁止将 `test`/`gray` 合并回 `feat/xxx` | 会引入测试/灰度环境代码，污染开发分支 |

- 无论使用命令行还是 PhpStorm、VS Code 等 IDE，合并逻辑一致。
- 解决冲突后，务必本地验证代码可运行，再 push。
- 受保护分支的 MR 冲突解决后，MR 会自动更新。
