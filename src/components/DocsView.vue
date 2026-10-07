<template>
  <div class="docs-view">
    <div v-if="loading" class="doc-loading" aria-live="polite">
      <span class="doc-loading-dot"></span>
      <span class="doc-loading-dot"></span>
      <span class="doc-loading-dot"></span>
      <span class="doc-loading-text">正在加载文档…</span>
    </div>
    <MarkdownViewer v-else-if="content !== null" :content="content" @rendered="scrollToHash" />
    <div v-else class="doc-missing">
      <h1>文档未找到</h1>
      <p>没有找到名为 <code>{{ docName }}</code> 的文档，请检查链接是否正确。</p>
      <p><router-link to="/">返回首页查看全部文档</router-link></p>
    </div>
  </div>
</template>

<script>
import MarkdownViewer from './MarkdownViewer'
import { getDoc, loadDoc } from '@/utils/docRegistry'
import { loadMarkdownIt } from '@/utils/markdown'

export default {
  name: 'DocsView',
  components: {
    MarkdownViewer
  },
  data () {
    return {
      // 正文是按需加载的：null 表示"还没拿到或不存在"
      content: null,
      loading: false
    }
  },
  computed: {
    docName () {
      return this.$route.params.doc
    },
    doc () {
      return getDoc(this.docName)
    }
  },
  watch: {
    docName: {
      immediate: true,
      handler: 'loadContent'
    }
  },
  methods: {
    /**
     * 深链接带 #锚点时的定位
     *
     * 正文是按需加载的，路由的 scrollBehavior 执行时元素还没渲染出来，
     * 所以要在"内容真的进 DOM 之后"自己滚一次。偏移 84px 与 router 的 scrollBehavior 保持一致。
     */
    scrollToHash () {
      const hash = this.$route.hash
      if (!hash) {
        return
      }
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (!el) {
        return
      }
      const top = el.getBoundingClientRect().top + window.pageYOffset - 84
      window.scrollTo(0, top > 0 ? top : 0)
    },
    loadContent () {
      const name = this.docName
      if (!getDoc(name)) {
        // 文档不存在，直接展示"未找到"
        this.content = null
        this.loading = false
        return
      }
      this.loading = true
      this.content = null
      // 正文 chunk 和 markdown-it chunk 一起等，避免先出空白再闪出内容
      Promise.all([loadDoc(name), loadMarkdownIt()])
        .then(results => {
          // 期间用户可能已经切到别的文档，丢弃过期结果
          if (this.docName !== name) {
            return
          }
          const content = results[0]
          this.content = content === null || content === undefined ? '' : content
          this.loading = false
        })
        .catch(() => {
          if (this.docName === name) {
            this.content = ''
            this.loading = false
          }
        })
    }
  }
}
</script>

<style scoped>
.docs-view {
  width: 100%;
}

/* 正文按需加载时的占位提示 */
.doc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  max-width: 900px;
  margin: 25vh auto 0;
  padding: 20px;
  font-size: 14px;
  color: var(--content-text-light);
}

.doc-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--theme-color);
  animation: docLoading 1s infinite ease-in-out;
}

.doc-loading-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.doc-loading-dot:nth-child(3) {
  animation-delay: 0.3s;
}

.doc-loading-text {
  margin-left: 6px;
}

@keyframes docLoading {
  0%, 80%, 100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
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
