<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getSummaryStockByIdProduct, getSummaryStockByProductAndAttribute, FilterSummaryByDate } from '@/services/stockService'
import { usePagination } from '../composables/usePagination.js'

const route = useRoute()
const id_product = Number(route.query.id_product ?? route.params.id_product ?? route.params.id ?? 0)
const stockSummary = ref([])
const stockSummaryByAttribute = ref([])
const dateDebut = ref('')
const dateFin = ref('')
const stockSummaryPagination = usePagination(stockSummary, 10)
const stockSummaryAttributePagination = usePagination(stockSummaryByAttribute, 10)

const visibleStockSummary = computed(() => {
    const items = Array.isArray(stockSummaryPagination.paginatedItems?.value) ? stockSummaryPagination.paginatedItems.value : []
    return items.filter(Boolean)
})

const visibleStockAttributesSummary = computed(() => {
    const items = Array.isArray(stockSummaryAttributePagination.paginatedItems?.value) ? stockSummaryAttributePagination.paginatedItems.value : []
    return items.filter(Boolean)
})

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
        stockSummaryPagination.resetPage()
        stockSummaryAttributePagination.resetPage()
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
                <tr v-for="(row, idx) in visibleStockSummary" :key="(row?.date ?? '') + '-' + idx">
                    <td>{{ row?.date ?? '' }}</td>
                    <td>{{ row?.stock_debut ?? 0 }}</td>
                    <td>+{{ row?.entree ?? 0 }}</td>
                    <td>-{{ row?.sortie ?? 0 }}</td>
                    <td>{{ row?.stock_fin ?? 0 }}</td>
                </tr>
                <tr v-if="stockSummary.length === 0">
                    <td colspan="5" style="text-align: center;">Aucune donnée</td>
                </tr>
            </tbody>
        </table>

        <div v-if="stockSummaryPagination.totalPages > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" :disabled="stockSummaryPagination.currentPage === 1" @click="stockSummaryPagination.prevPage">Précédent</button>
            <span>Page {{ stockSummaryPagination.currentPage }} / {{ stockSummaryPagination.totalPages }}</span>
            <button type="button" :disabled="stockSummaryPagination.currentPage === stockSummaryPagination.totalPages" @click="stockSummaryPagination.nextPage">Suivant</button>
        </div>

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
                <tr v-for="(row, idx) in visibleStockAttributesSummary" :key="`${row?.date ?? ''}_${row?.id_product_attribute ?? ''}_${idx}`">
                    <td>{{ row?.date ?? '' }}</td>
                    <td>{{ row?.attributeLabel || `Produit base (${row?.id_product_attribute ?? ''})` }}</td>
                    <td>{{ row?.stock_debut ?? 0 }}</td>
                    <td>+{{ row?.entree ?? 0 }}</td>
                    <td>-{{ row?.sortie ?? 0 }}</td>
                    <td>{{ row?.stock_fin ?? 0 }}</td>
                </tr>
                <tr v-if="stockSummaryByAttribute.length === 0">
                    <td colspan="6" style="text-align: center;">Aucune donnée</td>
                </tr>
            </tbody>
        </table>

        <div v-if="stockSummaryAttributePagination.totalPages > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" :disabled="stockSummaryAttributePagination.currentPage === 1" @click="stockSummaryAttributePagination.prevPage">Précédent</button>
            <span>Page {{ stockSummaryAttributePagination.currentPage }} / {{ stockSummaryAttributePagination.totalPages }}</span>
            <button type="button" :disabled="stockSummaryAttributePagination.currentPage === stockSummaryAttributePagination.totalPages" @click="stockSummaryAttributePagination.nextPage">Suivant</button>
        </div>
    </div>
</template>