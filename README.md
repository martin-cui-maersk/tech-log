# 技术随笔

> 个人技术学习笔记与文档

## 简介

这里记录了我在技术学习过程中的心得、笔记和文档。主要涵盖 Git、PHP、算法、网络、设计模式等技术领域。

## 技术栈

- Vue 2 + Vue Router
- Webpack 3
- Markdown-it

## 新增文档（自动扫描，无需改代码）

把 `.md` 文件放进 `src/assets/docs/`，重新构建就完事了：

```bash
cp my-note.md src/assets/docs/
npm run build          # 会重新生成 docs/ 目录（同时生成 404.html）
git add docs src && git commit -m "add my-note" && git push
```

侧边栏、首页“文档导航”和路由都会自动出现这篇文档。

### 命名规则

| 你放的文件 | 访问地址 | 自动识别出的分类 |
| --- | --- | --- |
| `src/assets/docs/git-merge.md` | `/docs/git-merge` | Git（文件名 `-` 前的前缀） |
| `src/assets/docs/php/opcache.md` | `/docs/opcache` | PHP（子目录名） |
| `src/assets/docs/algorithm-binary-tree.md` | `/docs/algorithm-binary-tree` | 算法（前缀 algorithm） |
| `src/assets/docs/01-git-merge.md` | `/docs/git-merge` | Git（数字前缀只用于排序） |

- 标题取正文第一个 `# 一级标题`；不写标题就用文件名。
- 简介取正文第一个普通段落（自动截断），显示在首页列表里。
- 想按分类整理，就在 `src/assets/docs/` 下建子目录，子目录名就是分类名。
- 分类的展示顺序 = 该分类下最靠前的文档的 `order`，再按名称排序。

### 可选：front matter

想让标题/分类/排序更精确，可以在文件开头加一段 front matter（不加也完全能用）：

```markdown
---
title: Git 合并流程完整指南（合并到 gray / master）
navTitle: Git 合并指南     # 侧边栏显示的精简标题
category: Git              # 不写则按子目录名或文件名前缀推导
order: 1                   # 分类内排序，也决定分类之间的顺序
description: 功能分支合并到 gray/master 的完整流程
slug: git-merge            # 自定义访问地址（默认用文件名）
---
# Git 合并流程完整指南（合并到 gray / master）

正文……
```

## 路由

- `/` 首页
- `/docs/:doc` 文档页，`:doc` 就是 `src/assets/docs` 里的文件名（去掉 `.md`）
- `/git/:doc` 旧地址，保留兼容，会自动跳到同一篇文档

## 侧边栏

- **分类可折叠**：点侧边栏里的分类标题（如 `GIT`、`MYSQL`）就能把它下面的文档收起来，标题左边的箭头会跟着转；标题右侧的数字是文档数量。
- 折叠的分类会在 `localStorage` 的 `tech-log:collapsed-groups` 里记住，刷新、跳转后保持。
- 当前正在看的文档所属分类，标题会高亮成主题色；即使它是折叠状态，也能知道自己在哪个分类里。
- 点导航栏左上角的按钮收起 / 展开**整条侧边栏**；收起后正文占满整屏并居中。
- 整条侧边栏的状态存在 `tech-log:sidebar-open` 里。
- 窄屏（≤ 1080px）首次访问默认收起；此时侧边栏是浮层，点开、选中一篇文档后会自动收起。

## 构建

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 生产构建（会生成 docs/，并把 index.html 复制成 404.html）
npm run build
```

> `docs/` 是 GitHub Pages 的发布目录，`docs/404.html` 用于让 `/tech-log/docs/xxx` 这类深层链接能正常刷新。
> 二者都由 `npm run build` 生成，改完文档记得把 `docs/` 一起提交。
>
> 构建产物里的资源路径写死为 `/tech-log/`（`config/index.js` 的 `assetsPublicPath`），
> 与路由 `base` 保持一致。如果仓库改名或换成自定义域名，这两个地方要一起改。

## 说明

- 所有 markdown 内容都会打进 `app.js`，所以**新增文件后必须重新构建**才能在页面上看到；`npm run dev` 挂着时 webpack 会自动重建。
- 文档多了以后 `app.js` 会变大，如果明显影响首屏加载，可以把文档改成按需加载（`import()` 分包）。
- markdown 里引用图片时建议用绝对路径 `/tech-log/static/img/xxx.png`，图片放在 `static/` 目录下。

## 版本

- v1.0.0 (2026-09-29) - 初始版本，包含 Git 模块文档
