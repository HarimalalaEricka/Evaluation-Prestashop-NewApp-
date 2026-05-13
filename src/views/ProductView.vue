<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllProducts } from '../services/productService.js'

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

onMounted(() => {
    fetchProduits()
})

console.log(produits.value)
</script>

<template>
    <div>
        <h1>Produits</h1>

        <table border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Reference</th>
                    <th>Nom</th>
                    <th>Prix</th>
                    <th>Categorie</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="product in produits" :key="product.id">
                    <td>{{ product.id }}</td>
                    <td>{{ product.reference }}</td>
                    <td>{{ product.name.language[0] }}</td>
                    <td>{{ product.price }}</td>
                    <td>{{ product.categorie.language[0] }}</td>
                    <td><button @click="goToProductDetails(product.id)">Détails</button></td>
                </tr>
            </tbody>
        </table>
    </div>
</template>