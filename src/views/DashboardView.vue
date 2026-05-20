<script setup>
import { computed, ref, onMounted } from 'vue'
import { SumDashboardWithFilters } from '../services/commandeService.js'
import { usePagination } from '../composables/usePagination.js'
const commandes = ref([])
const commandesComplete = ref([])
const dashboardPagination = usePagination(commandes, 10)
const visibleCommandes = computed(() => dashboardPagination.paginatedItems.value ?? [])
const sumOrder = ref({
    total_orders: 0,
    total_carts: 0,
    total_orders_amount: 0,
    total_carts_amount: 0,
    total_amount: 0,
})
const dateDebut = ref('')
const dateFin = ref('')
const filterType = ref('all')

const filterOptions = [
    { value: 'all', label: 'Tout (Commandes + Paniers)' },
    { value: 'orders', label: 'Commandes seulement' },
    { value: 'carts', label: 'Paniers seulement' },
    { value: 'paiement_effectue', label: 'Paiement effectué' },
    { value: 'annule', label: 'Annulé' }
]

function updateSummary(data) {
    sumOrder.value = data.reduce(
        (acc, item) => {
            acc.total_orders += Number(item.total_orders ?? 0)
            acc.total_carts += Number(item.total_carts ?? 0)
            acc.total_orders_amount += Number(item.total_orders_amount ?? 0)
            acc.total_carts_amount += Number(item.total_carts_amount ?? 0)
            acc.total_amount += Number(item.total_amount ?? 0)
            return acc
        },
        { total_orders: 0, total_carts: 0, total_orders_amount: 0, total_carts_amount: 0, total_amount: 0 }
    )
}

function isWithinSelectedDates(itemDate) {
    const dateKey = String(itemDate ?? '')

    if (dateDebut.value && dateKey < dateDebut.value) {
        return false
    }

    if (dateFin.value && dateKey > dateFin.value) {
        return false
    }

    return true
}

function applyCurrentFilters() {
    const filteredCommandes = commandesComplete.value.filter((item) => isWithinSelectedDates(item.date))

    commandes.value = filteredCommandes
    dashboardPagination.resetPage()
    updateSummary(filteredCommandes)
}

async function refreshDashboard() {
    try {
        const data = await SumDashboardWithFilters(filterType.value)
        commandesComplete.value = data
        applyCurrentFilters()
        console.log('Dashboard data:', data)
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes :', error)
    }
}

function applyDateFilter() {
    applyCurrentFilters()
}

function resetDateFilter() {
    dateDebut.value = ''
    dateFin.value = ''
    applyCurrentFilters()
}

function onFilterChange() {
    refreshDashboard()
}

onMounted(() => {
    refreshDashboard()
})
</script>
<template>
    <div>
        <h1>Dashboard</h1>
        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Filtre type:
                <select v-model="filterType" @change="onFilterChange">
                    <option v-for="option in filterOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
            </label>
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
                    <th>Nombre commande</th>
                    <th>Montant commande</th>
                    <th>Nombre dans le panier</th>
                    <th>Montant panier</th>
                    <th>Nombre commande + panier</th>
                    <th>Montant total par jour</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="item in visibleCommandes" :key="item.date">
                    <td>{{ item.date }}</td>
                    <td>{{ item.total_orders ?? 0 }}</td>
                    <td>{{ (item.total_orders_amount ?? 0).toFixed(2) }}</td>
                    <td>{{ item.total_carts ?? 0 }}</td>
                    <td>{{ (item.total_carts_amount ?? 0).toFixed(2) }}</td>
                    <td>{{ (Number(item.total_orders ?? 0) + Number(item.total_carts ?? 0)) }}</td>
                    <td>{{ (item.total_amount ?? 0).toFixed(2) }}</td>
                </tr>
                <tr>
                    <th>Total</th>
                    <td>{{ sumOrder.total_orders }}</td>
                    <td>{{ sumOrder.total_orders_amount.toFixed(2) }}</td>
                    <td>{{ sumOrder.total_carts }}</td>
                    <td>{{ sumOrder.total_carts_amount.toFixed(2) }}</td>
                    <td>{{ sumOrder.total_orders + sumOrder.total_carts }}</td>
                    <td>{{ sumOrder.total_amount.toFixed(2) }}</td>
                </tr>
            </tbody>
        </table>

        <div v-if="dashboardPagination.totalPages.value > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" :disabled="dashboardPagination.currentPage.value === 1" @click="dashboardPagination.prevPage">Précédent</button>
            <span>Page {{ dashboardPagination.currentPage.value }} / {{ dashboardPagination.totalPages.value }}</span>
            <button type="button" :disabled="dashboardPagination.currentPage.value === dashboardPagination.totalPages.value" @click="dashboardPagination.nextPage">Suivant</button>
        </div>
    </div>
</template>