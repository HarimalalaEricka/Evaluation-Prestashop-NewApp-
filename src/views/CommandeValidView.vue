<script setup>
import { ref, onMounted, computed } from 'vue'
import { getCartByGuestId } from '../services/CartService.js'
import { insertOrder } from '../services/commandeService.js'
import { buildProductImageUrl, getRessourceItemById } from '../services/ressourcesService.js'
import { getCombinationValues } from '../services/stockService.js'
import { getRateByTaxRulesGroupId } from '../services/productService.js'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const sessionInfo = getSessionInfo()

const customer = ref(null)
const cart = ref(null)
const address = ref(null)
const rowDetails = ref([])
const loading = ref(false)
const error = ref('')
const isConfirming = ref(false)
const deliveryMethod = ref('Livraison gratuite')
const paymentMethod = ref('Paiement comptant à la livraison')
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
    return { type: null, id: 0 }
  }

  try {
    const customer = JSON.parse(customerConnected)
    return {
      type: 'customer',
      id: Number(customer?.id ?? customer?.id_customer ?? 0),
    }
  } catch (error) {
    console.error('Impossible de lire customerConnected:', error)
    return { type: null, id: 0 }
  }
}

const rows = computed(() => {
  if (!cart.value || !cart.value.associations) return []
  const assoc = cart.value.associations
  const cartRows = assoc.cart_rows || assoc.cartRows || null
  if (!cartRows) return []
  if (cartRows.cart_row) {
    return Array.isArray(cartRows.cart_row) ? cartRows.cart_row : [cartRows.cart_row]
  }
  if (Array.isArray(cartRows)) return cartRows
  return [cartRows]
})

const cartTotal = computed(() => {
  return rowDetails.value.reduce((sum, row) => {
    const price = (Number(row.basePrice) + Number(row.pricePlus)) * (1 + Number(row.taxRate) / 100)
    return sum + (price * Number(row.quantity))
  }, 0)
})

async function fetchData() {
  loading.value = true
  error.value = ''

  try {
    const routeCartId = String(route.value?.query?.cartId ?? '').trim()
    const storedCartId = String(localStorage.getItem('customerCart') ?? '').trim()
    const selectedCartId = routeCartId || storedCartId

    if (selectedCartId) {
      cart.value = await getRessourceItemById('carts', selectedCartId)
    } else if (sessionInfo.type === 'guest') {
      cart.value = await getCartByGuestId(sessionInfo.id)
    } else {
      error.value = 'Aucun panier sélectionné pour la validation'
      return
    }

    if (!cart.value) {
      error.value = 'Aucun panier actif trouvé'
      return
    }

    // Récupérer les infos du client
    if (sessionInfo.type === 'customer') {
      customer.value = await getRessourceItemById('customers', sessionInfo.id)
    }

    // Récupérer l'adresse de livraison
    if (cart.value.id_address_delivery && cart.value.id_address_delivery !== '0') {
      address.value = await getRessourceItemById('addresses', cart.value.id_address_delivery)
    }

    // Récupérer les détails des lignes du panier
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
        let imageUrl = ''

        try {
          const product = await getRessourceItemById('products', idProduct)
          productName = product?.name?.language || product?.name || productName
          reference = product?.reference || '-'
          basePrice = Number(product?.price ?? 0)
          taxRate = Number(await getRateByTaxRulesGroupId(product?.id_tax_rules_group))
          imageUrl = buildProductImageUrl(product)
        } catch (productError) {
          console.warn('Impossible de charger le produit:', { idProduct, productError })
        }

        if (String(idProductAttribute) !== '0') {
          try {
            const comboValues = await getCombinationValues(idProductAttribute)
            groupLabel = comboValues.map((item) => item.groupe).join(', ') || '-'
            valueLabel = comboValues.map((item) => item.valeur).join(', ') || '-'
            pricePlus = Number(comboValues[0]?.pricePlus ?? comboValues[0]?.price ?? 0)
          } catch (combinationError) {
            console.warn('Impossible de charger les infos combinaison:', { idProductAttribute, combinationError })
          }
        }

        return {
          id_product: idProduct,
          id_product_attribute: idProductAttribute,
          quantity: Number(row.quantity ?? 0),
          productName,
          reference,
          groupLabel,
          valueLabel,
          basePrice,
          pricePlus,
          taxRate,
          imageUrl,
        }
      })
    )
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function confirmerCommande() {
  if (!cart.value) {
    alert('Aucun panier actif')
    return
  }

  if (rowDetails.value.length === 0) {
    alert('Le panier est vide')
    return
  }

  isConfirming.value = true

  try {
    await insertOrder(cart.value.id)
    localStorage.removeItem('customerCart')
    alert('Commande créée avec succès !')
    // Redirection vers l'historique des commandes
    router.push('/orders')
  } catch (err) {
    console.error('Erreur lors de la création de la commande :', err)
    alert('Erreur : ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    isConfirming.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div>
    <h1>Validation de la commande</h1>

    <p v-if="loading">Chargement...</p>
    <p v-if="error" style="color: red;"><strong>Erreur:</strong> {{ error }}</p>

    <div v-if="!loading && !error">
      <!-- Infos client -->
      <h2>Informations sur le client</h2>
      <table border="1" style="margin-bottom: 20px;">
        <tr>
          <th>Nom</th>
          <td>{{ customer?.firstname || '-' }} {{ customer?.lastname || '-' }}</td>
        </tr>
        <tr>
          <th>Email</th>
          <td>{{ customer?.email || '-' }}</td>
        </tr>
        <tr>
          <th>Type</th>
          <td>{{ sessionInfo.type === 'customer' ? 'Client' : 'Invité' }}</td>
        </tr>
      </table>

      <!-- Adresse de livraison -->
      <h2>Adresse de livraison</h2>
      <table border="1" style="margin-bottom: 20px;">
        <tr v-if="address">
          <th>Nom</th>
          <td>{{ address?.firstname || '-' }} {{ address?.lastname || '-' }}</td>
        </tr>
        <tr v-if="address">
          <th>Adresse</th>
          <td>{{ address?.address1 || '-' }} {{ address?.address2 || '' }}</td>
        </tr>
        <tr v-if="address">
          <th>Ville</th>
          <td>{{ address?.city || '-' }} {{ address?.postcode || '' }}</td>
        </tr>
        <tr v-if="address">
          <th>Pays</th>
          <td>{{ address?.country || '-' }}</td>
        </tr>
        <tr v-if="!address">
          <td colspan="2" style="text-align: center;">Aucune adresse de livraison</td>
        </tr>
      </table>

      <!-- Résumé du panier -->
      <h2>Résumé du panier</h2>
      <table border="1" style="margin-bottom: 20px;">
        <thead>
          <tr>
            <th>Image</th>
            <th>Produit</th>
            <th>Référence</th>
            <th>Attribut</th>
            <th>Prix unitaire</th>
            <th>Quantité</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in rowDetails" :key="idx">
            <td>
              <img
                v-if="row.imageUrl"
                :src="row.imageUrl"
                :alt="row.productName"
                width="56"
                height="56"
                style="object-fit: cover; border-radius: 8px; display: block;"
              />
            </td>
            <td>{{ row.productName }}</td>
            <td>{{ row.reference }}</td>
            <td>{{ row.groupLabel }}: {{ row.valueLabel }}</td>
            <td>{{ priceFormatter.format((row.basePrice + row.pricePlus) * (1 + row.taxRate / 100)) }} €</td>
            <td>{{ row.quantity }}</td>
            <td>{{ priceFormatter.format(((row.basePrice + row.pricePlus) * (1 + row.taxRate / 100)) * row.quantity) }} €</td>
          </tr>
        </tbody>
      </table>

      <!-- Mode de livraison et paiement -->
      <h3>Mode de livraison</h3>
      <p>{{ deliveryMethod }}</p>

      <h3>Mode de paiement</h3>
      <p>{{ paymentMethod }}</p>

      <!-- Montant total -->
      <h2 style="border-top: 2px solid #000; padding-top: 10px; margin-top: 20px;">
        Montant total: {{ priceFormatter.format(cartTotal) }} €
      </h2>

      <!-- Boutons d'action -->
      <div style="margin-top: 20px;">
        <button @click="confirmerCommande" :disabled="isConfirming" style="padding: 10px 20px; font-size: 16px; background-color: green; color: white; border: none; cursor: pointer; margin-right: 10px;">
          {{ isConfirming ? 'Création en cours...' : 'Confirmer et créer la commande' }}
        </button>
        <button @click="router.back()" style="padding: 10px 20px; font-size: 16px; background-color: gray; color: white; border: none; cursor: pointer;">
          Retour
        </button>
      </div>
    </div>
  </div>
</template>