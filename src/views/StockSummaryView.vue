<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getSummaryStockByIdProduct, getSummaryStockByProductAndAttribute, FilterSummaryByDate } from '@/services/stockService'

const route = useRoute()
const id_product = Number(route.query.id_product ?? route.params.id_product ?? route.params.id ?? 0)
const stockSummary = ref([])
const stockSummaryByAttribute = ref([])
const dateDebut = ref('')
const dateFin = ref('')

onMounted(async () => {
    console.log('StockSummaryView mounted with id_product:', id_product)
    await fetchStockSummary()
})

async function fetchStockSummary() {
    try {
        stockSummary.value = dateDebut.value || dateFin.value
            ? await FilterSummaryByDate(dateDebut.value, dateFin.value, id_product)
            : await getSummaryStockByIdProduct(id_product)

        stockSummaryByAttribute.value = await getSummaryStockByProductAndAttribute(id_product)
        console.log('By product:', stockSummary.value)
        console.log('By attribute:', stockSummaryByAttribute.value)
    } catch (error) {
        console.error('Erreur lors de la récupération du résumé des stocks :', error)
    }
}

async function applyDateFilter() {
    await fetchStockSummary()
}

function resetDateFilter() {
    dateDebut.value = ''
    dateFin.value = ''
    fetchStockSummary()
}

</script>
<template>
    <div>
        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Date début
                <input v-model="dateDebut" type="date" />
            </label>
            <label>
                Date fin
                <input v-model="dateFin" type="date" />
            </label>
            <button type="button" @click="applyDateFilter">Filtrer</button>
            <button type="button" @click="resetDateFilter">Réinitialiser</button>
        </div>
        <table border="1">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Stock Debut</th>
                    <th>Entree</th>
                    <th>Sortie</th>
                    <th>Stock Fin</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="row in stockSummary" :key="row.date">
                    <td>{{ row.date }}</td>
                    <td>{{ row.stock_debut }}</td>
                    <td>+{{ row.entree }}</td>
                    <td>-{{ row.sortie }}</td>
                    <td>{{ row.stock_fin }}</td>
                </tr>
                <tr v-if="stockSummary.length === 0">
                    <td colspan="5" style="text-align: center;">Aucune donnée</td>
                </tr>
            </tbody>
        </table>

        <h3 style="margin-top: 32px;">Mouvements par Déclinaison</h3>
        <table border="1">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Déclinaison</th>
                    <th>Stock Debut</th>
                    <th>Entree</th>
                    <th>Sortie</th>
                    <th>Stock Fin</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="row in stockSummaryByAttribute" :key="`${row.date}_${row.id_product_attribute}`">
                    <td>{{ row.date }}</td>
                    <td>{{ row.attributeLabel || `Produit base (${row.id_product_attribute})` }}</td>
                    <td>{{ row.stock_debut }}</td>
                    <td>+{{ row.entree }}</td>
                    <td>-{{ row.sortie }}</td>
                    <td>{{ row.stock_fin }}</td>
                </tr>
                <tr v-if="stockSummaryByAttribute.length === 0">
                    <td colspan="6" style="text-align: center;">Aucune donnée</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>