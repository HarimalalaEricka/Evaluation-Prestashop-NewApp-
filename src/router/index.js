import { createRouter, createWebHistory } from 'vue-router'
import ReinitialisationView from '../views/ReinitialisationView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'reinitialisation',
      component: ReinitialisationView,
    },
  ],
})

export default router
