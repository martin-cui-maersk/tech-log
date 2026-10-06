/**
 * 标题锚点 id 的生成规则
 *
 * MarkdownViewer 用它给渲染出来的 h1~h6 加 id，docSearch 用同一套规则算出
 * 每个小节锚点，保证搜索结果能精确跳到小节。
 * 两边必须保持一致，所以抽到这里。
 */
export function headingId (text) {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}
