<template>
  <div class="markdown-body" v-html="renderedContent"></div>
</template>

<script>
import MarkdownIt from 'markdown-it'

function addAnchorIds (html) {
  return html.replace(/<h([1-6])>(.*?)<\/h\1>/g, (match, level, text) => {
    const id = text
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
    return `<h${level} id="${id}">${text}</h${level}>`
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
      md: new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true
      })
    }
  },
  computed: {
    renderedContent () {
      const raw = this.md.render(this.content)
      return addAnchorIds(raw)
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

.markdown-body >>> h1 {
  font-size: 30px;
  font-weight: 600;
  margin: 2em 0 1em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.markdown-body >>> h2 {
  font-size: 24px;
  font-weight: 600;
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
  line-height: 1.7;
}

.markdown-body >>> code {
  background-color: var(--code-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.85em;
  color: #e36209;
}

.markdown-body >>> pre {
  background-color: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1em 0;
  border: 1px solid var(--border-color);
}

.markdown-body >>> pre code {
  background-color: transparent;
  padding: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--content-text);
}

.markdown-body >>> blockquote {
  border-left: 4px solid var(--theme-color);
  margin: 1em 0;
  padding: 0.5em 1em;
  background-color: #f6f8fa;
  color: var(--content-text-light);
  border-radius: 0 4px 4px 0;
}

.markdown-body >>> blockquote p {
  margin: 0.3em 0;
}

.markdown-body >>> table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  font-size: 14px;
  display: block;
  overflow-x: auto;
}

.markdown-body >>> th,
.markdown-body >>> td {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.markdown-body >>> th {
  background-color: #f6f8fa;
  font-weight: 600;
}

.markdown-body >>> tr:nth-child(even) {
  background-color: #fafbfc;
}

.markdown-body >>> a {
  color: var(--link-color);
  text-decoration: none;
}

.markdown-body >>> a:hover {
  text-decoration: underline;
}

.markdown-body >>> img {
  max-width: 100%;
  border-radius: 4px;
}

.markdown-body >>> ul,
.markdown-body >>> ol {
  padding-left: 2em;
  margin: 1em 0;
}

.markdown-body >>> li {
  margin: 0.3em 0;
  line-height: 1.7;
}

.markdown-body >>> hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 2em 0;
}
</style>
