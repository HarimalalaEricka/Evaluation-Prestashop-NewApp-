import { createRouter, createWebHistory } from 'vue-router'
import ReinitialisationView from '../views/ReinitialisationView.vue'
import TestCsvView from '../views/TestCsvView.vue'
import ImportCsvView from '../views/ImportCsvView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/reset',
      name: 'reinitialisation',
      component: ReinitialisationView,
      meta: { requiresAuth: true },
    },
    {
      path: '/testcsv',
      name: 'testcsv',
      component: TestCsvView,
      meta: { requiresAuth: true },
    },
    {
      path: '/importcsv',
      name: 'importcsv',
      component: ImportCsvView,
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      name: 'login',
      component: LoginView,
    },
  ],
})


router.beforeEach((to, from) => {
  const user = localStorage.getItem('customerConnected')

  // 1. pas connecté → bloque accès pages protégées
  if (to.meta.requiresAuth && !user) {
    return '/'
  }

  // 2. déjà connecté → empêcher retour login
  if (to.path === '/' && user) {
    return '/reset'
  }

  return true
})

export default router
