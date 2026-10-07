<template>
  <div class="markdown-body" v-html="renderedContent"></div>
</template>

<script>
import { loadMarkdownIt } from '@/utils/markdown'
import { headingId } from '@/utils/anchor'
import { stripFrontMatter } from '@/utils/docMeta'

function addAnchorIds (html) {
  return html.replace(/<h([1-6])>(.*?)<\/h\1>/g, (match, level, text) => {
    return `<h${level} id="${headingId(text)}">${text}</h${level}>`
  })
}

export default {
  name: 'MarkdownViewer',
  props: {
    content: {
      type: String,
      required: true
    }
  },
  data () {
    return {
      // markdown-it 是按需加载的，渲染结果放在这里（不阻塞组件挂载）
      renderedContent: ''
    }
  },
  watch: {
    content: {
      immediate: true,
      handler: 'render'
    }
  },
  methods: {
    render () {
      const content = this.content
      if (!content) {
        this.renderedContent = ''
        return
      }
      loadMarkdownIt().then(md => {
        // 渲染期间内容可能已经切换成别的文档
        if (this.content === content) {
          // 兜底再剥一次 front matter：正常构建路径已经在 loader 里剥过了
          this.renderedContent = addAnchorIds(md.render(stripFrontMatter(content)))
          // 通知父组件"内容真的进 DOM 了"，便于深链接的 #锚点定位
          this.$nextTick(() => this.$emit('rendered'))
        }
      }).catch(() => {
        this.renderedContent = ''
      })
    }
  }
}
</script>

<style scoped>
.markdown-body {
  line-height: 1.7;
  font-size: 16px;
  color: var(--content-text);
  max-width: 900px;
  /* 在可用宽度里居中，侧边栏收起时不会整块贴在左边 */
  margin: 0 auto;
}

.markdown-body >>> h1,
.markdown-body >>> h2,
.markdown-body >>> h3,
.markdown-body >>> h4,
.markdown-body >>> h5,
.markdown-body >>> h6 {
  color: var(--heading-text);
  letter-spacing: -0.2px;
  /* 导航栏是固定的，点目录锚点跳转时别把标题压在导航栏下面 */
  scroll-margin-top: 84px;
}

.markdown-body >>> h1 {
  font-size: 30px;
  font-weight: 650;
  margin: 2em 0 1em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.markdown-body >>> h2 {
  font-size: 24px;
  font-weight: 650;
  margin: 1.8em 0 0.8em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.markdown-body >>> h3 {
  font-size: 19px;
  font-weight: 600;
  margin: 1.5em 0 0.6em;
}

.markdown-body >>> h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 1.2em 0 0.5em;
}

.markdown-body >>> p {
  margin: 1em 0;
  line-height: 1.75;
}

.markdown-body >>> code {
  background-color: var(--code-bg);
  padding: 2px 6px;
  border-radius: 5px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.86em;
  color: var(--code-inline-color);
}

.markdown-body >>> pre {
  background-color: var(--surface-2);
  padding: 16px 18px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 1.2em 0;
  border: 1px solid var(--border-color);
  tab-size: 2;
}

.markdown-body >>> pre::-webkit-scrollbar {
  height: 8px;
}

.markdown-body >>> pre::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 4px;
}

.markdown-body >>> pre code {
  background-color: transparent;
  padding: 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--content-text);
}

.markdown-body >>> blockquote {
  border-left: 3px solid var(--theme-color);
  margin: 1.2em 0;
  padding: 0.6em 1.1em;
  background-color: var(--surface-2);
  color: var(--content-text-light);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.markdown-body >>> blockquote p {
  margin: 0.3em 0;
}

.markdown-body >>> table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.2em 0;
  font-size: 14px;
  display: block;
  overflow-x: auto;
}

.markdown-body >>> th,
.markdown-body >>> td {
  border: 1px solid var(--border-color);
  padding: 9px 13px;
  text-align: left;
}

.markdown-body >>> th {
  background-color: var(--surface-2);
  color: var(--heading-text);
  font-weight: 600;
}

.markdown-body >>> tr:nth-child(even) {
  background-color: var(--surface-3);
}

.markdown-body >>> a {
  color: var(--link-color);
  text-decoration: none;
  text-underline-offset: 3px;
}

.markdown-body >>> a:hover {
  text-decoration: underline;
}

.markdown-body >>> img {
  max-width: 100%;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.markdown-body >>> ul,
.markdown-body >>> ol {
  padding-left: 2em;
  margin: 1em 0;
}

.markdown-body >>> li {
  margin: 0.35em 0;
  line-height: 1.75;
}

.markdown-body >>> hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 2.2em 0;
}
</style>
