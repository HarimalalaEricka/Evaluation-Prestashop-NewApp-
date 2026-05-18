<script setup>
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const router = useRouter()

const userInfo = computed(() => {
  const admin = localStorage.getItem('userConnected')
  const customer = localStorage.getItem('customerConnected')
  const guest = localStorage.getItem('guest')
  
  if (admin) return { type: '👨‍💼 Admin', name: 'Administrateur' }
  if (customer) {
    try {
      const parsed = JSON.parse(customer)
      return { type: '👤 Client', name: parsed.name || 'Utilisateur' }
    } catch (e) {
      return { type: '👤 Client', name: 'Utilisateur' }
    }
  }
  if (guest) return { type: '👥 Invité', name: 'Invité' }
  return null
})

function disconnect() {
  try {
    const isAdmin = localStorage.getItem('userConnected')
    const isCustomer = localStorage.getItem('customerConnected')
    const isGuest = localStorage.getItem('guest')

    if (isAdmin) {
      localStorage.removeItem('userConnected')
    }

    if (isCustomer) {
      localStorage.removeItem('customerConnected')
    }

    if (isGuest) {
      localStorage.removeItem('guest')
      localStorage.removeItem('guestSession')
    }

    router.push({ name: 'customers' })
  } catch (error) {
    console.error('Erreur lors de la déconnexion :', error)
  }
}
</script>

<template>
  <div class="disconnect-container">
    <span v-if="userInfo" class="user-info">
      {{ userInfo.type }} - {{ userInfo.name }}
    </span>
    <button @click="disconnect" class="btn-secondary btn-sm">
      Déconnecter
    </button>
  </div>
</template>

<style scoped>
.disconnect-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-left: auto;
}

.user-info {
  color: var(--text-light);
  font-size: var(--font-size-sm);
}

button {
  margin: 0;
}
</style>