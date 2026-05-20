<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import Disconnect from './components/Disconnect.vue'

const route = useRoute()

// Routes qui n'affichent pas la navbar
const noNavbarRoutes = ['loginBO', 'loginCustomer']

// Routes de backoffice
const backofficeRoutes = ['dashboard', 'orders', 'stock', 'stockSummary', 'reinitialisation', 'quick-delete', 'importcsvmulti', 'benefice-by-categorie']

const shouldShowNavbar = computed(() => !noNavbarRoutes.includes(route.name))
const isBackoffice = computed(() => backofficeRoutes.includes(route.name))

const isAdmin = computed(() => {
  return !!localStorage.getItem('userConnected')
})
</script>

<template>
  <div id="app-root" :class="{ 'backoffice': isBackoffice }">
    <nav v-if="shouldShowNavbar" class="navbar">
      <div class="navbar-container">
        <router-link to="/" class="navbar-brand">
          {{ isBackoffice ? '🔧 Admin' : '🛍️ NewApp' }}
        </router-link>
        <ul class="navbar-menu">
          <li v-if="!isBackoffice">
            <router-link to="/">Accueil</router-link>
          </li>
          <li v-if="!isBackoffice">
            <router-link to="/products">Produits</router-link>
          </li>
          <li v-if="!isBackoffice">
            <router-link to="/cart">Panier</router-link>
          </li>
          <li v-if="!isBackoffice">
            <router-link to="/orderHistory">Mes commandes</router-link>
          </li>
          <li v-if="isBackoffice">
            <router-link to="/dashboard">Tableau de bord</router-link>
          </li>
          <li v-if="isBackoffice">
            <router-link to="/orders">Commandes</router-link>
          </li>
          <li v-if="isBackoffice">
            <router-link to="/stock">Stock</router-link>
          </li>
          <li v-if="isBackoffice">
            <router-link to="/importcsvmulti">Import CSV</router-link>
          </li>
          <li v-if="isBackoffice">
            <router-link to="/quick-delete">Supprimer données</router-link>
          </li>
          <li v-if="isBackoffice">
            <router-link to="/benefice-by-categorie">Categorie</router-link>
          </li>
          <li v-if="!isBackoffice">
            <router-link to="/loginBO">Admin</router-link>
          </li>
        </ul>
        <Disconnect v-if="shouldShowNavbar" />
      </div>
    </nav>
    
    <main :class="{ 'container': shouldShowNavbar }">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
#app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
  padding-top: var(--spacing-lg);
  padding-bottom: var(--spacing-xl);
}

main.container {
  max-width: 1200px;
  margin: var(--spacing-lg) auto 0;
  padding-left: var(--spacing-lg);
  padding-right: var(--spacing-lg);
  width: 100%;
}
</style>
