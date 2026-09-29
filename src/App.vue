<template>
  <div id="app">
    <header class="nav-bar">
      <div class="nav-container">
        <a href="/" class="nav-title">技术随笔</a>
        <a href="https://github.com/martin-cui-maersk/tech-log" target="_blank" rel="noopener" class="edit-on-github">
          <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: text-bottom; margin-right: 4px;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
          Edit on GitHub
        </a>
      </div>
    </header>
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-inner">
          <div class="sidebar-group">
            <div class="sidebar-group-title">首页</div>
            <router-link to="/" class="sidebar-link">前言</router-link>
          </div>
          <div class="sidebar-group">
            <div class="sidebar-group-title">Git</div>
            <router-link to="/git/git-merge" class="sidebar-link">Git 合并指南</router-link>
            <router-link to="/git/git-workflow" class="sidebar-link">Git 工作流</router-link>
          </div>
          <div class="sidebar-group">
            <div class="sidebar-group-title">Hyperf</div>
            <router-link to="/git/hyperf-sleep" class="sidebar-link">Hyperf 协程与阻塞处理</router-link>
          </div>
        </div>
      </aside>
      <main class="content">
        <router-view/>
      </main>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
:root {
  --theme-color: #3eaf7c;
  --theme-color-light: #42b983;
  --sidebar-bg: #f6f6f7;
  --sidebar-text: #364149;
  --sidebar-text-active: #3eaf7c;
  --sidebar-border: #e1e4e8;
  --content-bg: #ffffff;
  --content-text: #2c3e50;
  --content-text-light: #666;
  --link-color: #3eaf7c;
  --code-bg: #f8f8f8;
  --border-color: #eaecef;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--content-text);
  background-color: var(--content-bg);
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
  background-color: var(--content-bg);
  border-bottom: 1px solid var(--border-color);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
}

.nav-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--content-text);
  text-decoration: none;
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
  color: var(--theme-color);
  background-color: var(--sidebar-bg);
}

.nav-link.router-link-active {
  color: var(--theme-color);
}

.edit-on-github {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: var(--content-text);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.edit-on-github:hover {
  background-color: #f6f8fa;
  border-color: #d1d5da;
}

.layout {
  display: flex;
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
  padding: 24px 0;
}

.sidebar-group {
  margin-bottom: 24px;
}

.sidebar-group-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--content-text-light);
  padding: 8px 24px;
  margin-bottom: 4px;
}

.sidebar-link {
  display: block;
  padding: 8px 24px;
  font-size: 14px;
  color: var(--sidebar-text);
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.sidebar-link:hover {
  color: var(--sidebar-text-active);
  background-color: rgba(62, 175, 124, 0.05);
}

.sidebar-link.router-link-active {
  color: var(--sidebar-text-active);
  border-left-color: var(--theme-color);
  background-color: rgba(62, 175, 124, 0.08);
  font-weight: 500;
}

.content {
  flex: 1;
  margin-left: 280px;
  padding: 40px 60px;
  max-width: calc(100% - 280px);
}
</style>
