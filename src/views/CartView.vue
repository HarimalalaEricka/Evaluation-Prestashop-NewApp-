<script setup>
import { ref, onMounted, computed } from 'vue'
import { getCartByCustomerId } from '../services/CartService.js'
import { insertOrder } from '../services/commandeService.js'

const idCustomer = getCustomerId()
const cart = ref(null)
const loading = ref(false)
const error = ref('')

function getCustomerId() {
  const customerConnected = localStorage.getItem('customerConnected')

  if (!customerConnected) return 0

  try {
    const customer = JSON.parse(customerConnected)
    return Number(customer?.id ?? 0)
  } catch (error) {
    console.error('Impossible de lire customerConnected:', error)
    return 0
  }
}

const rows = computed(() => {
  if (!cart.value || !cart.value.associations) return []
  const assoc = cart.value.associations

  // Try common shapes: associations.cart_rows.cart_row (single or array)
  const cartRows = assoc.cart_rows || assoc.cartRows || null
  if (!cartRows) return []

  // If nested under cart_row
  if (cartRows.cart_row) {
    return Array.isArray(cartRows.cart_row) ? cartRows.cart_row : [cartRows.cart_row]
  }

  // If cart_rows is an array of rows already
  if (Array.isArray(cartRows)) return cartRows

  // Fallback: if it's an object representing a single row
  return [cartRows]
})

async function fetchCart() {
  loading.value = true
  error.value = ''

  try {
    cart.value = await getCartByCustomerId(idCustomer)
    console.log('Cart data:', cart.value)
    console.log('Customer id:', idCustomer)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function Commander() {
  if (!cart.value) {
    alert('Aucun panier actif trouvé pour ce client.')
    return
  }

  try {
    await insertOrder(cart.value.id)
    alert('Commande créée avec succès !')
  } catch (err) {
    console.error('Erreur lors de la création de la commande :', err)
    alert('Erreur lors de la création de la commande : ' + (err instanceof Error ? err.message : String(err)))
  }
}

onMounted(fetchCart)
</script>

<template>
  <div>
    <h1>Panier</h1>

    <p v-if="loading">Chargement...</p>
    <p v-else-if="error">{{ error }}</p>

    <div v-else>
      <div v-if="cart">
        <p><strong>ID :</strong> {{ cart.id }}</p>
        <p><strong>Client :</strong> {{ cart.id_customer }}</p>
        <p><strong>Date création :</strong> {{ cart.date_add }}</p>

        <div v-if="rows.length">
          <h3>Lignes du panier</h3>
          <table border="1">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Quantité</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in rows" :key="idx">
                <td>{{ row.id_product || row.idProduct || row.product_id }}</td>
                <td>{{ row.quantity }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else>
        <p>Aucun panier actif trouvé pour ce client.</p>
      </div>
      <button @click="Commander">Commander</button>
    </div>
  </div>
</template>