import Vue from 'vue'
import Router from 'vue-router'
import Home from '@/components/Home'
import DocsView from '@/components/DocsView'

Vue.use(Router)

export default new Router({
  mode: 'history',
  base: '/tech-log/',
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home
    },
    {
      // 文档路由：doc 就是 src/assets/docs 里的文件名（去掉 .md 后缀）
      // 新增 markdown 文件后会自动生效，无需在这里注册
      path: '/docs/:doc',
      name: 'DocsView',
      component: DocsView
    },
    {
      // 兼容旧链接 /git/xxx（新链接统一走 /docs/xxx）
      path: '/git/:doc',
      component: DocsView
    }
  ]
})
