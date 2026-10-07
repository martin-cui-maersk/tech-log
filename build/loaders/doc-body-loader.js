/**
 * .md 文档的 webpack loader：把一篇文档拆成「元信息（进主包）」+「正文（异步 chunk）」
 *
 * 生成的模块长这样：
 *   exports.meta = { slug, title, navTitle, category, description, order, file }
 *   exports.load = () => Promise<string>   // 正文，首次调用时拉取 docs-body chunk
 *
 * 这样主包只带少量元信息（首页卡片、侧边栏、搜索结果里的标题与描述都能立刻渲染），
 * 全部正文只在"打开某篇文档"或"首次搜索"时才下载。
 *
 * 正文用 `!!raw-loader!./文件名` 读取：`!!` 会禁用其它配置的 loader，避免递归调用本 loader。
 */
const path = require('path')
const { buildMeta } = require('../../src/utils/docMeta')

const DOCS_ROOT = path.resolve(__dirname, '../../src/assets/docs')

module.exports = function docBodyLoader (source) {
  this.cacheable && this.cacheable()

  const relative = path.relative(DOCS_ROOT, this.resourcePath).split(path.sep).join('/')
  const meta = buildMeta(relative, source)
  // 正文请求：相对当前 md 文件自身，子目录也能正确解析
  const bodyRequest = '!!raw-loader!./' + path.basename(this.resourcePath)

  return [
    'var meta = ' + JSON.stringify(meta) + ';',
    'exports.meta = meta;',
    'exports.load = function load () {',
    '  return new Promise(function (resolve, reject) {',
    '    require.ensure([], function (require) {',
    '      try {',
    '        resolve(require(' + JSON.stringify(bodyRequest) + '));',
    '      } catch (err) {',
    '        reject(err);',
    '      }',
    '    }, "docs-body");',
    '  });',
    '};',
    ''
  ].join('\n')
}
