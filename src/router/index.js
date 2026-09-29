import Vue from 'vue'
import Router from 'vue-router'
import GitDocs from '@/components/GitDocs'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      redirect: '/git/git-merge'
    },
    {
      path: '/git/:doc',
      name: 'GitDocs',
      component: GitDocs
    }
  ]
})
