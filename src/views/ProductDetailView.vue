<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRessourceItemById } from '../services/ressourcesService.js'

const route = useRoute()
const router = useRouter()
const product = ref(null)
const loading = ref(false)
const error = ref('')

async function fetchProduct() {
    const productId = route.params.id

    if (!productId) {
        error.value = 'Identifiant produit manquant'
        return
    }

    loading.value = true
    error.value = ''

    try {
        product.value = await getRessourceItemById('products', productId)
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
    } finally {
        loading.value = false
    }
}

function backToProducts() {
    router.push({ name: 'products' })
}

onMounted(() => {
    fetchProduct()
})
</script>

<template>
    <div>
        <h1>Fiche produit</h1>

        <button @click="backToProducts">Retour à la liste</button>

        <p v-if="loading">Chargement...</p>
        <p v-else-if="error">{{ error }}</p>

        <div v-else-if="product">
            <p><strong>ID :</strong> {{ product.id }}</p>
            <p><strong>Référence :</strong> {{ product.reference }}</p>
            <p><strong>Nom :</strong> {{ product.name?.language?.[0] || product.name }}</p>
            <p><strong>Description :</strong> <span v-html="product.description_short?.language?.[0] || product.description_short"></span></p>
            <p><strong>Prix :</strong> {{ product.price }}</p>
            <p><strong>État :</strong> {{ product.active }}</p>
        </div>
    </div>
</template>