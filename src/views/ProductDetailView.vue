<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRessourceItemById } from '../services/ressourcesService.js'
import { addCart, updateCart, getCartByCustomerId } from '../services/CartService.js'

const route = useRoute()
const router = useRouter()
const product = ref(null)
const loading = ref(false)
const error = ref('')
const quantity = ref(1)
const id_customer = 2 // TODO: get from auth context when implemented
const carts = ref([])

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
        carts.value = await getCartByCustomerId(id_customer)

        if (carts.value && carts.value.id) {
            localStorage.setItem('customerCart', String(carts.value.id))
        } else {
            localStorage.removeItem('customerCart')
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
    } finally {
        loading.value = false
    }
}

function backToProducts() {
    router.push({ name: 'products' })
}
async function ajouterPanier() {
    if(!product.value) {
        alert('Produit non chargé')
        return
    }
    try {
        const quantityToAdd = Math.max(1, Math.trunc(Number(quantity.value) || 1))
        const cartUser = localStorage.getItem('customerCart')
        const cartId = Number(cartUser)

        if (!cartUser || Number.isNaN(cartId) || cartId <= 0) {
            await addCart(product.value.id, quantityToAdd, id_customer)
            localStorage.removeItem('customerCart')
        }
        else
        {
            await updateCart(cartId, product.value.id, quantityToAdd)
        }
        alert('Produit ajouté au panier')
    } catch (err) {
        alert('Erreur lors de l\'ajout au panier : ' + (err instanceof Error ? err.message : String(err)))
    }
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
            <p><strong>Nom :</strong> {{ product.name?.language || product.name }}</p>
            <p><strong>Description :</strong> <span v-html="product.description_short?.language || product.description_short"></span></p>
            <p><strong>Prix :</strong> {{ product.price }}</p>
            <p><strong>État :</strong> {{ product.active }}</p>
            <label for="quantity">Quantité :</label>
            <input type="number" id="quantity" v-model.number="quantity" min="1" step="1" />
            <button @click="ajouterPanier">Ajouter au panier</button>
        </div>
    </div>
</template>