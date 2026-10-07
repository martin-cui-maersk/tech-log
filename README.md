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
- 窄屏（≤ 1080px）下侧边栏是浮层，**无论之前选过什么都默认收起**；点开、选中一篇文档后会自动收起。

## 主题（浅色 / 深色）

- 导航栏右上角的按钮切换浅色 / 深色，图标表示「将要切到的模式」：浅色时显示月亮，深色时显示太阳。
- 首次访问跟随系统 `prefers-color-scheme`；用户点过切换按钮后，选择记在 `localStorage` 的 `tech-log:theme`，之后不再跟随系统。
- 想恢复「跟随系统」：`localStorage.removeItem('tech-log:theme')` 后刷新。
- 主题通过 `<html data-theme="light|dark">` 生效：
  - 颜色变量都在 [src/App.vue](src/App.vue) 的 `:root`（浅色）和 `html[data-theme='dark']`（深色）里；
  - 新增样式请用变量（例如 `var(--surface-2)`、`var(--heading-text)`），不要写死颜色，否则深色模式下会不协调；
  - [index.html](index.html) 里有一段内联脚本，在首屏渲染前就设好 `data-theme`，避免深色模式刷新时闪白；它用的 localStorage key 必须和 [src/utils/theme.js](src/utils/theme.js) 一致。

## 搜索

- 导航栏的搜索框（窄屏是图标，点开是整屏浮层）对**所有文档正文**做全文检索，纯前端实现，**不需要任何新依赖、不需要后端**，离线也能用。
- 快捷键：`/` 或 `Ctrl/Cmd + K` 聚焦搜索框，`↑` `↓` 选择结果，`Enter` 打开，`Esc` 关闭。
- 结果是**按小节**给的，点进去会直接滚到对应小节（自动留出固定导航栏的高度），命中的关键词会高亮。
- 多个关键词用空格分隔，是「全部命中」的关系，例如 `索引 区分度`；排序权重：文档标题 > 小节标题 > 正文（出现次数多、位置靠前的更优先）。
- 实现都在 [src/utils/docSearch.js](src/utils/docSearch.js)：**正文 chunk 加载后**构建一次索引（按 h1~h4 切小节）并缓存；标题锚点用 [src/utils/anchor.js](src/utils/anchor.js) 的规则，和 MarkdownViewer 生成标题 id 的逻辑共用，保证搜索结果能精确跳转。
- 索引不在首屏加载：鼠标移到搜索框、点进输入框、按 `/` 或 `Ctrl/Cmd + K` 时才开始加载（见下面的「按需加载」）。没准备好的那一瞬间会显示「正在准备搜索索引…」。
- 文档内容变了（新增 / 修改 md）需要重新构建才能被搜到，这和自动扫描是同一套逻辑。

## 按需加载

首屏只需要"外壳 + 文档元信息"，正文和 markdown-it 都放在异步 chunk 里，用户真正要看文档或搜索时才下载。

| 产物 | 大小 | 何时加载 |
| --- | --- | --- |
| `vendor.js`（vue / vue-router） | ~147 KB | 首屏 |
| `app.js`（页面、组件、文档**元信息**、搜索逻辑） | ~31 KB | 首屏 |
| `docs-body.js`（全部文档正文） | ~164 KB | 打开任意文档，或首次搜索时 |
| `markdown.js`（markdown-it 及其依赖） | ~95 KB | 同上 |

机制：

- [build/loaders/doc-body-loader.js](build/loaders/doc-body-loader.js) 把每个 `.md` 编译成 `{ meta, load() }`：`meta`（标题/分类/排序/简介）进主包，`load()` 通过 `require.ensure` 从 `docs-body` chunk 按需取正文；元信息解析规则放在 [src/utils/docMeta.js](src/utils/docMeta.js)，构建（loader）和运行（浏览器）共用一份。
- markdown-it 只在「渲染正文」和「建搜索索引」时用到，所以改成 [src/utils/markdown.js](src/utils/markdown.js) 里的 `loadMarkdownIt()` 动态 import；同时 `build/webpack.prod.conf.js` 的 `CommonsChunkPlugin` 把它和它的依赖排除出首屏 vendor。
- 深链接带 `#锚点` 时，路由的 `scrollBehavior` 执行时元素还没渲染，所以 [src/components/DocsView.vue](src/components/DocsView.vue) 在正文渲染完成后（MarkdownViewer 的 `rendered` 事件）再定位一次。

## 首页

- 首页结构参考 VitePress：**Hero**（大标题 + 一句话 + 「N 篇文档 · M 个分类」+ 「开始阅读」「按分类浏览」两个按钮）+ **分类卡片网格**（图标 / 分类名 / 文档数 / 该分类下的文档列表 / 「开始阅读 →」）。
- 卡片、统计数字、按钮指到的文档**全部由文档扫描结果生成**，新增分类或文档后无需改代码；图标在 `src/components/Home.vue` 的 `CATEGORY_ICONS` 里配置，没配置的分类用默认图标。
- 导航栏左侧有常驻的「**首页**」按钮（窄屏只留图标），当前在首页时会高亮。

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

- markdown 内容按需加载（见上面的「按需加载」），但**新增文件后仍然必须重新构建**才能在页面上看到；`npm run dev` 挂着时 webpack 会自动重建。
- markdown 里引用图片时建议用绝对路径 `/tech-log/static/img/xxx.png`，图片放在 `static/` 目录下。
- 右下角有「回到顶部」按钮：往下滚超过 300px 才出现，点击平滑滚回顶部；点侧边栏切换文档会自动回到页面顶部（浏览器前进/后退时恢复原来位置）。阈值在 `src/App.vue` 的 `BACK_TO_TOP_OFFSET`。

## 版本

- v1.0.0 (2026-09-29) - 初始版本，包含 Git 模块文档
