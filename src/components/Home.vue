<template>
  <div class="home">
    <!-- Hero：标题 + 一句话 + 统计 + 两个入口按钮 -->
    <section class="hero">
      <h1 class="hero-title">技术随笔</h1>
      <p class="hero-subtitle">个人技术学习笔记与文档</p>
      <p class="hero-tagline">{{ docs.length }} 篇实战文档 · {{ categories.length }} 个分类 · 支持全文搜索</p>
      <div class="hero-actions">
        <router-link class="hero-button hero-button-primary" :to="firstDocLink">开始阅读 →</router-link>
        <a class="hero-button" href="#分类">按分类浏览</a>
      </div>
    </section>

    <!-- 分类卡片：和参考站一样的网格布局，全部由文档扫描结果生成 -->
    <section id="分类" class="feature-section">
      <div class="feature-grid">
        <router-link
          v-for="card in cards"
          :key="card.name"
          class="feature-card"
          :to="card.link"
        >
          <span class="feature-head">
            <span class="feature-icon" aria-hidden="true">{{ card.icon }}</span>
            <span v-if="card.updated" class="feature-updated">最近更新 {{ card.updated }}</span>
          </span>
          <span class="feature-title">{{ card.name }}</span>
          <span class="feature-meta">{{ card.count }} 篇文档</span>
          <span class="feature-details">{{ card.details }}</span>
          <span class="feature-action">开始阅读 →</span>
        </router-link>
      </div>
    </section>

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
  </div>
</template>

<script>
import { docs, categories } from '@/utils/docRegistry'

// 分类图标（拿不到就显示默认图标，新增分类不用改代码）
const CATEGORY_ICONS = {
  Git: '🌿',
  MySQL: '🗄️',
  PHP: '🐘',
  Hyperf: '⚡',
  网络: '📡',
  设计模式: '🏛️',
  算法: '📊',
  Redis: '🚀',
  Docker: '🐳',
  Linux: '🖥️'
}
const DEFAULT_ICON = '📄'
const DETAILS_MAX = 56

function docDetails (group) {
  const names = group.docs.map(doc => doc.navTitle).join(' · ')
  return names.length > DETAILS_MAX ? names.slice(0, DETAILS_MAX).trim() + '…' : names
}

// 分类里最近一次更新的日期（meta.updated 由构建时的 loader 取 git 提交日期）
function latestUpdated (group) {
  return group.docs.reduce((latest, doc) => (doc.updated && doc.updated > latest ? doc.updated : latest), '')
}

export default {
  name: 'Home',
  data () {
    return {
      docs: docs,
      categories: categories
    }
  },
  computed: {
    firstDocLink () {
      return this.docs.length ? '/docs/' + this.docs[0].slug : '/'
    },
    cards () {
      return this.categories.map(group => ({
        name: group.name,
        icon: CATEGORY_ICONS[group.name] || DEFAULT_ICON,
        count: group.docs.length,
        details: docDetails(group),
        updated: latestUpdated(group),
        link: '/docs/' + group.docs[0].slug
      }))
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 1040px;
  margin: 0 auto;
}

/* ---------- Hero ---------- */
.hero {
  position: relative;
  text-align: center;
  padding: 58px 0 40px;
}

/* 标题后面一层很淡的绿色光晕 */
.hero::before {
  content: '';
  position: absolute;
  top: -30px;
  left: 50%;
  width: 520px;
  height: 240px;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, var(--theme-color-soft), transparent 75%);
  pointer-events: none;
}

.hero-title {
  position: relative;
  font-size: 42px;
  font-weight: 700;
  color: var(--heading-text);
  margin-bottom: 10px;
  letter-spacing: -1px;
}

.hero-subtitle {
  position: relative;
  font-size: 17px;
  color: var(--content-text-light);
}

.hero-tagline {
  position: relative;
  margin-top: 14px;
  font-size: 14px;
  color: var(--content-text-light);
}

.hero-actions {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 26px;
}

.hero-button {
  display: inline-flex;
  align-items: center;
  padding: 10px 22px;
  font-size: 15px;
  font-weight: 500;
  color: var(--content-text);
  background-color: var(--content-bg);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition: color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.hero-button:hover {
  color: var(--link-color);
  border-color: var(--theme-color);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.hero-button-primary {
  color: #fff;
  background-color: var(--theme-color);
  border-color: var(--theme-color);
}

.hero-button-primary:hover {
  color: #fff;
  background-color: var(--theme-color-light);
  border-color: var(--theme-color-light);
}

/* ---------- 分类卡片 ---------- */
.feature-section {
  scroll-margin-top: 84px;
  margin-bottom: 44px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
}

.feature-card {
  display: flex;
  flex-direction: column;
  padding: 20px 22px 18px;
  background-color: var(--content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s, background-color 0.2s;
}

.feature-card:hover {
  border-color: var(--theme-color);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.feature-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
}

.feature-icon {
  font-size: 26px;
  line-height: 1.2;
}

.feature-updated {
  flex: none;
  padding: 2px 9px;
  font-size: 11.5px;
  color: var(--content-text-light);
  background-color: var(--hover-bg);
  border-radius: 999px;
}

.feature-title {
  margin-top: 10px;
  font-size: 16.5px;
  font-weight: 650;
  color: var(--heading-text);
  transition: color 0.2s;
}

.feature-card:hover .feature-title {
  color: var(--link-color);
}

.feature-meta {
  margin-top: 3px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--link-color);
}

.feature-details {
  flex: 1;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--content-text-light);
}

.feature-action {
  margin-top: 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--link-color);
}

/* ---------- 前言 / 版本记录 ---------- */
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

/* 窄屏：Hero 收一点，卡片单列 */
@media (max-width: 720px) {
  .hero {
    padding: 40px 0 30px;
  }

  .hero-title {
    font-size: 32px;
  }

  .hero-button {
    padding: 9px 18px;
    font-size: 14px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
