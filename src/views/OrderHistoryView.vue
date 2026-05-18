<script setup>
import { onMounted, ref } from 'vue'
import { changeOrderState, getOrderState, getOrdersByCustomerId } from '../services/commandeService.js'

const commandes = ref([])
const allCommandes = ref([])
const statesCommande = ref([])
const loading = ref(false)
const errorMessage = ref('')
const filters = ref({ reference: '', city: '', stateId: '' })

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
        allCommandes.value = await getOrdersByCustomerId(idCustomer)
        commandes.value = allCommandes.value
        statesCommande.value = await getOrderState()
        console.log(commandes.value)
    } catch (err) {
        errorMessage.value = err instanceof Error ? err.message : String(err)
        console.error('Erreur lors de la récupération des commandes :', err)
    } finally {
        loading.value = false
    }
}

function applyFilters() {
    const searchReference = String(filters.value.reference ?? '').trim().toLowerCase()
    const searchCity = String(filters.value.city ?? '').trim().toLowerCase()
    const searchState = String(filters.value.stateId ?? '').trim().toLowerCase()

    commandes.value = allCommandes.value.filter((commande) => {
        const reference = String(commande.reference ?? '').trim().toLowerCase()
        const city = String(commande.city ?? '').trim().toLowerCase()
        const stateLabel = String(commande.current_state_label ?? '').trim().toLowerCase()
        const stateId = String(commande.current_state ?? '').trim().toLowerCase()

        const matchesReference = searchReference ? reference.includes(searchReference) : true
        const matchesCity = searchCity ? city.includes(searchCity) : true
        const matchesState = searchState ? stateLabel.includes(searchState) || stateId.includes(searchState) : true

        return matchesReference && matchesCity && matchesState
    })
}

function resetFilters() {
    filters.value = { reference: '', city: '', stateId: '' }
    commandes.value = allCommandes.value
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

        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Référence
                <input v-model="filters.reference" type="text" />
            </label>
            <label>
                Ville
                <input v-model="filters.city" type="text" />
            </label>
            <label>
                État
                <select v-model="filters.stateId">
                    <option value="">Tous</option>
                    <option v-for="state in statesCommande" :key="state.id" :value="state.id">
                        {{ state.name || state.id }}
                    </option>
                </select>
            </label>
            <button type="button" @click="applyFilters">Filtrer</button>
            <button type="button" @click="resetFilters">Réinitialiser</button>
        </div>

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