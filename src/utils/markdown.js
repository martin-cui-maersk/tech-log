/**
 * markdown-it 实例（按需加载）
 *
 * 首页只渲染文档卡片，不需要 markdown 渲染能力，所以 markdown-it（约 100 KB）
 * 不放进首屏 vendor，而是走异步 chunk：第一次打开文档或第一次搜索时才加载。
 * 实例加载后缓存复用。
 */
let instance = null
let loading = null

export function loadMarkdownIt () {
  if (instance) {
    return Promise.resolve(instance)
  }
  if (!loading) {
    loading = import(/* webpackChunkName: "markdown" */ 'markdown-it')
      .then(mod => {
        const MarkdownIt = mod && mod.default ? mod.default : mod
        instance = new MarkdownIt({
          html: true,
          linkify: true,
          typographer: true
        })
        loading = null
        return instance
      })
      .catch(err => {
        loading = null
        throw err
      })
  }
  return loading
}
