/**
 * 文档注册表：构建时自动扫描 src/assets/docs 下的所有 markdown 文件。
 *
 * 新增文档时只需要把 .md 文件放进 src/assets/docs（可以建子目录做分类），
 * 不需要修改任何代码，重新构建（npm run build）后即可访问。
 *
 * 访问地址：/docs/<文件名去掉后缀>
 *   src/assets/docs/git-merge.md        -> /docs/git-merge
 *   src/assets/docs/git/workflow.md     -> /docs/workflow
 *   src/assets/docs/01-git-merge.md     -> /docs/git-merge （数字前缀只用于排序）
 *
 * 元信息（标题、分类、排序、简介）由 build/loaders/doc-body-loader.js 在构建时解析，
 * 只有这部分进主包；**正文在单独异步 chunk 里按需加载**（loadDoc / loadAllDocs）。
 *
 * 可选：在文件开头写 front matter 可以覆盖自动推导出来的信息：
 *   ---
 *   title: Git 合并流程完整指南（合并到 gray / master）
 *   navTitle: Git 合并指南
 *   category: Git
 *   order: 1
 *   description: 功能分支合并到 gray/master 的完整流程
 *   slug: git-merge
 *   ---
 */
import { compareDocs } from './docMeta'

const context = require.context('@/assets/docs', true, /\.md$/)

// 每个 md 模块导出 { meta, load }
const entries = context.keys().map(key => {
  const mod = context(key)
  return { key: key, meta: mod.meta, load: mod.load }
})

if (process.env.NODE_ENV !== 'production') {
  const seen = {}
  entries.forEach(entry => {
    if (seen[entry.meta.slug]) {
      console.warn(
        '[docRegistry] 文档 slug 冲突：' + seen[entry.meta.slug] + ' 与 ' + entry.meta.file +
        ' 都会生成 /docs/' + entry.meta.slug + '，请用 front matter 的 slug 字段区分。'
      )
    }
    seen[entry.meta.slug] = entry.meta.file
  })
}

const entryMap = entries.reduce((map, entry) => {
  map[entry.meta.slug] = entry
  return map
}, {})

/** 全部文档的元信息（不含正文），按 order、slug 排序 */
export const docs = entries.map(entry => entry.meta).sort(compareDocs)

/** 按分类分组（侧边栏和首页卡片用），分类顺序取该分类下最靠前文档的 order */
export const categories = (() => {
  const names = []
  const grouped = {}
  docs.forEach(doc => {
    if (!grouped[doc.category]) {
      grouped[doc.category] = []
      names.push(doc.category)
    }
    grouped[doc.category].push(doc)
  })
  return names
    .map(name => ({ name: name, docs: grouped[name] }))
    .sort((a, b) => (a.docs[0].order - b.docs[0].order) || a.name.localeCompare(b.name, 'zh'))
})()

export function getDoc (slug) {
  return entryMap[slug] ? entryMap[slug].meta : null
}

export function hasDoc (slug) {
  return Boolean(entryMap[slug])
}

/** 按需加载单篇正文，返回 Promise<string>；不存在时 resolve(null) */
export function loadDoc (slug) {
  const entry = entryMap[slug]
  return entry ? entry.load() : Promise.resolve(null)
}

/** 按需加载所有正文（首次搜索时用），返回 Promise<[{ meta, content }]> */
export function loadAllDocs () {
  return Promise.all(
    entries.map(entry => entry.load().then(content => ({ meta: entry.meta, content: content })))
  )
}

export function docCount () {
  return entries.length
}
