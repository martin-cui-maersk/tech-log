# Git 开发与部署标准作业流程 (SOP)

本文档记录了从建立功能分支到合并、部署、维护分支的常用 Git 命令流程，供团队统一规范参考。

---

## 📑 目录

- [1. 创建全新功能分支](#1-创建全新功能分支-create-new-branch)
- [2. 合并代码至测试分支](#2-合并代码至测试分支-merge-to-test)
- [3. 合并结果处理](#3-合并结果处理-conditional-branching)
- [4. 删除分支](#4-删除分支-delete-branch)
- [5. 重命名分支](#5-重命名分支-rename-branch)
- [6. 从其他分支检出文件](#6-从其他分支检出文件-checkout-file-from-another-branch)
- [7. 分支对比](#7-分支对比-compare-branches)
- [8. 暂存与恢复改动](#8-暂存与恢复改动-stash)
- [9. 撤销改动](#9-撤销改动-undo-changes)
- [10. 修改最近提交](#10-修改最近提交-commit--amend)
- [11. 交互式变基整理提交](#11-交互式变基整理提交-rebase--i)
- [12. 打标签与发布版本](#12-打标签与发布版本-tag)
- [13. 挑选提交](#13-挑选提交-cherry-pick)
- [14. 查看状态与历史](#14-查看状态与历史-status--log)
- [15. 清理未跟踪文件](#15-清理未跟踪文件-clean)
- [16. 安全回滚已推送提交](#16-安全回滚已推送提交-revert)
- [17. 误操作恢复 (Reflog)](#17-误操作恢复-reflog)
- [18. 多分支并行开发 (Worktree)](#18-多分支并行开发-worktree)
- [19. 筛选提交历史](#19-筛选提交历史)
- [20. 打包归档代码 (Archive)](#20-打包归档代码-archive)
- [21. 统计贡献 (Shortlog)](#21-统计贡献-shortlog)
- [22. 常用配置与别名 (Config)](#22-常用配置与别名-config)

---

## 📅 1. 创建全新功能分支 (Create New Branch)

开始开发新功能前，务必基于最新的 `master` 分支建立独立的 feature 分支。

```bash
# 1. 切换到主分支
git checkout master

# 2. 拉取远端最新代码
# git pull
# 改用如下方法，历史线：干净的一条直线。所有当前分支的提交，都会被重新“复制并粘贴”到 main 的最新提交之后。
git fetch origin
git rebase origin/master
# 如果你既想用 git pull 同步远程代码，又不想看到密密麻麻的合并提交，可以使用快捷方式 git pull --rebase

# 3. 创建并直接切换到新功能分支
git checkout -b feat/pod-supports-type-B-stores

# 4. 将新分支推送到远端并建立追踪关系
git push -u origin feat/pod-supports-type-B-stores
```

---

## 🧪 2. 合并代码至测试分支 (Merge to Test)

功能开发完成并在本地测试无误后，将代码合并至 `test` 分支进行发布。

```bash
# 1. 切换到测试分支
git checkout test

# 2. 拉取远端 test 的最新代码（避免覆盖他人代码）
git pull origin test

# 3. 将开发分支合并进 test
git merge feat/pod-supports-type-B-stores
```

---

## ⚡ 3. 合并结果处理 (Conditional Branching)

根据 `git merge` 的执行结果，选择执行以下 A 或 B 流程：

### 🟢 情况 A：顺利合并（无冲突）
如果系统提示合并成功，直接将代码推送到远端测试环境。

```bash
# 直接推送到远端
git push origin test
```

### 🔴 情况 B：发生冲突 (If Error / Conflicts)
如果终端提示 `CONFLICT` 错误，请按照以下步骤手动解决：

1. **解冲突**：立刻打开 PhpStorm，点击自动弹出的 **Conflicts** 窗口，点击 **Merge...** 按钮使用图形化三栏界面处理冲突，完成后点击 **Apply**。
2. **提交并推送**：回到终端，执行以下命令完成合并流程。

```bash
# 1. 将解决冲突后的文件加入暂存区
git add .

# 2. 提交合并 Commit 记录
git commit -m "merge: 解决合并 feat/pod-supports-type-B-stores 产生的冲突"

# 3. 推送到远端测试环境
git push origin test
```

> 💡 **安全撤销提示**：
> 如果冲突过于复杂或不小心改坏了，想完全恢复到合并前的状态，请执行：
> `git merge --abort`

---

## 🗑️ 4. 删除分支 (Delete Branch)

功能合并完成并上线后，应及时清理无用分支，保持仓库整洁。

### 🟢 删除本地分支

```bash
# 删除已合并/不再需要的本地分支（需先切到其他分支）
git checkout master
git branch -d feat/pod-supports-type-B-stores

# 强制删除未合并的分支（会丢失该分支上的提交，慎用）
git branch -D feat/pod-supports-type-B-stores
```

### 🔴 删除远程分支

```bash
# 删除远端分支
git push origin --delete feat/pod-supports-type-B-stores

# 或使用更简短的写法
git push origin :feat/pod-supports-type-B-stores
```

> 💡 **提示**：本地分支删除后若远端已删，可清理本地失效的远端追踪引用：
> `git fetch --prune`

---

## ✏️ 5. 重命名分支 (Rename Branch)

当分支命名不规范或需求变更时，需要重命名分支（含本地与远端）。

### 🟢 重命名本地分支

```bash
# 重命名当前所在分支
git branch -m new-branch-name

# 重命名指定分支（无需切换）
git branch -m old-branch-name new-branch-name
```

### 🔴 重命名远程分支（旧分支删除 + 新分支推送）

Git 不支持直接重命名远程分支，需先删除旧远程分支，再将重命名后的本地分支推送上去。

```bash
# 1. 重命名本地分支
git branch -m old-branch-name new-branch-name

# 2. 删除远端旧分支
git push origin --delete old-branch-name

# 3. 推送新分支并建立追踪关系
git push -u origin new-branch-name
```

---

## 📦 6. 从其他分支检出文件 (Checkout File from Another Branch)

当只需要某个分支上的单个/部分文件，而不想切换整个分支时，可直接从指定分支检出文件到当前工作区。

```bash
# 从 hotfix/product-form-body-validation 分支检出指定文件到当前分支
git checkout hotfix/product-form-body-validation -- modules/product/forms/published/UpdateProductForm.php

# 也可一次检出多个文件
git checkout hotfix/product-form-body-validation -- path/to/file1.php path/to/file2.php

# 检出整个目录
git checkout hotfix/product-form-body-validation -- modules/product/forms/
```

> ⚠️ **注意**：该操作会直接用目标分支的文件覆盖当前工作区对应文件（未提交的内容会丢失），执行前请确认当前改动已提交或暂存。

---

## 🔍 7. 分支对比 (Compare Branches)

在合并或删除分支前，常需对比两个分支的差异，确认改动范围。

```bash
# 查看两个分支的文件差异列表（哪些文件被修改）
git diff --name-only master..feat/pod-supports-type-B-stores

# 查看具体代码差异（逐行对比）
git diff master..feat/pod-supports-type-B-stores

# 仅查看当前分支相对 master 落后的/领先的提交
git log --oneline master..feat/pod-supports-type-B-stores

# 对比某文件在两个分支上的差异
git diff master feat/pod-supports-type-B-stores -- modules/product/forms/published/UpdateProductForm.php

# 图形化查看分支分叉情况
git log --graph --oneline --all
```

> 💡 **提示**：`A..B` 表示"在 B 中但不在 A 中"的提交；若想看双向差异可用 `git diff A...B`（三点，对比共同祖先到 B 的差异）。

---

## 💼 8. 暂存与恢复改动 (Stash)

临时需要切换分支但不想提交当前半成品改动时，可用 `stash` 把工作区改动先"藏"起来。

```bash
# 暂存当前所有未提交改动（含暂存区）
git stash

# 暂存并加备注，便于区分
git stash push -m "WIP: product form validation"

# 查看所有暂存列表
git stash list

# 恢复最近一次暂存并把它从列表中移除
git stash pop

# 恢复指定暂存（不删除列表中的记录）
git stash apply stash@{0}

# 丢弃最近一次暂存
git stash drop stash@{0}

# 清空所有暂存
git stash clear
```

> 💡 **提示**：`git stash` 默认不保存未跟踪文件，可加 `-u`（即 `git stash -u`）一并暂存新文件。

---

## ↩️ 9. 撤销改动 (Undo Changes)

根据改动所处的阶段，选择不同方式回退。

```bash
# 丢弃工作区某个文件的修改（尚未 add，不可逆）
git restore modules/product/forms/published/UpdateProductForm.php
# 旧写法等价：git checkout -- modules/product/forms/published/UpdateProductForm.php

# 将已暂存（已 add）的文件撤回工作区，保留修改
git restore --staged modules/product/forms/published/UpdateProductForm.php

# 回退到某次提交，但保留工作区改动（soft：仅撤销 commit）
git reset --soft HEAD~1

# 回退到某次提交，并丢弃工作区与暂存区改动（hard：慎用，会丢失代码）
git reset --hard HEAD~1

# 回退到指定 commit（保留之后改动为未提交状态）
git reset --mixed <commit-hash>
```

> ⚠️ **警告**：`git reset --hard` 会永久丢弃未提交的代码，执行前务必确认。

---

## 📝 10. 修改最近提交 (Commit --amend)

提交后发现漏了文件或 commit message 写错，可修改最近一次提交（未推送时安全）。

```bash
# 补充文件到上一次提交（不修改 message）
git add forgotten-file.php
git commit --amend --no-edit

# 修改上一次提交的 message
git commit --amend -m "feat: 完善商品表单校验逻辑"
```

> ⚠️ **警告**：已推送到远端的提交请勿随意 `--amend`，会改写历史导致他人拉取冲突。如确需改写，需 `git push --force-with-lease` 并通知协作者。

---

## 🔧 11. 交互式变基整理提交 (Rebase -i)

在合并或推送前，整理本地零散提交（合并、修改顺序、改 message）。

```bash
# 对最近 3 次提交进行交互式变基
git rebase -i HEAD~3

# 对某个基准点之后的提交整理
git rebase -i <base-commit-hash>
```

进入编辑界面后，常用指令：
- `pick`：保留该提交
- `reword`：保留但修改 message
- `squash`：将该提交合并到上一个提交
- `fixup`：同 squash 但丢弃该提交的 message
- `drop`：删除该提交
- `edit`：暂停以便修改该提交内容

> ⚠️ **警告**：交互式变基会改写历史，仅用于未推送或本地私有分支；推送后的分支变基需谨慎并通知团队。

---

## 🏷️ 12. 打标签与发布版本 (Tag)

发布正式版本时打 tag 标记里程碑，便于回溯与部署。

```bash
# 创建轻量标签
git tag v1.2.0

# 创建带说明的附注标签（推荐）
git tag -a v1.2.0 -m "release: 商品表单校验 V1.2.0"

# 查看所有标签
git tag

# 查看某标签详情
git show v1.2.0

# 推送单个标签到远端
git push origin v1.2.0

# 推送所有本地标签
git push origin --tags

# 删除本地标签
git tag -d v1.2.0

# 删除远端标签
git push origin --delete v1.2.0
```

---

## 🍒 13. 挑选提交 (Cherry-Pick)

把某个分支上的单个（或多个）提交，复制到当前分支，而不合并整个分支。

```bash
# 将指定提交应用到当前分支
git cherry-pick <commit-hash>

# 挑选多个提交（按书写顺序应用）
git cherry-pick <commit-hash-1> <commit-hash-2>

# 挑选一段连续提交（不包含 from，包含 to）
git cherry-pick <from-hash>..<to-hash>

# 发生冲突时，解决后继续
git add .
git cherry-pick --continue

# 放弃本次 cherry-pick
git cherry-pick --abort
```

---

## 📊 14. 查看状态与历史 (Status & Log)

日常排查与追溯最常用的命令集合。

```bash
# 查看工作区/暂存区状态
git status

# 简洁状态（每文件一行）
git status -s

# 查看提交历史（最新在前）
git log

# 单行精简历史
git log --oneline

# 图形化分支历史
git log --graph --oneline --all

# 查看某文件的提交历史
git log -- modules/product/forms/published/UpdateProductForm.php

# 追溯某文件每一行的最近修改者（含 commit 与作者）
git blame modules/product/forms/published/UpdateProductForm.php

# 查看某次提交的改动内容
git show <commit-hash>
```

---

## 🧹 15. 清理未跟踪文件 (Clean)

删除工作区中未被 Git 跟踪的文件/目录（如编译产物、临时文件）。

```bash
# 预览将被删除的未跟踪文件（dry-run，不真正删除）
git clean -fdn

# 删除未跟踪的文件和目录（慎用）
git clean -fd

# 连被忽略的文件（如 .gitignore 中的）一并删除（极慎用）
git clean -fdx
```

> ⚠️ **警告**：`git clean` 删除的文件无法恢复，建议先执行 `-fdn` 预览确认。

---

## 🔄 16. 安全回滚已推送提交 (Revert)

对已推送到远端、且他人可能已拉取的提交，使用 `revert` 生成"反向提交"来抵消改动，**不改写历史**，最安全。

```bash
# 撤销某次提交（会生成一个新的反向提交）
git revert <commit-hash>

# 撤销最近一次提交
git revert HEAD

# 撤销连续多个提交（逐个生成反向提交）
git revert <oldest-hash>..<newest-hash>

# 撤销但暂不提交，自行检查后手动提交
git revert --no-commit <commit-hash>
```

> 💡 **提示**：与 `git reset --hard` 不同，`revert` 适合公开分支（如 master/test），不会破坏协作者的历史。

---

## ⏪ 17. 误操作恢复 (Reflog)

Git 记录了本地仓库的所有操作（commit、reset、checkout、rebase 等），通过 `reflog` 可回溯历史操作，是误操作的"救命稻草"。

```bash
# 查看本地所有操作历史（含已删除的 commit）
git reflog

# 按分支查看
git reflog show master

# 恢复误删的 commit（找到目标操作的 commit hash，然后 reset 回去）
git reflog                       # 找到误操作前的 commit hash
git reset --hard <target-hash>   # 恢复到误操作前的状态
```

> 💡 **提示**：`reflog` 默认保留 90 天的记录，仅记录本地操作，不会推送或分享给他人。

---

## 🌳 18. 多分支并行开发 (Worktree)

同时在多个分支上工作时，`git worktree` 可创建多个工作目录，无需反复 `stash` / `checkout`，比 `stash` 更优雅。

```bash
# 在指定目录检出另一个工作目录（自动切换分支）
git worktree add ../hotfix-branch hotfix/product-form-body-validation

# 创建新的工作目录并新建分支（基于 master）
git worktree add -b feat/new-feature ../feature-branch master

# 查看所有工作目录
git worktree list

# 移除工作目录（必须先删除或 git checkout 回主目录）
git worktree remove ../hotfix-branch

# 清理失效的工作目录引用
git worktree prune
```

> 💡 **提示**：适合需要同时开发多个功能/修复，又不想频繁切换分支的场景。

---

## 🔍 19. 筛选提交历史

按作者、时间、内容等条件筛选提交记录，便于排查和统计。

```bash
# 按作者筛选
git log --author="张三"

# 按作者筛选（模糊匹配）
git log --author="zhang"

# 按时间筛选（指定日期之后的提交）
git log --since="2024-01-01"

# 按时间筛选（指定日期之前的提交）
git log --until="2024-06-30"

# 组合条件：某作者在某时间段的提交
git log --author="张三" --since="2024-01-01" --until="2024-06-30"

# 按关键词筛选 commit message
git log --grep="fix"

# 查看某次提交的改动文件列表
git diff-tree --no-commit-id -r <commit-hash>

# 只看前 10 条
git log --oneline -10

# 查看某文件最近 5 次修改
git log --oneline -5 -- path/to/file.php
```

---

## 📦 20. 打包归档代码 (Archive)

将指定分支/标签的代码打包为压缩文件（不含 `.git` 目录），适合交付、备份或部署。

```bash
# 打包当前分支的代码为 zip
git archive HEAD -o ../project-HEAD.zip

# 打包指定标签
git archive v1.2.0 -o ../project-v1.2.0.zip

# 打包指定分支的子目录
git archive feat/pod-supports-type-B-stores -- modules/product/ -o ../product-module.zip

# 打包为 tar.gz
git archive v1.2.0 --prefix=v1.2.0/ -o ../project-v1.2.0.tar.gz
```

> 💡 **提示**：`git archive` 只打包已提交的文件，未提交的改动不会包含在内。

---

## 👥 21. 统计贡献 (Shortlog)

快速统计每个人的提交数量，适合汇总贡献报告。

```bash
# 统计所有提交者的提交数（按数量降序）
git shortlog -sn

# 统计某分支的提交者贡献
git shortlog -sn master

# 某作者的提交统计
git shortlog -sn --author="张三"

# 结合时间范围
git shortlog -sn --since="2024-01-01"

# 统计并输出邮件信息
git shortlog -sne
```

---

## ⚙️ 22. 常用配置与别名 (Config)

通过别名简化高频命令，避免反复输入冗长参数。

```bash
# 设置常用别名
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'restore --staged'
git config --global alias.last 'log -1 HEAD'
git config --global alias.lg "log --oneline --graph --all -20"
git config --global alias.today "shortlog -sn --since='midnight'"

# 设置默认编辑器
git config --global core.editor code   # VS Code
git config --global core.editor nano   # Nano

# 设置换行符处理（Windows 推荐）
git config --global core.autocrlf true

# 设置 push 默认行为为只推送当前分支
git config --global push.default current

# 查看所有配置
git config --list

# 查看某个配置
git config user.name
git config --global alias.st

# 重置某个别名
git config --global --unset alias.st
```

> 💡 **提示**：`--global` 表示全局配置（对所有仓库生效），不加则仅对当前仓库生效。
