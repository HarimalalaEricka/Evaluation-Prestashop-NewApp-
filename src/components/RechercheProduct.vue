<script setup>
import { ref } from 'vue'
import { FilterProducts, getAllProducts } from '../services/productService.js'

const emit = defineEmits(['update-products'])

const nomProduit = ref('')
const categorieProduit = ref('')
const minPrix = ref(null)
const maxPrix = ref(null)

async function applyFilters()
{
    try {
        const filteredProducts = await FilterProducts(nomProduit.value, categorieProduit.value, minPrix.value, maxPrix.value)
        emit('update-products', filteredProducts)
    } catch (error) {
        console.error('Erreur lors de l\'application des filtres :', error)
        alert('Une erreur est survenue lors de l\'application des filtres.')
    }
}
async function resetFilters()
{
    nomProduit.value = ''
    categorieProduit.value = ''
    minPrix.value = null
    maxPrix.value = null
    const allProducts = await getAllProducts()
    emit('update-products', allProducts)
}
</script>
<template>
    <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Nom du produit:
                <input type="text" v-model="nomProduit" />
            </label>
            <label>
                Catégorie:
                <input type="text" v-model="categorieProduit" />
            </label>
            <label>
                Min prix:
                <input type="number" v-model.number="minPrix" min="0" step="0.01" />
            </label>
            <label>
                Max prix:
                <input type="number" v-model.number="maxPrix" min="0" step="0.01" />
            </label>
            <button type="button" @click="applyFilters">Filtrer</button>
            <button type="button" @click="resetFilters">Réinitialiser</button>
        </div>
</template>