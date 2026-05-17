<script setup>
import { ref, onMounted } from 'vue'
import { SumDashboardWithFilters } from '../services/commandeService.js'
const commandes = ref([])
const commandesComplete = ref([])
const sumOrder = ref({ total_orders: 0, total_amount: 0 })
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
            acc.total_amount += Number(item.total_amount ?? 0)
            return acc
        },
        { total_orders: 0, total_carts: 0, total_amount: 0 }
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
                    <th>Nombre de commandes</th>
                    <th>Nombre de paniers</th>
                    <th>Montant</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="item in commandes" :key="item.date">
                    <td>{{ item.date }}</td>
                    <td>{{ item.total_orders ?? 0 }}</td>
                    <td>{{ item.total_carts ?? 0 }}</td>
                    <td>{{ (item.total_amount ?? 0).toFixed(2) }}</td>
                </tr>
            </tbody>
        </table>
        <table>
            <thead>
                <tr>
                    <th>Nombre de commande total:</th>
                    <td>{{ sumOrder.total_orders }}</td>
                </tr>
                <tr>
                    <th>Nombre de paniers total:</th>
                    <td>{{ sumOrder.total_carts ?? 0 }}</td>
                </tr>
                <tr>
                    <th>Nombre commande totale</th>
                    <td>{{ sumOrder.total_orders + sumOrder.total_carts }}</td>
                </tr> 
                <tr>
                    <th>Montant total:</th>
                    <td>{{ sumOrder.total_amount.toFixed(2) }}</td>
                </tr>
            </thead>
        </table>
    </div>
</template>