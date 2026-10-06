/**
 * 文档注册表：构建时自动扫描 src/assets/docs 目录下的所有 markdown 文件。
 *
 * 新增文档时只需要把 .md 文件放进 src/assets/docs（可以建子目录做分类），
 * 不需要修改任何代码，重新构建（npm run build）后即可访问。
 *
 * 访问地址：/docs/<文件名去掉后缀>
 *   src/assets/docs/git-merge.md        -> /docs/git-merge
 *   src/assets/docs/git/workflow.md     -> /docs/workflow
 *   src/assets/docs/01-git-merge.md     -> /docs/git-merge （数字前缀只用于排序）
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
 *
 * 不写 front matter 时全部自动推导：
 *   title/navTitle -> 正文第一个 "# 标题"
 *   category       -> 子目录名，或文件名第一个 "-" 之前的前缀（git-merge -> Git）
 *   order          -> 文件名开头的数字前缀（01-xxx -> 1）
 *   description    -> 正文第一个普通段落（截断显示）
 */
const context = require.context('@/assets/docs', true, /\.md$/)

// 常见的分类前缀 -> 展示名，未命中的分类会把首字母大写
const CATEGORY_NAMES = {
  algo: '算法',
  algorithm: '算法',
  css: 'CSS',
  docker: 'Docker',
  git: 'Git',
  html: 'HTML',
  hyperf: 'Hyperf',
  java: 'Java',
  js: 'JavaScript',
  javascript: 'JavaScript',
  k8s: 'Kubernetes',
  linux: 'Linux',
  mysql: 'MySQL',
  network: '网络',
  nginx: 'Nginx',
  node: 'Node.js',
  other: '其他',
  php: 'PHP',
  python: 'Python',
  react: 'React',
  redis: 'Redis',
  sql: 'SQL',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  vue: 'Vue'
}

const DEFAULT_CATEGORY = '未分类'
const DESCRIPTION_MAX = 80

// ---------- front matter ----------

function parseFrontMatter (raw) {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw)
  if (!match) {
    return { meta: {}, body: raw }
  }
  const meta = {}
  match[1].split(/\r?\n/).forEach(line => {
    const item = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim())
    if (!item) {
      return
    }
    let value = item[2].trim()
    if (/^(['"]).*\1$/.test(value)) {
      value = value.slice(1, -1)
    }
    if (value !== '') {
      meta[item[1].toLowerCase()] = value
    }
  })
  return { meta, body: raw.slice(match[0].length) }
}

// ---------- 正文内容提取 ----------

function cleanInline (text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate (text, max) {
  return text.length > max ? text.slice(0, max).trim() + '…' : text
}

function extractTitle (body) {
  let inFence = false
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }
    const heading = /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      return cleanInline(heading[1])
    }
  }
  return ''
}

function extractDescription (body) {
  let inFence = false
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence || line === '') {
      continue
    }
    if (/^#{1,6}\s/.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      continue
    }
    if (/^\|/.test(line) || /^\[.+\]:/.test(line) || /^!\[/.test(line) || /^<img/i.test(line)) {
      continue
    }
    return truncate(cleanInline(line.replace(/^>+\s?/, '')), DESCRIPTION_MAX)
  }
  return ''
}

// ---------- 元信息推导 ----------

function prettyCategory (name) {
  const key = String(name).trim().toLowerCase()
  if (!key) {
    return ''
  }
  return CATEGORY_NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1)
}

function fallbackCategory (dir, baseName) {
  if (dir) {
    const lastSegment = dir.split('/').filter(Boolean).pop()
    const fromDir = prettyCategory(lastSegment.replace(/^\d+[-_.\s]+/, ''))
    if (fromDir) {
      return fromDir
    }
  }
  const prefix = /^([A-Za-z\u4e00-\u9fa5]+)[-_]/.exec(baseName)
  return prefix ? prettyCategory(prefix[1]) : DEFAULT_CATEGORY
}

function sanitizeSlug (value) {
  const slug = String(value)
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.toLowerCase()
}

function toOrder (value, fallback) {
  const order = parseInt(value, 10)
  return isNaN(order) ? fallback : order
}

function buildDoc (key, raw) {
  const parsed = parseFrontMatter(raw)
  const meta = parsed.meta
  const body = parsed.body

  const filePath = key.replace(/^\.\//, '')
  const segments = filePath.split('/')
  const fileName = segments.pop().replace(/\.md$/i, '')
  const dir = segments.join('/')

  const orderPrefix = /^(\d+)[-_.\s]+(.+)$/.exec(fileName)
  const baseName = (orderPrefix ? orderPrefix[2] : fileName).trim()
  const order = toOrder(meta.order, orderPrefix ? parseInt(orderPrefix[1], 10) : 0)

  const title = meta.title || extractTitle(body) || baseName
  return {
    slug: sanitizeSlug(meta.slug || baseName) || sanitizeSlug(fileName),
    title: title,
    navTitle: meta.navtitle || meta['nav-title'] || title,
    category: prettyCategory(meta.category || meta.group || '') || fallbackCategory(dir, baseName),
    description: meta.description || extractDescription(body),
    order: order,
    date: meta.date || '',
    file: filePath,
    content: body.trim()
  }
}

function compareDocs (a, b) {
  if (a.order !== b.order) {
    return a.order - b.order
  }
  return a.slug.localeCompare(b.slug)
}

// ---------- 扫描 & 导出 ----------

const scanned = context.keys().map(key => buildDoc(key, context(key)))

if (process.env.NODE_ENV !== 'production') {
  const seen = {}
  scanned.forEach(doc => {
    if (seen[doc.slug]) {
      console.warn(
        '[docRegistry] 文档 slug 冲突：' + seen[doc.slug] + ' 与 ' + doc.file +
        ' 都会生成 /docs/' + doc.slug + '，请用 front matter 的 slug 字段区分。'
      )
    }
    seen[doc.slug] = doc.file
  })
}

export const docs = scanned.sort(compareDocs)

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

const docMap = docs.reduce((map, doc) => {
  map[doc.slug] = doc
  return map
}, {})

export function getDoc (slug) {
  return docMap[slug] || null
}

export function hasDoc (slug) {
  return Boolean(docMap[slug])
}
