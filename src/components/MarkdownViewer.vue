<template>
  <div class="markdown-body" v-html="renderedContent"></div>
</template>

<script>
import MarkdownIt from 'markdown-it'

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
      return this.md.render(this.content)
    }
  }
}
</script>

<style scoped>
.markdown-body {
  text-align: left;
  padding: 20px 40px;
  max-width: 900px;
  margin: 0 auto;
  line-height: 1.6;
  color: #2c3e50;
}

.markdown-body >>> h1 {
  font-size: 2em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.3em;
}

.markdown-body >>> h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.3em;
  margin-top: 1.5em;
}

.markdown-body >>> h3 {
  font-size: 1.25em;
  margin-top: 1.2em;
}

.markdown-body >>> code {
  background-color: #f8f8f8;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 0.9em;
}

.markdown-body >>> pre {
  background-color: #f8f8f8;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body >>> pre code {
  background-color: transparent;
  padding: 0;
}

.markdown-body >>> blockquote {
  border-left: 4px solid #42b983;
  margin: 1em 0;
  padding: 0.5em 1em;
  background-color: #f9f9f9;
  color: #666;
}

.markdown-body >>> table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.markdown-body >>> th,
.markdown-body >>> td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body >>> th {
  background-color: #f5f5f5;
}

.markdown-body >>> a {
  color: #42b983;
  text-decoration: none;
}

.markdown-body >>> a:hover {
  text-decoration: underline;
}

.markdown-body >>> img {
  max-width: 100%;
}
</style>
