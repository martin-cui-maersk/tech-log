<template>
  <div class="git-docs">
    <MarkdownViewer :content="markdownContent" />
  </div>
</template>

<script>
import MarkdownViewer from './MarkdownViewer'
import gitMerge from '@/assets/docs/git-merge.md'
import gitWorkflow from '@/assets/docs/git-workflow.md'
import hyperfSleep from '@/assets/docs/hyperf-sleep.md'

const docs = {
  'git-merge': gitMerge,
  'git-workflow': gitWorkflow,
  'hyperf-sleep': hyperfSleep
}

export default {
  name: 'GitDocs',
  components: {
    MarkdownViewer
  },
  computed: {
    markdownContent () {
      const docName = this.$route.params.doc
      return docs[docName] || '# 文档未找到'
    }
  }
}
</script>

<style scoped>
.git-docs {
  width: 100%;
}
</style>
