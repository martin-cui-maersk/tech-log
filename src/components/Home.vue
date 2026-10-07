<template>
  <div class="home">
    <div class="hero">
      <h1 class="hero-title">Tech Log</h1>
      <p class="hero-subtitle">个人技术学习笔记与文档</p>
    </div>

    <div class="info-section">
      <h2>前言</h2>
      <p>这里记录了我在技术学习过程中的心得、笔记和文档。主要涵盖 Git、MySQL、PHP、Hyperf、网络、设计模式、算法、Redis、Docker、Linux 等技术领域。</p>
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
            <td>v1.2.0</td>
            <td>2026-10-06</td>
            <td>新增算法、Redis、Docker、Linux 四篇文档</td>
          </tr>
          <tr>
            <td>v1.1.0</td>
            <td>2026-10-06</td>
            <td>文档自动扫描、全文搜索、浅色/深色主题、侧边栏分类折叠、回到顶部；新增 MySQL / PHP / 网络 / 设计模式文档</td>
          </tr>
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
      <!-- 这里的内容来自 src/assets/docs 自动扫描，新增 markdown 文件后无需改动 -->
      <p v-if="!docs.length" class="empty-tip">还没有文档，把 .md 文件放进 src/assets/docs 就可以了。</p>
      <div v-for="group in categories" :key="group.name" class="doc-group">
        <h3>{{ group.name }}</h3>
        <ul class="doc-list">
          <li v-for="doc in group.docs" :key="doc.slug">
            <router-link :to="'/docs/' + doc.slug" class="doc-card">
              <span class="doc-title">{{ doc.title }}</span>
              <span v-if="doc.description" class="doc-desc">{{ doc.description }}</span>
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { docs, categories } from '@/utils/docRegistry'

export default {
  name: 'Home',
  data () {
    return {
      docs: docs,
      categories: categories
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 860px;
  margin: 0 auto;
}

.hero {
  position: relative;
  text-align: center;
  padding: 62px 0 44px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 40px;
}

/* 标题后面一层很淡的绿色光晕 */
.hero::before {
  content: '';
  position: absolute;
  top: -30px;
  left: 50%;
  width: 460px;
  height: 220px;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, var(--theme-color-soft), transparent 75%);
  pointer-events: none;
}

.hero-title {
  position: relative;
  font-size: 42px;
  font-weight: 700;
  color: var(--heading-text);
  margin-bottom: 12px;
  letter-spacing: -1px;
}

.hero-subtitle {
  position: relative;
  font-size: 17px;
  color: var(--content-text-light);
}

.info-section {
  margin-bottom: 40px;
}

.info-section h2 {
  font-size: 21px;
  font-weight: 650;
  color: var(--heading-text);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.info-section p {
  margin: 8px 0;
  line-height: 1.85;
  color: var(--content-text);
}

.version-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.version-table th,
.version-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.version-table th {
  background-color: var(--surface-2);
  color: var(--heading-text);
  font-weight: 600;
}

.version-table tr:last-child td {
  border-bottom: none;
}

.doc-group {
  margin-bottom: 26px;
}

.doc-group h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--content-text-light);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 10px;
}

.doc-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 10px;
}

/* 每篇文档一张可点的小卡片 */
.doc-card {
  display: block;
  padding: 12px 16px;
  background-color: var(--content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s, background-color 0.2s;
}

.doc-card:hover {
  border-color: var(--theme-color);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.doc-title {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--heading-text);
  transition: color 0.2s;
}

.doc-card:hover .doc-title {
  color: var(--link-color);
}

.doc-desc {
  display: block;
  margin-top: 5px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--content-text-light);
}

.empty-tip {
  color: var(--content-text-light);
}
</style>
