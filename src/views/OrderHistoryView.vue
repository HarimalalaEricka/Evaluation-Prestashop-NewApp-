<script setup>
import { onMounted, ref } from 'vue'
import { changeOrderState, getOrderState, getOrdersByCustomerId } from '../services/commandeService.js'

const commandes = ref([])
const statesCommande = ref([])
const loading = ref(false)
const errorMessage = ref('')

function getCustomerId() {
    const customerConnected = localStorage.getItem('customerConnected')

    if (!customerConnected) return 0

    try {
        const customer = JSON.parse(customerConnected)
        return Number(customer?.id ?? 0)
    } catch (error) {
        console.error('Impossible de lire customerConnected:', error)
        return 0
    }
}

async function fetchCommandes() {
    loading.value = true
    errorMessage.value = ''

    try {
        const idCustomer = getCustomerId()
        console.log('Fetching commandes for customer ID:', idCustomer)
        commandes.value = await getOrdersByCustomerId(idCustomer)
        statesCommande.value = await getOrderState()
        console.log(commandes.value)
    } catch (err) {
        errorMessage.value = err instanceof Error ? err.message : String(err)
        console.error('Erreur lors de la récupération des commandes :', err)
    } finally {
        loading.value = false
    }
}

async function onStateChange(commande, event) {
    const newStateId = event?.target?.value

    if (!commande?.id || !newStateId) {
        return
    }

    try {
        await changeOrderState(commande.id, newStateId)
        await fetchCommandes()
    } catch (err) {
        console.error('Erreur lors du changement d’état de la commande :', err)
        errorMessage.value = err instanceof Error ? err.message : String(err)
    }
}

onMounted(() => {
    fetchCommandes()
})
</script>
<template>
    <div>
        <h1>Historique de mes commandes</h1>

        <p v-if="loading">Chargement...</p>
        <p v-else-if="errorMessage">{{ errorMessage }}</p>

        <table v-else border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Reference</th>
                    <th>Livraison</th>
                    <th>Total</th>
                    <th>Paiement</th>
                    <th>Etat</th>
                    <th>Date</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="commande in commandes" :key="commande.id">
                    <td>{{ commande.id }}</td>
                    <td>{{ commande.reference }}</td>
                    <td>{{ commande.city }}</td>
                    <td>{{ commande.total_paid }}</td>
                    <td>{{ commande.payment }}</td>
                    <td>{{ commande.current_state_label }}</td>
                    <td>{{ commande.date_add }}</td>
                    <td>
                        <select :value="commande.current_state" @change="(e) => onStateChange(commande, e)">
                            <option
                                v-for="state in statesCommande"
                                :key="state.id"
                                :value="state.id"
                            >
                                {{ state.name || state.id }}
                            </option>
                        </select>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>