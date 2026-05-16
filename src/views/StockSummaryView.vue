<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getSummaryStockByIdProduct, FilterSummaryByDate } from '@/services/stockService'

const route = useRoute()
const id_product = Number(route.query.id_product ?? route.params.id_product ?? route.params.id ?? 0)
const stockSummary = ref([])
const dateDebut = ref('')
const dateFin = ref('')

onMounted(async () => {
    console.log('StockSummaryView mounted with id_product:', id_product)
    await fetchStockSummary()
})

async function fetchStockSummary() {
    try {
        stockSummary.value = await getSummaryStockByIdProduct(id_product)
        console.log(stockSummary.value)
    } catch (error) {
        console.error('Erreur lors de la récupération du résumé des stocks :', error)
    }
}

async function applyDateFilter() {
    try {
        const filteredStocks = dateDebut.value || dateFin.value
            ? await FilterSummaryByDate(dateDebut.value, dateFin.value, id_product)
            : await getSummaryStockByIdProduct(id_product)

        stockSummary.value = filteredStocks
    } catch (error) {
        console.error('Erreur lors du filtrage des stocks par date :', error)
    }
}

function resetDateFilter() {
    dateDebut.value = ''
    dateFin.value = ''
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
    </div>
</template>