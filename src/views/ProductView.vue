<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FilterProducts, getAllProducts } from '../services/productService.js'
import RechercheProduct from '../components/RechercheProduct.vue'

const idCustomer = getCustomerId()

function getCustomerId() {
    const guest = localStorage.getItem('guest')
    const customerConnected = localStorage.getItem('customerConnected')

    const sessionRaw = customerConnected || guest

    if (!sessionRaw) return 0

  try {
        const session = JSON.parse(sessionRaw)
        return Number(session?.id ?? session?.id_customer ?? 0)
  } catch (error) {
        console.error('Impossible de lire la session active:', error)
    return 0
  }
}
const produits = ref([])
const allProducts = ref([])
const loading = ref(false)
const errorMessage = ref('')
const router = useRouter()

async function fetchProduits() {
    loading.value = true
    errorMessage.value = ''

    try {
        allProducts.value = await getAllProducts()
        produits.value = allProducts.value
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
        console.error('Erreur lors de la récupération des produits :', error)
    } finally {
        loading.value = false
    }
}

async function applyFilters(filters) {
    loading.value = true
    errorMessage.value = ''

    try {
        produits.value = await FilterProducts(
            filters.name,
            filters.categorie,
            filters.minPrice,
            filters.maxPrice,
        )
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
        console.error('Erreur lors de l\'application des filtres :', error)
    } finally {
        loading.value = false
    }
}

function goToProductDetails(productId) {
    router.push({ name: 'product-detail', params: { id: productId } })
}

function resetFilters() {
    produits.value = allProducts.value
}

onMounted(() => {
    fetchProduits()
})

console.log(produits.value)
</script>

<template>
    <div>
        <p>ID : {{idCustomer}}</p>
        <h1>Produits</h1>
        <RechercheProduct @apply-filters="applyFilters" @reset-filters="resetFilters" />

        <p v-if="loading">Chargement...</p>
        <p v-else-if="errorMessage">{{ errorMessage }}</p>

        <table v-else border="1">
            <thead>
                <tr>
                    <th>Image</th>
                    <th>ID</th>
                    <th>Reference</th>
                    <th>Nom</th>
                    <th>Prix</th>
                    <th>Categorie</th>
                    <th>Marque</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="product in produits" :key="product.id">
                    <td>
                        <img
                            v-if="product.imageUrl"
                            :src="product.imageUrl"
                            :alt="product.name?.language || product.name || 'Produit'"
                            width="60"
                            height="60"
                            style="object-fit: cover; border-radius: 8px; display: block;"
                        />
                    </td>
                    <td>{{ product.id }}</td>
                    <td>{{ product.reference }}</td>
                    <td>{{ product.name.language }}</td>
                    <td>{{ (product.price * (1 + product.tax_rate / 100)).toFixed(2) }}</td>
                    <td>{{ product.categorie.language }}</td>
                    <td>{{ product.marque }}</td>
                    <td><button @click="goToProductDetails(product.id)">Détails</button></td>
                </tr>
                <tr v-if="produits.length === 0">
                    <td colspan="8" style="text-align: center;">Aucun produit</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>