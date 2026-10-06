<template>
  <div class="doc-search" :class="{ 'is-open': open, 'is-expanded': isNarrow && expanded }">
    <button
      v-if="!showField"
      type="button"
      class="search-icon-button"
      aria-label="搜索文档"
      title="搜索文档（按 / 键）"
      @click="expandSearch"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5 L20.5 20.5" />
      </svg>
    </button>

    <div v-else class="search-field">
      <svg class="search-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5 L20.5 20.5" />
      </svg>
      <input
        ref="input"
        v-model="query"
        type="text"
        class="search-input"
        placeholder="搜索文档内容"
        aria-label="搜索文档内容"
        autocomplete="off"
        spellcheck="false"
        @focus="open = true"
        @keydown.esc.prevent="closeAndBlur"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="goActive"
      >
      <button
        v-if="isNarrow"
        type="button"
        class="search-cancel"
        aria-label="关闭搜索"
        @click="closeAndBlur"
      >取消</button>
      <kbd v-else-if="!query" class="search-kbd">/</kbd>
    </div>

    <div v-if="open && query" class="search-panel">
      <p v-if="!results.length" class="search-empty">
        没有找到「{{ query }}」相关的内容
      </p>
      <ul v-else class="search-list">
        <li v-for="(result, index) in results" :key="result.link">
          <router-link
            :to="result.link"
            class="search-result"
            :class="{ 'is-active': index === activeIndex }"
            @click.native="close"
            @mouseenter="activeIndex = index"
          >
            <span class="result-head">
              <span class="result-doc">{{ result.docTitle }}</span>
              <span v-if="result.heading" class="result-section">{{ result.heading }}</span>
            </span>
            <span v-if="result.segments.length" class="result-snippet">
              <template v-for="(segment, segmentIndex) in result.segments">
                <mark v-if="segment.hit" :key="'h' + segmentIndex">{{ segment.text }}</mark>
                <template v-else>{{ segment.text }}</template>
              </template>
            </span>
          </router-link>
        </li>
      </ul>
      <div v-if="results.length" class="search-footer">↑ ↓ 选择 · Enter 打开 · Esc 关闭</div>
    </div>
  </div>
</template>

<script>
import { search } from '@/utils/docSearch'

export default {
  name: 'DocSearch',
  data () {
    return {
      query: '',
      open: false,
      expanded: false,
      isNarrow: false,
      activeIndex: 0
    }
  },
  computed: {
    results () {
      return search(this.query, 12)
    },
    // 桌面端一直显示搜索框；窄屏先显示一个图标，点开再展开
    showField () {
      return this.expanded || !this.isNarrow
    }
  },
  watch: {
    query () {
      this.activeIndex = 0
      this.open = Boolean(this.query)
    }
  },
  mounted () {
    this.updateNarrow()
    document.addEventListener('click', this.handleDocumentClick)
    document.addEventListener('keydown', this.handleShortcut)
    window.addEventListener('resize', this.updateNarrow, { passive: true })
  },
  beforeDestroy () {
    document.removeEventListener('click', this.handleDocumentClick)
    document.removeEventListener('keydown', this.handleShortcut)
    window.removeEventListener('resize', this.updateNarrow, { passive: true })
  },
  methods: {
    updateNarrow () {
      this.isNarrow = window.innerWidth <= 720
    },
    expandSearch () {
      this.expanded = true
      this.open = true
      this.$nextTick(() => {
        if (this.$refs.input) {
          this.$refs.input.focus()
        }
      })
    },
    close () {
      this.open = false
      this.activeIndex = 0
      if (this.isNarrow) {
        // 窄屏下是整屏浮层：点了结果 / 按了 Esc / 点到外面，连浮层一起收起来
        this.expanded = false
        this.query = ''
      }
    },
    closeAndBlur () {
      if (this.$refs.input) {
        this.$refs.input.blur()
      }
      this.close()
    },
    move (step) {
      if (!this.results.length) {
        return
      }
      const next = this.activeIndex + step
      if (next < 0) {
        this.activeIndex = this.results.length - 1
      } else if (next >= this.results.length) {
        this.activeIndex = 0
      } else {
        this.activeIndex = next
      }
    },
    goActive () {
      const result = this.results[this.activeIndex]
      if (result) {
        this.$router.push(result.link)
        this.close()
      }
    },
    handleDocumentClick (event) {
      if (!this.$el.contains(event.target)) {
        this.close()
      }
    },
    handleShortcut (event) {
      const target = event.target || {}
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
      // 按 / 或 Ctrl/Cmd + K 聚焦搜索框
      const isSlash = event.key === '/' && !typing
      const isCommandK = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')
      if (isSlash || isCommandK) {
        event.preventDefault()
        this.expandSearch()
      }
    }
  }
}
</script>

<style scoped>
.doc-search {
  position: relative;
  flex: none;
}

.search-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: var(--content-text-light);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s, border-color 0.2s;
}

.search-icon-button:hover {
  color: var(--link-color);
  background-color: var(--hover-bg);
  border-color: var(--border-color);
}

.search-icon-button:focus-visible {
  outline: 2px solid var(--theme-color);
  outline-offset: 2px;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  width: 210px;
  padding: 0 9px;
  color: var(--content-text-light);
  background-color: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}

.search-field:focus-within {
  border-color: var(--theme-color);
  box-shadow: 0 0 0 3px var(--theme-color-softer);
}

.search-field-icon {
  flex: none;
}

.search-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  font-family: inherit;
  font-size: 13.5px;
  color: var(--content-text);
  background: none;
  border: none;
  outline: none;
}

.search-input::placeholder {
  color: var(--content-text-light);
}

.search-kbd {
  flex: none;
  font-family: inherit;
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  color: var(--content-text-light);
  background-color: var(--content-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.search-cancel {
  flex: none;
  font-family: inherit;
  font-size: 13px;
  color: var(--link-color);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 2px;
}

/* 结果面板 */
.search-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 480px;
  max-width: calc(100vw - 32px);
  max-height: min(64vh, 520px);
  overflow-y: auto;
  background-color: var(--content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 120;
}

.search-empty {
  padding: 18px 16px;
  font-size: 14px;
  color: var(--content-text-light);
}

.search-list {
  list-style: none;
  padding: 6px;
  margin: 0;
}

.search-result {
  display: block;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: background-color 0.15s;
}

.search-result.is-active {
  background-color: var(--theme-color-softer);
}

.result-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.result-doc {
  font-size: 14px;
  font-weight: 600;
  color: var(--heading-text);
}

.search-result.is-active .result-doc {
  color: var(--link-color);
}

.result-section {
  font-size: 12px;
  color: var(--content-text-light);
}

.result-snippet {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--content-text-light);
  word-break: break-word;
}

.result-snippet mark {
  padding: 0 1px;
  color: var(--link-color);
  background-color: var(--theme-color-soft);
  border-radius: 2px;
}

.search-footer {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--content-text-light);
  border-top: 1px solid var(--border-color);
}

/* 窄屏：搜索框收成一个图标，点开后变成顶部浮层 */
@media (max-width: 720px) {
  .doc-search.is-expanded {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 130;
    padding: 13px 16px;
    background-color: var(--nav-bg);
    backdrop-filter: saturate(180%) blur(12px);
    -webkit-backdrop-filter: saturate(180%) blur(12px);
    border-bottom: 1px solid var(--border-color);
  }

  .doc-search.is-expanded .search-field {
    width: 100%;
    background-color: var(--content-bg);
  }

  .doc-search.is-expanded .search-panel {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    width: auto;
    max-width: none;
    max-height: calc(100vh - 60px);
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .doc-search.is-expanded .search-list {
    padding: 10px 12px;
  }
}
</style>
