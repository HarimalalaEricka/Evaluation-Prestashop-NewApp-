<script setup>
import { ref, onMounted } from 'vue'
import { SumOrdersGroupByDate, SumOrders, FilterSumByDate } from '../services/commandeService.js'
const commandes = ref([])
const sumOrder = ref({ total_orders: 0, total_amount: 0 })
const dateDebut = ref('')
const dateFin = ref('')

async function fetchCommandesSummary() {
    try {
        commandes.value = await SumOrdersGroupByDate()
        sumOrder.value = await SumOrders()
        console.log(sumOrder.value)
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes :', error)
    }
}

async function applyDateFilter() {
    try {
        const filteredCommandes = dateDebut.value || dateFin.value
            ? await FilterSumByDate(dateDebut.value, dateFin.value)
            : await SumOrdersGroupByDate()

        commandes.value = filteredCommandes
        sumOrder.value = filteredCommandes.reduce(
            (acc, commande) => {
                acc.total_orders += Number(commande.total_orders ?? 0)
                acc.total_amount += Number(commande.total_amount ?? 0)
                return acc
            },
            { total_orders: 0, total_amount: 0 }
        )
    } catch (error) {
        console.error('Erreur lors du filtrage des commandes :', error)
    }
}

function resetDateFilter() {
    dateDebut.value = ''
    dateFin.value = ''
    fetchCommandesSummary()
}

onMounted(() => {
    fetchCommandesSummary()
})
</script>
<template>
    <div>
        <h1>Dashboard</h1>
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
                    <th>Nombre de commandes</th>
                    <th>Montant</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="commande in commandes" :key="commande.date">
                    <td>{{ commande.date }}</td>
                    <td>{{ commande.total_orders }}</td>
                    <td>{{ commande.total_amount.toFixed(2) }}</td>
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
                    <th>Montant total des commandes:</th>
                    <td>{{ sumOrder.total_amount.toFixed(2) }}</td>
                </tr>
            </thead>
        </table>
    </div>
</template>