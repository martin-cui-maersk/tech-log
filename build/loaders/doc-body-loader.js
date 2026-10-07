/**
 * .md 文档的 webpack loader：把一篇文档拆成「元信息（进主包）」+「正文（异步 chunk）」
 *
 * 生成的模块长这样：
 *   exports.meta = { slug, title, navTitle, category, description, order, updated, file }
 *   exports.load = () => Promise<string>   // 正文，首次调用时拉取对应分类的 chunk
 *
 * 这样主包只带少量元信息（首页卡片、侧边栏、搜索结果里的标题与描述都能立刻渲染），
 * 正文按**分类**拆成多个异步 chunk（docs-git / docs-mysql ...），打开某篇文档只下载
 * 它所在分类的正文；搜索需要全部文档时才会把这些 chunk 一起拉下来。
 *
 * 正文用 `!!raw-loader!./文件名` 读取：`!!` 会禁用其它配置的 loader，避免递归调用本 loader。
 */
const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')
const { buildMeta, chunkKeyOf } = require('../../src/utils/docMeta')

const DOCS_ROOT = path.resolve(__dirname, '../../src/assets/docs')
const REPO_ROOT = path.resolve(__dirname, '../..')

/**
 * 文档的"最近更新"日期：优先取该文件最后一次 git 提交的日期（跟代码一起提交，
 * 换机器、重新 clone 都稳定）；文件还没提交过就退回文件修改时间。
 */
function lastUpdated (resourcePath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cs', '--', resourcePath],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
    const date = String(out).trim()
    if (date) {
      return date
    }
  } catch (e) {
    // 不是 git 仓库 / 没有 git 命令，忽略
  }
  try {
    return fs.statSync(resourcePath).mtime.toISOString().slice(0, 10)
  } catch (e) {
    return ''
  }
}

module.exports = function docBodyLoader (source) {
  this.cacheable && this.cacheable()

  const relative = path.relative(DOCS_ROOT, this.resourcePath).split(path.sep).join('/')
  const meta = buildMeta(relative, source)
  meta.updated = lastUpdated(this.resourcePath)

  const chunkName = 'docs-' + chunkKeyOf(relative)
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
    '    }, ' + JSON.stringify(chunkName) + ');',
    '  });',
    '};',
    ''
  ].join('\n')
}
