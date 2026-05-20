import { createRouter, createWebHistory } from 'vue-router'
import ReinitialisationView from '../views/ReinitialisationView.vue'
import TestCsvView from '../views/TestCsvView.vue'
import ImportCsvView from '../views/ImportCsvView.vue'
import FileImportView from '../views/FileImportView.vue'
import LoginView from '../views/LoginView.vue'
import CommandeView from '../views/CommandeView.vue'
import ProductView from '../views/ProductView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import CartView from '../views/CartView.vue'
import CommandeValidView from '../views/CommandeValidView.vue'
import DashboardView from '../views/DashboardView.vue'
import CustomerView from '../views/CustomerView.vue'
import CustomerLoginView from '../views/CustomerLoginView.vue'
import StockView from '../views/StockView.vue'
import StockSummaryView from '../views/StockSummaryView.vue'
import OrderHistoryView from '../views/OrderHistoryView.vue'
import ImportCsvMultiView from '../views/ImportCsvMultiView.vue'
import QuickDeleteView from '../views/QuickDeleteView.vue'
import BeneficeByCategorieView from '../views/BeneficeByCategorieView.vue'
import ValidateCommandeView from '../views/ValidateCommandeView.vue'

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
      path: '/quick-delete',
      name: 'quick-delete',
      component: QuickDeleteView,
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
      path: '/fileimport',
      name: 'fileimport',
      component: FileImportView,
      meta: { requiresAuth: 'admin' },
    },
    {
      path: '/importcsvmulti',
      name: 'importcsvmulti',
      component: ImportCsvMultiView,
      meta: { requiresAuth: 'admin' },
    },
    {
      path: '/loginBO',
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
      meta: { requiresAuth: 'customer', allowGuest: true },
    },
    {
      path: '/products/:id',
      name: 'product-detail',
      component: ProductDetailView,
      meta: { requiresAuth: 'customer', allowGuest: true },
      props: true,
    },
    {
      path: '/cart',
      name: 'cart',
      component: CartView,
      meta: { requiresAuth: 'customer', allowGuest: true },
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
      path: '/',
      name: 'customers',
      component: CustomerView,
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
    {
      path: '/orderHistory',
      name: 'orderHistory',
      component: OrderHistoryView,
      // order history should be only for logged customers (not guests)
      meta: { requiresAuth: 'customer', allowGuest: false },
      props: true,
    },
    {
      path: '/validate-order',
      name: 'validate-order',
      component: CommandeValidView,
      meta: { requiresAuth: 'customer', allowGuest: true },
      props: true,
    },
    {
      path: '/benefice-by-categorie',
      name: 'benefice-by-categorie',
      component: BeneficeByCategorieView,
      meta: { requiresAuth: 'admin' },
      props: true,
    },
    {
      path: '/order-valid/:id/quantity/:quantity',
      name: '/order-valid',
      component: ValidateCommandeView,
      meta: { requiresAuth: 'customer' },
      props: true,
    }
  ],
})


router.beforeEach((to, from) => {
  const adminRaw = localStorage.getItem('userConnected')
  const guestRaw = localStorage.getItem('guest')
  const customerRaw = localStorage.getItem('customerConnected')

  const admin = Boolean(adminRaw)

  let guestSession = null
  let customerSession = null
  try {
    guestSession = guestRaw ? JSON.parse(guestRaw) : null
  } catch (e) {
    guestSession = null
  }

  try {
    customerSession = customerRaw ? JSON.parse(customerRaw) : null
  } catch (e) {
    customerSession = null
  }

  const guest = Boolean(guestSession)
  const customer = Boolean(customerSession)

  // Le meta `requiresAuth` peut être:
  // - undefined / falsy: pas d'auth requise
  // - true: accepter admin OU customer
  // - 'admin' : seulement admin
  // - 'customer' : seulement customer (guest est une sous-catégorie)
  const required = to.meta.requiresAuth
  const allowGuest = Boolean(to.meta.allowGuest)

  if (required === 'admin' && !admin) return '/'

  if (required === 'customer') {
    if (!guest && !customer) return '/'
    if (!allowGuest && guest && !customer) return '/'
  }

  if (required === true && !admin && !guest && !customer) return '/'

  // Redirections après login selon session
  if (to.path === '/' && admin) return '/dashboard'
  if (to.path === '/' && (guest || customer) && !admin) return '/products'

  return true
})

export default router
