<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getCartByCustomerId, getCartByGuestId, updateQuantityCart, deleteCartRow } from '../services/CartService.js'
import { getRessourceItemById } from '../services/ressourcesService.js'
import { getCombinationValues } from '../services/stockService.js'
import { getRateByTaxRulesGroupId } from '../services/productService.js'

const router = useRouter()
const sessionInfo = getSessionInfo()
const cart = ref(null)
const rowDetails = ref([])
const loading = ref(false)
const error = ref('')
const priceFormatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function getSessionInfo() {
  const guestRaw = localStorage.getItem('guest')
  const customerConnected = localStorage.getItem('customerConnected')

  if (guestRaw) {
    try {
      const guest = JSON.parse(guestRaw)
      return {
        type: 'guest',
        id: Number(guest?.guestId ?? guest?.id ?? guest?.id_guest ?? 0),
      }
    } catch (error) {
      console.error('Impossible de lire guest:', error)
    }
  }

  if (!customerConnected) {
    return {
      type: null,
      id: 0,
    }
  }

  try {
    const customer = JSON.parse(customerConnected)
    console.log('[CartView] session active = customer', {
      id: Number(customer?.id ?? customer?.id_customer ?? 0),
      source: 'customerConnected',
    })
    return {
      type: 'customer',
      id: Number(customer?.id ?? customer?.id_customer ?? 0),
    }
  } catch (error) {
    console.error('Impossible de lire customerConnected:', error)
    return {
      type: null,
      id: 0,
    }
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
    if (sessionInfo.type === 'guest') {
      cart.value = await getCartByGuestId(sessionInfo.id)
    } else {
      cart.value = await getCartByCustomerId(sessionInfo.id)
    }
    rowDetails.value = []

    if (cart.value && rows.value.length > 0) {
      rowDetails.value = await Promise.all(
        rows.value.map(async (row) => {
          const idProduct = row.id_product || row.idProduct || row.product_id
          const idProductAttribute = row.id_product_attribute || row.idProductAttribute || row.product_attribute_id || 0

          let productName = `Produit #${idProduct}`
          let reference = '-'
          let basePrice = 0
          let taxRate = 0
          let groupLabel = '-'
          let valueLabel = '-'
          let pricePlus = 0

          try {
            const product = await getRessourceItemById('products', idProduct)
            productName = product?.name?.language || product?.name || productName
            reference = product?.reference || '-'
            basePrice = Number(product?.price ?? 0)
            taxRate = Number(await getRateByTaxRulesGroupId(product?.id_tax_rules_group))
          } catch (productError) {
            console.warn('Impossible de charger le produit pour la ligne panier:', {
              idProduct,
              productError,
            })
          }

          if (String(idProductAttribute) !== '0') {
            try {
              const comboValues = await getCombinationValues(idProductAttribute)
              groupLabel = comboValues.map((item) => item.groupe).join(', ') || '-'
              valueLabel = comboValues.map((item) => item.valeur).join(', ') || '-'
              pricePlus = Number(comboValues[0]?.pricePlus ?? comboValues[0]?.price ?? 0)
            } catch (combinationError) {
              console.warn('Impossible de charger les infos combinaison pour la ligne panier:', {
                idProduct,
                idProductAttribute,
                combinationError,
              })
            }
          }

          const rowPrice = (basePrice + pricePlus) * (1 + taxRate / 100)

          return {
            id_product: idProduct,
            id_product_attribute: idProductAttribute,
            quantity: Number(row.quantity ?? 0),
            productName,
            reference,
            groupLabel,
            valueLabel,
            basePrice: priceFormatter.format(basePrice),
            pricePlus: priceFormatter.format(pricePlus),
            taxRate: priceFormatter.format(taxRate),
            rowPrice: priceFormatter.format(rowPrice),
          }
        })
      )
    }

    console.log('Cart data:', cart.value)
    console.log('Session info:', sessionInfo)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function Commander() {
  if (!cart.value) {
    alert('Aucun panier actif trouvé pour ce client.')
    return
  }

  if (rowDetails.value.length === 0) {
    alert('Le panier est vide')
    return
  }

  // Rediriger vers la page de validation de commande
  router.push('/validate-order')
}
async function ModifierQuantite(id_product, quantity) {
  alert(`Modifier la quantité du produit ${id_product} à ${quantity} dans le panier`)
  try {
    await updateQuantityCart(cart.value.id, id_product, quantity)
  } catch (error) {
    console.error('Erreur lors de la modification de la quantité :', error)
    alert('Erreur lors de la modification de la quantité : ' + (error instanceof Error ? error.message : String(error)))
  }
}
async function SupprimerLigne(id_product, id_product_attribute) {
  alert(`Supprimer la ligne du produit ${id_product} (attribut ${id_product_attribute}) du panier`)
  try {
    await deleteCartRow(cart.value.id, id_product, id_product_attribute)
    await fetchCart()
  } catch (error) {
    console.error('Erreur lors de la suppression de la ligne :', error)
    alert('Erreur lors de la suppression de la ligne : ' + (error instanceof Error ? error.message : String(error)))
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
        <p><strong>Client :</strong> {{ cart.id_customer || cart.id_guest || '-' }}</p>
        <p><strong>Date création :</strong> {{ cart.date_add }}</p>

        <div v-if="rowDetails.length">
          <h3>Lignes du panier</h3>
          <table border="1">
            <thead>
              <tr>
                <th>Produit ID</th>
                <th>Nom</th>
                <th>Référence</th>
                <th>Attribut ID</th>
                <th>Groupe</th>
                <th>Valeur</th>
                <th>Prix base</th>
                <th>Prix plus</th>
                <th>Tax rate</th>
                <th>Prix final</th>
                <th>Quantité</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in rowDetails" :key="idx">
                <td>{{ row.id_product }}</td>
                <td>{{ row.productName }}</td>
                <td>{{ row.reference }}</td>
                <td>{{ row.id_product_attribute }}</td>
                <td>{{ row.groupLabel }}</td>
                <td>{{ row.valueLabel }}</td>
                <td>{{ row.basePrice }}</td>
                <td>{{ row.pricePlus }}</td>
                <td>{{ row.taxRate }}</td>
                <td>{{ row.rowPrice }}</td>
                <td>{{ row.quantity }}</td>
                <td>
                  <input type="number" v-model.number="row.quantity" min="1" step="1" />
                  <button @click="ModifierQuantite(row.id_product, row.quantity)">Modifier</button>
                  <button @click="SupprimerLigne(row.id_product, row.id_product_attribute)">Supprimer</button>
                </td>
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