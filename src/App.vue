<template>
  <div id="app">
    <header class="nav-bar">
      <div class="nav-container">
        <div class="nav-left">
          <button
            v-if="showSidebar"
            type="button"
            class="sidebar-toggle"
            id="sidebar-toggle"
            aria-controls="app-sidebar"
            :aria-expanded="sidebarOpen ? 'true' : 'false'"
            :title="sidebarOpen ? '收起侧边栏' : '展开侧边栏'"
            @click="toggleSidebar"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <rect x="1.7" y="2.7" width="12.6" height="10.6" rx="2" />
              <line x1="6.6" y1="2.7" x2="6.6" y2="13.3" />
              <rect v-if="sidebarOpen" x="2.8" y="3.8" width="2.8" height="8.4" fill="currentColor" stroke="none" opacity="0.35" />
            </svg>
            <span class="sr-only">{{ sidebarOpen ? '收起侧边栏' : '展开侧边栏' }}</span>
          </button>
          <router-link to="/" class="nav-title">技术随笔</router-link>
        </div>
        <div class="nav-actions">
          <router-link to="/" class="nav-home" exact title="返回首页">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3.5 10.5 L12 3.5 L20.5 10.5" />
              <path d="M5.5 9.5 V20 H18.5 V9.5" />
            </svg>
            <span class="nav-home-text">首页</span>
          </router-link>
          <DocSearch />
          <button
            type="button"
            class="theme-toggle"
            :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
            :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
            @click="toggleTheme"
          >
            <transition name="theme-icon" mode="out-in">
              <svg v-if="theme === 'dark'" key="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
              </svg>
              <svg v-else key="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20.5 14.2A8.6 8.6 0 1 1 9.8 3.5a6.9 6.9 0 0 0 10.7 10.7z" />
              </svg>
            </transition>
          </button>
          <a href="https://github.com/martin-cui-maersk/tech-log" target="_blank" rel="noopener" class="edit-on-github">
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" class="github-icon"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            <span class="edit-on-github-text">Edit on GitHub</span>
          </a>
        </div>
      </div>
    </header>
    <div class="layout" :class="{ 'is-collapsed': !sidebarOpen || !showSidebar }">
      <aside v-if="showSidebar" id="app-sidebar" class="sidebar">
        <div class="sidebar-inner">
          <div class="sidebar-group" style="display: none">
            <div class="sidebar-group-title">首页</div>
            <!-- exact：否则 "/" 是任何路径的前缀，"前言"会在所有文档页一直高亮 -->
            <router-link to="/" class="sidebar-link" exact>前言</router-link>
          </div>
          <!-- 分类与文档由 src/assets/docs 自动扫描生成，新增文件后无需改这里 -->
          <div v-for="(group, index) in categories" :key="group.name" class="sidebar-group">
            <button
              type="button"
              class="sidebar-group-title"
              :class="{
                'is-collapsed': isGroupCollapsed(group.name),
                'is-active': isGroupActive(group)
              }"
              :aria-expanded="isGroupCollapsed(group.name) ? 'false' : 'true'"
              :aria-controls="'sidebar-group-body-' + index"
              :title="isGroupCollapsed(group.name) ? '展开' + group.name : '收起' + group.name"
              @click="toggleGroup(group.name)"
            >
              <svg class="group-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M1 3.2 L5 7.2 L9 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">{{ group.docs.length }}</span>
            </button>
            <div
              :id="'sidebar-group-body-' + index"
              class="sidebar-group-body"
              :class="{ 'is-collapsed': isGroupCollapsed(group.name) }"
            >
              <router-link
                v-for="doc in group.docs"
                :key="doc.slug"
                :to="'/docs/' + doc.slug"
                class="sidebar-link"
                exact
              >{{ doc.navTitle }}</router-link>
            </div>
          </div>
        </div>
      </aside>
      <main class="content">
        <router-view/>
      </main>
    </div>
    <!-- 回到顶部：往下滚一段才出现 -->
    <button
      type="button"
      class="back-to-top"
      :class="{ 'is-visible': showBackToTop }"
      aria-label="回到顶部"
      title="回到顶部"
      @click="scrollToTop"
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 13 V3.4" />
        <path d="M3.6 7.8 L8 3.4 L12.4 7.8" />
      </svg>
    </button>
  </div>
</template>

<script>
import { categories } from '@/utils/docRegistry'
import DocSearch from '@/components/DocSearch'
import { resolveTheme, applyTheme, storeTheme, systemTheme, readStoredTheme, watchSystemTheme } from '@/utils/theme'

const STORAGE_KEY = 'tech-log:sidebar-open'
const GROUPS_STORAGE_KEY = 'tech-log:collapsed-groups'
// 滚动超过这个像素数才显示"回到顶部"
const BACK_TO_TOP_OFFSET = 300

function readSidebarPreference () {
  // 窄屏下侧边栏是盖在正文上的浮层，无论之前怎么选过都默认收起（用户仍可手动点开）
  if (window.innerWidth <= 1080) {
    return false
  }
  let saved = null
  try {
    saved = window.localStorage.getItem(STORAGE_KEY)
  } catch (e) {
    saved = null
  }
  if (saved === '1') {
    return true
  }
  if (saved === '0') {
    return false
  }
  return true
}

function readCollapsedGroups () {
  try {
    const saved = JSON.parse(window.localStorage.getItem(GROUPS_STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter(name => typeof name === 'string') : []
  } catch (e) {
    return []
  }
}

export default {
  name: 'App',
  components: {
    DocSearch
  },
  data () {
    return {
      categories: categories,
      sidebarOpen: true,
      // 被折叠起来的分类名，例如 ['MySQL', 'Hyperf']
      collapsedGroups: [],
      // 往下滚超过一定距离后才显示"回到顶部"
      showBackToTop: false,
      // 'light' | 'dark'
      theme: 'light'
    }
  },
  created () {
    this.sidebarOpen = readSidebarPreference()
    this.collapsedGroups = readCollapsedGroups()
    this.theme = resolveTheme()
    applyTheme(this.theme)
  },
  mounted () {
    window.addEventListener('scroll', this.handleScroll, { passive: true })
    this.handleScroll() // 刷新后浏览器可能已经恢复滚动位置
    // 用户没手动选过主题时，跟随系统切换
    this.stopThemeWatch = watchSystemTheme(() => {
      if (!readStoredTheme()) {
        this.theme = systemTheme()
        applyTheme(this.theme)
      }
    })
  },
  beforeDestroy () {
    window.removeEventListener('scroll', this.handleScroll, { passive: true })
    if (this.stopThemeWatch) {
      this.stopThemeWatch()
    }
  },
  computed: {
    // 首页不显示侧边栏（和参考的文档站一致：首页全宽，只有文档页有侧边栏）
    showSidebar () {
      return this.$route.name !== 'Home'
    }
  },
  watch: {
    // 窄屏时侧边栏是浮层，点了文档就自动收起，避免挡住正文
    $route () {
      if (this.sidebarOpen && window.innerWidth <= 1080) {
        this.setSidebar(false)
      }
    }
  },
  methods: {
    handleScroll () {
      const top = window.pageYOffset || document.documentElement.scrollTop || 0
      const visible = top > BACK_TO_TOP_OFFSET
      if (visible !== this.showBackToTop) {
        this.showBackToTop = visible
      }
    },
    scrollToTop () {
      const reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // 老浏览器不支持 smooth 时退化成直接跳转
      if (!reduceMotion && 'scrollBehavior' in document.documentElement.style) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        window.scrollTo(0, 0)
      }
    },
    toggleSidebar () {
      this.setSidebar(!this.sidebarOpen)
    },
    toggleTheme () {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      applyTheme(this.theme)
      storeTheme(this.theme)
    },
    setSidebar (open) {
      this.sidebarOpen = open
      try {
        window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0')
      } catch (e) {
        // 隐私模式下 localStorage 不可用，忽略即可
      }
    },
    isGroupCollapsed (name) {
      return this.collapsedGroups.indexOf(name) !== -1
    },
    // 当前正在看的文档属于这个分类时，标题高亮，折叠起来也能知道自己在哪
    isGroupActive (group) {
      const current = this.$route.params.doc
      return Boolean(current) && group.docs.some(doc => doc.slug === current)
    },
    toggleGroup (name) {
      const next = this.collapsedGroups.slice()
      const index = next.indexOf(name)
      if (index === -1) {
        next.push(name)
      } else {
        next.splice(index, 1)
      }
      this.collapsedGroups = next
      try {
        window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next))
      } catch (e) {
        // 同上
      }
    }
  }
}
</script>

<style>
/* ===== 设计变量：浅色（默认） ===== */
:root {
  --theme-color: #3eaf7c;
  --theme-color-light: #42b983;
  --theme-color-soft: rgba(62, 175, 124, 0.12);
  --theme-color-softer: rgba(62, 175, 124, 0.06);
  --sidebar-bg: #fafbfc;
  --sidebar-text: #374151;
  --sidebar-text-active: #23885a;
  --sidebar-border: #e8eaed;
  --content-bg: #ffffff;
  --content-text: #24292f;
  --content-text-light: #656d76;
  --heading-text: #1f2328;
  --link-color: #23885a;
  --code-bg: #f2f4f7;
  --code-inline-color: #cf4a0a;
  --surface-2: #f6f8fa;
  --surface-3: #fafbfc;
  --hover-bg: #f2f4f7;
  --nav-bg: rgba(255, 255, 255, 0.82);
  --border-color: #e6e8eb;
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-md: 0 6px 18px rgba(16, 24, 40, 0.1);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  color-scheme: light;
}

/* ===== 设计变量：深色 ===== */
html[data-theme='dark'] {
  --theme-color: #4ac48d;
  --theme-color-light: #56cf98;
  --theme-color-soft: rgba(74, 196, 141, 0.16);
  --theme-color-softer: rgba(74, 196, 141, 0.09);
  --sidebar-bg: #161b22;
  --sidebar-text: #c2cbd6;
  --sidebar-text-active: #56cf98;
  --sidebar-border: #232a33;
  --content-bg: #1c2128;
  --content-text: #d6dde6;
  --content-text-light: #8d97a3;
  --heading-text: #e6ebf1;
  --link-color: #56cf98;
  --code-bg: #262d36;
  --code-inline-color: #ffa657;
  --surface-2: #222831;
  --surface-3: #1f252d;
  --hover-bg: #262d36;
  --nav-bg: rgba(22, 27, 34, 0.82);
  --border-color: #2b323c;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 6px 18px rgba(0, 0, 0, 0.45);
  color-scheme: dark;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 切换主题时颜色平滑过渡（已有自己 transition 的元素优先级更高，不受影响） */
*,
*::before,
*::after {
  transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease;
}

html {
  background-color: var(--content-bg);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  font-size: 16px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--content-text);
  background-color: var(--content-bg);
}

::selection {
  background-color: var(--theme-color-soft);
  color: var(--content-text);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

#app {
  display: flex;
  min-height: 100vh;
}

.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 60px;
  background-color: var(--nav-bg);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--border-color);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

/* 导航栏上的"首页"按钮 */
.nav-home {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 11px;
  flex: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--content-text);
  text-decoration: none;
  background-color: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  transition: color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.nav-home:hover {
  color: var(--link-color);
  background-color: var(--hover-bg);
  border-color: var(--theme-color);
}

.nav-home.router-link-active {
  color: var(--link-color);
  border-color: var(--theme-color);
  background-color: var(--theme-color-softer);
}

.nav-home:focus-visible {
  outline: 2px solid var(--theme-color);
  outline-offset: 2px;
}

/* 主题切换按钮 */
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  flex: none;
  color: var(--content-text-light);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s, border-color 0.2s, transform 0.2s;
}

.theme-toggle:hover {
  color: var(--link-color);
  background-color: var(--hover-bg);
  border-color: var(--border-color);
}

.theme-toggle:active {
  transform: scale(0.92);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--theme-color);
  outline-offset: 2px;
}

.theme-icon-enter-active,
.theme-icon-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.theme-icon-enter {
  opacity: 0;
  transform: rotate(-60deg) scale(0.6);
}

.theme-icon-leave-to {
  opacity: 0;
  transform: rotate(60deg) scale(0.6);
}

/* 侧边栏收起 / 展开按钮 */
.sidebar-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  flex: none;
  color: var(--content-text-light);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s, border-color 0.2s;
}

.sidebar-toggle:hover {
  color: var(--link-color);
  background-color: var(--hover-bg);
  border-color: var(--border-color);
}

.sidebar-toggle:focus-visible {
  outline: 2px solid var(--theme-color);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.nav-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--heading-text);
  text-decoration: none;
  white-space: nowrap;
}

.nav-title:hover {
  color: var(--link-color);
}

.nav-menu {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--content-text-light);
  text-decoration: none;
  border-radius: 6px;
  transition: color 0.2s, background-color 0.2s;
}

.nav-link:hover {
  color: var(--link-color);
  background-color: var(--sidebar-bg);
}

.nav-link.router-link-active {
  color: var(--link-color);
}

.edit-on-github {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--content-text);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.github-icon {
  flex: none;
}

.edit-on-github:hover {
  color: var(--link-color);
  background-color: var(--hover-bg);
  border-color: var(--theme-color);
}

.layout {
  display: flex;
  flex: 1;
  min-width: 0;
  padding-top: 60px;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  top: 60px;
  left: 0;
  bottom: 0;
  width: 280px;
  background-color: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  overflow-y: auto;
  padding: 20px 0 32px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
  /* 收起时整条侧边栏滑出屏幕，同时隐藏起来，避免键盘 Tab 还能聚焦到不可见的链接 */
  transition: transform 0.25s ease, visibility 0.25s ease,
    background-color 0.25s ease, border-color 0.25s ease;
}

.sidebar::-webkit-scrollbar {
  width: 8px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 4px;
}

.sidebar:hover::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
}

.layout.is-collapsed .sidebar {
  transform: translateX(-100%);
  visibility: hidden;
}

.sidebar-group {
  margin-bottom: 24px;
}

/* 分类标题：整行都是按钮，点一下折叠/展开该分类下的文档 */
.sidebar-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 24px;
  margin-bottom: 4px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: left;
  color: var(--content-text-light);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;
}

.sidebar-group-title:hover {
  color: var(--link-color);
  background-color: var(--theme-color-softer);
}

.sidebar-group-title:focus-visible {
  outline: 2px solid var(--theme-color);
  outline-offset: -2px;
}

/* 当前文档所在的分类：标题高亮，折叠起来也能知道自己在哪 */
.sidebar-group-title.is-active {
  color: var(--link-color);
}

.group-arrow {
  flex: none;
  transition: transform 0.2s ease;
}

.sidebar-group-title.is-collapsed .group-arrow {
  transform: rotate(-90deg);
}

.group-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--content-text-light);
  background-color: var(--hover-bg);
  border-radius: 999px;
  padding: 1px 7px;
}

.sidebar-group-body.is-collapsed {
  display: none;
}

.sidebar-group-body:not(.is-collapsed) {
  animation: sidebarGroupIn 0.18s ease;
}

@keyframes sidebarGroupIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.sidebar-link {
  display: block;
  margin: 1px 12px;
  padding: 7px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--sidebar-text);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s, color 0.2s;
}

.sidebar-link:hover {
  color: var(--sidebar-text-active);
  background-color: var(--theme-color-softer);
}

.sidebar-link.router-link-active {
  color: var(--sidebar-text-active);
  background-color: var(--theme-color-soft);
  font-weight: 500;
}

.content {
  flex: 1;
  margin-left: 280px;
  padding: 40px 60px;
  max-width: calc(100% - 280px);
  transition: margin-left 0.25s ease, max-width 0.25s ease;
}

.layout.is-collapsed .content {
  margin-left: 0;
  max-width: 100%;
}

/* 右下角"回到顶部" */
.back-to-top {
  position: fixed;
  right: 32px;
  bottom: 32px;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--content-text-light);
  background-color: var(--content-bg);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  /* 默认隐藏：visibility 让它同时退出 Tab 顺序和读屏 */
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
  transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease,
    color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.back-to-top.is-visible {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.back-to-top:hover {
  color: var(--link-color);
  border-color: var(--theme-color);
  box-shadow: var(--shadow-md);
}

.back-to-top.is-visible:hover {
  transform: translateY(-2px);
}

.back-to-top:focus-visible {
  outline: 2px solid var(--theme-color);
  outline-offset: 2px;
}

/* 窄屏：侧边栏改为浮层，收起时正文占满整屏 */
@media (max-width: 1080px) {
  .content {
    margin-left: 0;
    max-width: 100%;
    padding: 32px 24px;
  }

  .sidebar {
    box-shadow: var(--shadow-md);
  }

  .back-to-top {
    right: 16px;
    bottom: 16px;
    width: 40px;
    height: 40px;
  }
}

/* 手机上隐藏 "Edit on GitHub" 文字，只留图标 */
@media (max-width: 720px) {
  .nav-container {
    padding: 0 16px;
  }

  .nav-title {
    font-size: 17px;
  }

  .edit-on-github-text {
    display: none;
  }

  .edit-on-github {
    padding: 6px 9px;
  }

  /* 首页按钮同样只留图标 */
  .nav-home-text {
    display: none;
  }

  .nav-home {
    padding: 0 9px;
  }
}
</style>
