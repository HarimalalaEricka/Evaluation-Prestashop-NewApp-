<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAllStocks, updateStock } from '../services/stockService.js'
import { usePagination } from '../composables/usePagination.js'

const router = useRouter()
const stocks = ref([])
const allStocks = ref([])
const loading = ref(false)
const message = ref('')
const filters = ref({ search: '', id_product: '' })
const stockPagination = usePagination(stocks, 10)

const visibleStocks = computed(() => {
    const items = Array.isArray(stockPagination.paginatedItems?.value) ? stockPagination.paginatedItems.value : []
    return items.filter(Boolean)
})

async function fetchStocks() {
    loading.value = true
    try {
        allStocks.value = (await getAllStocks()).map(stock => ({
            ...stock,
            newQuantity: 0,
        }))
        stocks.value = allStocks.value
        stockPagination.resetPage()
        console.log(stocks.value)
    } catch (error) {
        console.error('Erreur lors de la récupération des stocks :', error)
        message.value = 'Erreur: ' + error.message
    } finally {
        loading.value = false
    }
}

function applyFilters() {
    const searchText = String(filters.value.search ?? '').trim().toLowerCase()
    const searchIdProduct = String(filters.value.id_product ?? '').trim().toLowerCase()

    stocks.value = allStocks.value.filter((stock) => {
        const productName = String(stock.product_name ?? '').trim().toLowerCase()
        const idProduct = String(stock.id_product ?? '').trim().toLowerCase()

        const matchesSearch = searchText ? productName.includes(searchText) || idProduct.includes(searchText) : true
        const matchesIdProduct = searchIdProduct ? idProduct.includes(searchIdProduct) : true

        return matchesSearch && matchesIdProduct
    })

    stockPagination.resetPage()
}

function resetFilters() {
    filters.value = { search: '', id_product: '' }
    stocks.value = allStocks.value
    stockPagination.resetPage()
}

async function handleUpdateStock(stock) {
    if (!stock.newQuantity) {
        message.value = 'Veuillez entrer une nouvelle quantité'
        return
    }

    loading.value = true
    try {
        await updateStock(stock)
        message.value = `Stock #${stock.id} mis à jour avec succès`
        await fetchStocks() // Rafraîchir les données
    } catch (error) {
        console.error('Erreur lors de la mise à jour du stock :', error)
        message.value = 'Erreur: ' + error.message
    } finally {
        loading.value = false
    }
}

function gotoEvolution(id_product) {
    router.push({ name: 'stockSummary', query: { id_product } })
}

onMounted(() => {
    fetchStocks()
})

</script>
<template>
    <div>
        <h1>Stock View</h1>
        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Recherche
                <input v-model="filters.search" type="text" />
            </label>
            <label>
                ID produit
                <input v-model="filters.id_product" type="text" />
            </label>
            <button type="button" @click="applyFilters">Filtrer</button>
            <button type="button" @click="resetFilters">Réinitialiser</button>
        </div>
        <div v-if="loading" style="color: blue;">Chargement...</div>
        <div v-if="message" style="padding: 10px; margin-bottom: 10px; border: 1px solid #ccc;">{{ message }}</div>
        <table border="1">
            <thead>
                <tr>
                    <th>Product ID</th>
                    <th>Article</th>
                    <th>Stock disponible</th>
                    <th>Nouvelle Quantité</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="(stock, idx) in visibleStocks" :key="(stock?.id_product ?? '') + '-' + idx">
                    <td>{{ stock?.id_product ?? '' }}</td>
                    <td>{{ stock?.product_name ?? '' }}</td>
                    <td>{{ stock?.quantity ?? 0 }}</td>
                    <td><input type="number" v-model.number="stock.newQuantity" :disabled="loading" /></td>
                    <td>
                        <button @click="handleUpdateStock(stock)" :disabled="loading">Update</button>
                        <button @click="gotoEvolution(stock?.id_product)" :disabled="loading">Évolution</button>
                    </td>
                </tr>
                <tr v-if="stocks.length === 0">
                    <td colspan="5" style="text-align: center;">Aucun stock</td>
                </tr>
            </tbody>
            
        </table>

        <div v-if="stockPagination.totalPages > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" :disabled="stockPagination.currentPage === 1" @click="stockPagination.prevPage">Précédent</button>
            <span>Page {{ stockPagination.currentPage }} / {{ stockPagination.totalPages }}</span>
            <button type="button" :disabled="stockPagination.currentPage === stockPagination.totalPages" @click="stockPagination.nextPage">Suivant</button>
        </div>
    </div>
</template>
