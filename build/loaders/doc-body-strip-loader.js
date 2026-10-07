/**
 * 文档正文的 loader（按需加载路径用）
 *
 * 和 doc-body-loader.js 的区别：doc-body-loader 负责生成「元信息 + load()」，
 * 这个 loader 负责生成**真正的正文**（剥掉 front matter，只留 markdown 正文），
 * 由 doc-body-loader 生成的 load() 通过 `./xxx.md?strip` 请求它。
 *
 * 必须在这里剥 front matter：如果直接把整个文件交给 raw-loader，
 * `--- title: ... ---` 这些头部会被 markdown-it 渲染成正文内容。
 */
const { parseFrontMatter } = require('../../src/utils/docMeta')

module.exports = function docBodyStripLoader (source) {
  this.cacheable && this.cacheable()
  const parsed = parseFrontMatter(source)
  return 'module.exports = ' + JSON.stringify(parsed.body.trim()) + ';'
}
