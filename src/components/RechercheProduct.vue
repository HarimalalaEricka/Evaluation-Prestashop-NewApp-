<script setup>
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
            <button type="button" @click="applyDateFilter">Filtrer</button>
            <button type="button" @click="resetDateFilter">Réinitialiser</button>
        </div>
</template>