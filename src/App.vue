<template>
  <div id="app">
    <nav class="sidebar">
      <div class="logo">Tech Log</div>
      <ul class="nav-list">
        <li class="nav-item">
          <router-link to="/git/git-merge" class="nav-link">Git 合并指南</router-link>
        </li>
        <li class="nav-item">
          <router-link to="/git/git-workflow" class="nav-link">Git 工作流</router-link>
        </li>
      </ul>
    </nav>
    <main class="content">
      <router-view/>
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

#app {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  background-color: #2c3e50;
  color: #fff;
  padding: 20px 0;
  position: fixed;
  height: 100vh;
  overflow-y: auto;
}

.logo {
  font-size: 1.4em;
  font-weight: bold;
  padding: 0 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 10px;
}

.nav-list {
  list-style: none;
}

.nav-item {
  margin: 2px 0;
}

.nav-link {
  display: block;
  padding: 10px 20px;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #fff;
  background-color: rgba(255,255,255,0.05);
}

.nav-link.router-link-active {
  color: #42b983;
  background-color: rgba(66,185,131,0.1);
  border-right: 3px solid #42b983;
}

.content {
  flex: 1;
  margin-left: 220px;
  background-color: #fff;
  min-height: 100vh;
}
</style>
