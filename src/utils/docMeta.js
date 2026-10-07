/**
 * 文档元信息推导（title / navTitle / category / order / description / slug）
 *
 * 这个文件是 CommonJS 的，因为它同时被两边使用：
 *   1. build/loaders/doc-body-loader.js —— 构建时（Node）解析每个 .md，把元信息写进主包
 *   2. src/utils/docRegistry.js        —— 运行时（浏览器）读取这些元信息
 * 放在这里是为了"只保留一份解析规则"，两边不会有偏差。
 *
 * 注意：正文不进主包，由 loader 生成的 load() 在异步 chunk 里按需加载。
 */

// 常见的分类前缀 -> 展示名，未命中的分类会把首字母大写
var CATEGORY_NAMES = {
  algo: '算法',
  algorithm: '算法',
  css: 'CSS',
  design: '设计模式',
  designpattern: '设计模式',
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
  pattern: '设计模式',
  php: 'PHP',
  python: 'Python',
  react: 'React',
  redis: 'Redis',
  sql: 'SQL',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  vue: 'Vue'
}

var DEFAULT_CATEGORY = '未分类'
var DESCRIPTION_MAX = 80

// ---------- front matter ----------

function parseFrontMatter (raw) {
  var match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw)
  if (!match) {
    return { meta: {}, body: raw }
  }
  var meta = {}
  match[1].split(/\r?\n/).forEach(function (line) {
    var item = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim())
    if (!item) {
      return
    }
    var value = item[2].trim()
    if (/^(['"]).*\1$/.test(value)) {
      value = value.slice(1, -1)
    }
    if (value !== '') {
      meta[item[1].toLowerCase()] = value
    }
  })
  return { meta: meta, body: raw.slice(match[0].length) }
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
  var inFence = false
  var lines = body.split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }
    var heading = /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      return cleanInline(heading[1])
    }
  }
  return ''
}

function extractDescription (body) {
  var inFence = false
  var lines = body.split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
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
  var key = String(name).trim().toLowerCase()
  if (!key) {
    return ''
  }
  return CATEGORY_NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1)
}

function fallbackCategory (dir, baseName) {
  if (dir) {
    var lastSegment = dir.split('/').filter(Boolean).pop()
    var fromDir = prettyCategory(lastSegment.replace(/^\d+[-_.\s]+/, ''))
    if (fromDir) {
      return fromDir
    }
  }
  var prefix = /^([A-Za-z\u4e00-\u9fa5]+)[-_]/.exec(baseName)
  return prefix ? prettyCategory(prefix[1]) : DEFAULT_CATEGORY
}

function sanitizeSlug (value) {
  return String(value)
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function toOrder (value, fallback) {
  var order = parseInt(value, 10)
  return isNaN(order) ? fallback : order
}

/**
 * @param {string} filePath 相对 src/assets/docs 的路径，例如 'git/git-merge.md'
 * @param {string} raw      markdown 原文（含 front matter）
 * @returns {{slug:string,title:string,navTitle:string,category:string,description:string,order:number,date:string,file:string}}
 */
function buildMeta (filePath, raw) {
  var parsed = parseFrontMatter(raw)
  var meta = parsed.meta
  var body = parsed.body

  var relative = String(filePath).replace(/^\.\//, '')
  var segments = relative.split('/')
  var fileName = segments.pop().replace(/\.md$/i, '')
  var dir = segments.join('/')

  var orderPrefix = /^(\d+)[-_.\s]+(.+)$/.exec(fileName)
  var baseName = (orderPrefix ? orderPrefix[2] : fileName).trim()

  var title = meta.title || extractTitle(body) || baseName
  return {
    slug: sanitizeSlug(meta.slug || baseName) || sanitizeSlug(fileName),
    title: title,
    navTitle: meta.navtitle || meta['nav-title'] || title,
    category: prettyCategory(meta.category || meta.group || '') || fallbackCategory(dir, baseName),
    description: meta.description || extractDescription(body),
    order: toOrder(meta.order, orderPrefix ? parseInt(orderPrefix[1], 10) : 0),
    date: meta.date || '',
    file: relative
  }
}

function compareDocs (a, b) {
  if (a.order !== b.order) {
    return a.order - b.order
  }
  return a.slug.localeCompare(b.slug)
}

module.exports = {
  CATEGORY_NAMES: CATEGORY_NAMES,
  DEFAULT_CATEGORY: DEFAULT_CATEGORY,
  parseFrontMatter: parseFrontMatter,
  buildMeta: buildMeta,
  compareDocs: compareDocs,
  prettyCategory: prettyCategory,
  sanitizeSlug: sanitizeSlug
}
