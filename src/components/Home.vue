<template>
  <div class="home">
    <div class="hero">
      <h1 class="hero-title">Tech Log</h1>
      <p class="hero-subtitle">个人技术学习笔记与文档</p>
    </div>

    <div class="info-section">
      <h2>前言</h2>
      <p>这里记录了我在技术学习过程中的心得、笔记和文档。主要涵盖 Git、PHP、算法、网络、设计模式等技术领域。</p>
      <p>所有文档均为个人总结，如有错误欢迎指出。</p>
    </div>

    <div class="info-section">
      <h2>版本更新记录</h2>
      <table class="version-table">
        <thead>
          <tr>
            <th>版本号</th>
            <th>构建日期</th>
            <th>更新内容</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>v1.0.0</td>
            <td>2026-09-29</td>
            <td>初始版本，包含 Git 模块文档</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="info-section">
      <h2>文档导航</h2>
      <ul class="doc-list">
        <li><router-link to="/git/git-merge">Git 合并指南</router-link> - 功能分支合并到 gray/master 的完整流程</li>
        <li><router-link to="/git/git-workflow">Git 工作流</router-link> - Git 开发与部署标准作业流程</li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home'
}
</script>

<style scoped>
.home {
  max-width: 860px;
}

.hero {
  text-align: center;
  padding: 60px 0 40px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 40px;
}

.hero-title {
  font-size: 42px;
  font-weight: 700;
  color: var(--content-text);
  margin-bottom: 12px;
  letter-spacing: -1px;
}

.hero-subtitle {
  font-size: 18px;
  color: var(--content-text-light);
}

.info-section {
  margin-bottom: 40px;
}

.info-section h2 {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.info-section p {
  margin: 8px 0;
  line-height: 1.8;
  color: var(--content-text);
}

.version-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.version-table th,
.version-table td {
  border: 1px solid var(--border-color);
  padding: 10px 14px;
  text-align: left;
}

.version-table th {
  background-color: #f6f8fa;
  font-weight: 600;
}

.doc-list {
  list-style: none;
  padding: 0;
}

.doc-list li {
  padding: 8px 0;
  line-height: 1.8;
}

.doc-list a {
  color: var(--link-color);
  text-decoration: none;
  font-weight: 500;
}

.doc-list a:hover {
  text-decoration: underline;
}
</style>
