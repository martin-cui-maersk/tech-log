import Vue from 'vue'
import Router from 'vue-router'
import Home from '@/components/Home'
import GitDocs from '@/components/GitDocs'

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
      path: '/git/:doc',
      name: 'GitDocs',
      component: GitDocs
    }
  ]
})
