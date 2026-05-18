<script setup>
import { ref } from 'vue'

const emit = defineEmits(['apply-filters', 'reset-filters'])

const nomProduit = ref('')
const referenceProduit = ref('')
const categorieProduit = ref('')
const minPrix = ref(null)
const maxPrix = ref(null)

function applyFilters() {
    emit('apply-filters', {
        name: nomProduit.value,
        reference: referenceProduit.value,
        categorie: categorieProduit.value,
        minPrice: minPrix.value,
        maxPrice: maxPrix.value,
    })
}

function resetFilters() {
    nomProduit.value = ''
    referenceProduit.value = ''
    categorieProduit.value = ''
    minPrix.value = null
    maxPrix.value = null
    emit('reset-filters')
}
</script>
<template>
    <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Nom du produit:
                <input type="text" v-model="nomProduit" />
            </label>
            <label>
                Référence:
                <input type="text" v-model="referenceProduit" />
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