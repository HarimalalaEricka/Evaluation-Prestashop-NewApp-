import { createRouter, createWebHistory } from 'vue-router'
import ReinitialisationView from '../views/ReinitialisationView.vue'
import TestCsvView from '../views/TestCsvView.vue'
import ImportCsvView from '../views/ImportCsvView.vue'
import LoginView from '../views/LoginView.vue'
import CommandeView from '../views/CommandeView.vue'
import ProductView from '../views/ProductView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import CartView from '../views/CartView.vue'
import DashboardView from '../views/DashboardView.vue'
import CustomerView from '../views/CustomerView.vue'
import CustomerLoginView from '../views/CustomerLoginView.vue'
import StockView from '../views/StockView.vue'
import StockSummaryView from '../views/StockSummaryView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/reset',
      name: 'reinitialisation',
      component: ReinitialisationView,
      meta: { requiresAuth: 'admin' },
    },
    {
      path: '/testcsv',
      name: 'testcsv',
      component: TestCsvView,
      meta: { requiresAuth: 'admin' },
    },
    {
      path: '/importcsv',
      name: 'importcsv',
      component: ImportCsvView,
      meta: { requiresAuth: 'admin' },
    },
    {
      path: '/',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/orders',
      name: 'orders',
      component: CommandeView,
      meta: { requiresAuth: 'admin' },
    },
    {
      path: '/products',
      name: 'products',
      component: ProductView,
      meta: { requiresAuth: 'customer' },
    },
    {
      path: '/products/:id',
      name: 'product-detail',
      component: ProductDetailView,
      meta: { requiresAuth: 'customer' },
      props: true,
    },
    {
      path: '/cart',
      name: 'cart',
      component: CartView,
      meta: { requiresAuth: 'customer' },
      props: true,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: 'admin' },
      props: true,
    },
    {
      path: '/customers',
      name: 'customers',
      component: CustomerView,
      meta: { requiresAuth: 'admin' },
      props: true,
    },
    {
      path: '/loginCustomer',
      name: 'loginCustomer',
      component: CustomerLoginView,
      props: true,
    },
    {
      path: '/stock',
      name: 'stock',
      component: StockView,
      meta: { requiresAuth: 'admin' },
      props: true,
    },
    {
      path: '/stockSummary',
      name: 'stockSummary',
      component: StockSummaryView,
      meta: { requiresAuth: 'admin' },
      props: true,
    },
  ],
})


router.beforeEach((to, from) => {
  const admin = localStorage.getItem('userConnected')
  const customer = localStorage.getItem('customerConnected')

  // Le meta `requiresAuth` peut être:
  // - undefined / falsy: pas d'auth requise
  // - true: accepter admin OU customer
  // - 'admin' : seulement admin
  // - 'customer' : seulement customer
  const required = to.meta.requiresAuth

  if (required === 'admin' && !admin) return '/'
  if (required === 'customer' && !customer) return '/'
  if (required === true && !admin && !customer) return '/'

  // Redirections après login selon session
  if (to.path === '/' && admin) return '/orders'
  if (to.path === '/' && customer && !admin) return '/products'

  return true
})

export default router
