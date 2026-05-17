<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllProducts } from '../services/productService.js'
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
const router = useRouter()

async function fetchProduits() {
    try {
        produits.value = await getAllProducts()
        console.log(produits.value)
    } catch (error) {
        console.error('Erreur lors de la récupération des produits :', error)
    }
}

function goToProductDetails(productId) {
    router.push({ name: 'product-detail', params: { id: productId } })
}

function updateProductsList(newProducts) {
    produits.value = newProducts
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
        <RechercheProduct @update-products="updateProductsList" />

        <table border="1">
            <thead>
                <tr>
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
                    <td>{{ product.id }}</td>
                    <td>{{ product.reference }}</td>
                    <td>{{ product.name.language }}</td>
                    <td>{{ (product.price * (1 + product.tax_rate / 100)).toFixed(2) }}</td>
                    <td>{{ product.categorie.language }}</td>
                    <td>{{ product.marque }}</td>
                    <td><button @click="goToProductDetails(product.id)">Détails</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</template>