import { createRouter, createWebHistory } from 'vue-router'
import ReinitialisationView from '../views/ReinitialisationView.vue'
import TestCsvView from '../views/TestCsvView.vue'
import ImportCsvView from '../views/ImportCsvView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'reinitialisation',
      component: ReinitialisationView,
    },
    {
      path: '/testcsv',
      name: 'testcsv',
      component: TestCsvView,
    },
    {
      path: '/importcsv',
      name: 'importcsv',
      component: ImportCsvView,
    },
  ],
})

export default router
