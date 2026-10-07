/**
 * 文档全文检索（纯前端，零依赖）
 *
 * 索引来自 src/utils/docRegistry 自动扫描出来的文档。正文是按需加载的，
 * 所以索引也是**按需构建**：第一次搜索（或页面空闲时的预取）会把
 * docs-body chunk 拉下来，切小节建一次索引，之后缓存复用。
 *
 * 做法：
 *   1. 每篇文档用 markdown-it 渲染一遍，按 h1~h4 切成「小节」
 *   2. 小节标题 + 正文去掉标签、解码实体，转成小写做匹配文本
 *   3. 查询词按空格拆成多个词，要求全部命中（AND），按权重打分排序：
 *      文档标题 > 小节标题 > 正文，正文里出现次数越多、位置越靠前分越高
 *   4. 返回带高亮片段的 segments（不返回 HTML，避免 XSS）
 */
import { loadAllDocs } from './docRegistry'
import { loadMarkdownIt } from './markdown'
import { headingId } from './anchor'

const SNIPPET_LENGTH = 120
const SNIPPET_BEFORE = 36
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" }

function decodeEntities (text) {
  return text.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (match, name) => ENTITIES[name])
}

function stripTags (html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ''))
}

function normalize (text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

function countOccurrences (text, term) {
  let count = 0
  let from = 0
  while (count < 20) {
    const pos = text.indexOf(term, from)
    if (pos === -1) {
      break
    }
    count += 1
    from = pos + term.length
  }
  return count
}

function makeItem (doc, heading, anchor, text) {
  return {
    slug: doc.slug,
    docTitle: doc.title,
    // 侧边栏的简短名字也参与匹配，比如搜「SQL 优化」
    titleText: (doc.title + ' ' + doc.navTitle).toLowerCase(),
    heading: heading,
    headingText: heading.toLowerCase(),
    anchor: anchor,
    text: text,
    textLower: text.toLowerCase()
  }
}

function buildIndex (loaded, md) {
  const items = []
  loaded.forEach(({ meta, content }) => {
    const html = md.render(content)
    const headingRe = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g
    const marks = []
    let match
    while ((match = headingRe.exec(html))) {
      const heading = normalize(stripTags(match[2]))
      marks.push({ heading: heading, start: match.index, end: headingRe.lastIndex })
    }

    if (!marks.length) {
      items.push(makeItem(meta, '', '', normalize(stripTags(html))))
      return
    }

    // 第一个标题之前的内容（大多数文档没有）
    const intro = normalize(stripTags(html.slice(0, marks[0].start)))
    if (intro) {
      items.push(makeItem(meta, '', '', intro))
    }

    marks.forEach((mark, index) => {
      const end = index + 1 < marks.length ? marks[index + 1].start : html.length
      const body = normalize(stripTags(html.slice(mark.end, end)))
      items.push(makeItem(meta, mark.heading, headingId(mark.heading), body))
    })
  })
  return items
}

let cachedIndex = null
let building = null

export function isIndexReady () {
  return cachedIndex !== null
}

/**
 * 确保索引可用（首次会加载 docs-body chunk 并建索引），返回 Promise
 * 多次调用会复用同一次加载
 */
export function ensureIndex () {
  if (cachedIndex) {
    return Promise.resolve(cachedIndex)
  }
  if (!building) {
    building = Promise.all([loadAllDocs(), loadMarkdownIt()])
      .then(results => {
        cachedIndex = buildIndex(results[0], results[1])
        building = null
        return cachedIndex
      })
      .catch(err => {
        building = null
        throw err
      })
  }
  return building
}

// 把文本切成 [{ text, hit }]，命中的词由组件渲染成 <mark>
function makeSegments (text, terms) {
  const lower = text.toLowerCase()
  const ranges = []
  terms.forEach(term => {
    let from = 0
    while (true) {
      const pos = lower.indexOf(term, from)
      if (pos === -1) {
        break
      }
      ranges.push([pos, pos + term.length])
      from = pos + term.length
    }
  })
  ranges.sort((a, b) => a[0] - b[0])

  const merged = []
  ranges.forEach(range => {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1])
    } else {
      merged.push(range)
    }
  })

  const segments = []
  let cursor = 0
  merged.forEach(range => {
    if (range[0] > cursor) {
      segments.push({ text: text.slice(cursor, range[0]), hit: false })
    }
    segments.push({ text: text.slice(range[0], range[1]), hit: true })
    cursor = range[1]
  })
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false })
  }
  return segments
}

function buildSnippet (text, terms, position) {
  if (!text) {
    return []
  }
  const start = position > SNIPPET_BEFORE ? position - SNIPPET_BEFORE : 0
  let snippet = text.slice(start, start + SNIPPET_LENGTH)
  if (start > 0) {
    snippet = '…' + snippet
  }
  if (start + SNIPPET_LENGTH < text.length) {
    snippet = snippet + '…'
  }
  return makeSegments(snippet, terms)
}

export function search (query, limit) {
  const max = limit || 20
  const terms = normalize(query).toLowerCase().split(' ').filter(Boolean)
  // 索引还没准备好（正文 chunk 正在加载）时先返回空，组件会提示"正在准备索引"
  if (!terms.length || !cachedIndex) {
    return []
  }

  const results = []
  cachedIndex.forEach(item => {
    let score = 0
    let bodyPosition = -1
    let matchedAll = true

    for (let i = 0; i < terms.length; i++) {
      const term = terms[i]
      const inTitle = item.titleText.indexOf(term)
      const inHeading = item.headingText.indexOf(term)
      const inBody = item.textLower.indexOf(term)
      if (inTitle === -1 && inHeading === -1 && inBody === -1) {
        matchedAll = false
        break
      }
      if (inTitle !== -1) {
        score += 14
      }
      if (inHeading !== -1) {
        score += 8
      }
      if (inBody !== -1) {
        score += 3 + Math.min(countOccurrences(item.textLower, term), 5)
        if (bodyPosition === -1 || inBody < bodyPosition) {
          bodyPosition = inBody
        }
      }
    }
    if (!matchedAll) {
      return
    }

    results.push({
      slug: item.slug,
      docTitle: item.docTitle,
      heading: item.heading,
      anchor: item.anchor,
      link: '/docs/' + item.slug + (item.anchor ? '#' + item.anchor : ''),
      score: score,
      segments: buildSnippet(item.text, terms, bodyPosition)
    })
  })

  // 同分保持文档本身的顺序（sort 稳定）
  return results.sort((a, b) => b.score - a.score).slice(0, max)
}

// 供调试/统计用
export function indexSize () {
  return cachedIndex ? cachedIndex.length : 0
}
