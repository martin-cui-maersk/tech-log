<template>
  <div class="docs-view">
    <MarkdownViewer v-if="doc" :content="doc.content" />
    <div v-else class="doc-missing">
      <h1>文档未找到</h1>
      <p>没有找到名为 <code>{{ docName }}</code> 的文档，请检查链接是否正确。</p>
      <p><router-link to="/">返回首页查看全部文档</router-link></p>
    </div>
  </div>
</template>

<script>
import MarkdownViewer from './MarkdownViewer'
import { getDoc } from '@/utils/docRegistry'

export default {
  name: 'DocsView',
  components: {
    MarkdownViewer
  },
  computed: {
    docName () {
      return this.$route.params.doc
    },
    doc () {
      return getDoc(this.docName)
    }
  }
}
</script>

<style scoped>
.docs-view {
  width: 100%;
}

.doc-missing {
  max-width: 900px;
  margin: 0 auto;
}

.doc-missing h1 {
  font-size: 28px;
  margin-bottom: 16px;
}

.doc-missing p {
  margin: 8px 0;
  color: var(--content-text-light);
}

.doc-missing a {
  color: var(--link-color);
  text-decoration: none;
}

.doc-missing a:hover {
  text-decoration: underline;
}

.doc-missing code {
  background-color: var(--code-bg);
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
