/**
 * 主题（浅色 / 深色）
 *
 * - 首次访问跟随系统偏好（prefers-color-scheme）
 * - 用户点过切换按钮后，选择记在 localStorage 里，之后不再跟随系统
 * - 想恢复「跟随系统」：清掉 localStorage 的 tech-log:theme（DevTools 里执行
 *   localStorage.removeItem('tech-log:theme') 后刷新）
 *
 * 主题通过 <html data-theme="light|dark"> 生效，
 * 颜色变量定义在 src/App.vue 的 :root 和 html[data-theme='dark'] 里。
 * index.html 里有一段内联脚本做首屏兜底，避免深色模式刷新时闪白，
 * 它用的 localStorage key 必须和下面这个保持一致。
 */
export const THEME_STORAGE_KEY = 'tech-log:theme'

export function systemTheme () {
  if (!window.matchMedia) {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readStoredTheme () {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'dark' || saved === 'light' ? saved : null
  } catch (e) {
    return null
  }
}

export function resolveTheme () {
  return readStoredTheme() || systemTheme()
}

export function applyTheme (theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function storeTheme (theme) {
  try {
    if (theme === 'dark' || theme === 'light') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    }
  } catch (e) {
    // 隐私模式下 localStorage 不可用，忽略即可
  }
}

// 用户没手动选过主题时，跟随系统切换；返回取消监听的函数
export function watchSystemTheme (handler) {
  if (!window.matchMedia) {
    return function () {}
  }
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => handler(systemTheme())
  if (query.addEventListener) {
    query.addEventListener('change', listener)
  } else if (query.addListener) {
    query.addListener(listener)
  }
  return function () {
    if (query.removeEventListener) {
      query.removeEventListener('change', listener)
    } else if (query.removeListener) {
      query.removeListener(listener)
    }
  }
}
