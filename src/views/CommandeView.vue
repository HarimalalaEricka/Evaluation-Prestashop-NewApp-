<script setup>
import { ref, onMounted, computed } from 'vue'
import { getAllCommandes, getOrderState, changeOrderState } from '../services/commandeService.js'
import { usePagination } from '../composables/usePagination.js'

const commandes = ref([])
const allCommandes = ref([])
const statesCommande = ref([])
const loading = ref(false)
const errorMessage = ref('')
const filters = ref({ reference: '', customer: '', city: '', stateId: '' })
const commandePagination = usePagination(commandes, 10)

const visibleCommandes = computed(() => {
    const items = Array.isArray(commandePagination.paginatedItems?.value) ? commandePagination.paginatedItems.value : []
    return items.filter(Boolean)
})

async function fetchCommandes() {
    loading.value = true
    errorMessage.value = ''

    try {
        allCommandes.value = await getAllCommandes()
        commandes.value = allCommandes.value
        statesCommande.value = await getOrderState()
        commandePagination.resetPage()
        console.log(commandes.value)
        console.log(statesCommande.value)
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
        console.error('Erreur lors de la récupération des commandes :', error)
    } finally {
        loading.value = false
    }
}

function applyFilters() {
    const searchReference = String(filters.value.reference ?? '').trim().toLowerCase()
    const searchCustomer = String(filters.value.customer ?? '').trim().toLowerCase()
    const searchCity = String(filters.value.city ?? '').trim().toLowerCase()
    const searchState = String(filters.value.stateId ?? '').trim().toLowerCase()

    commandes.value = allCommandes.value.filter((commande) => {
        const reference = String(commande.reference ?? '').trim().toLowerCase()
        const customerName = String(commande.customer_name ?? '').trim().toLowerCase()
        const city = String(commande.city ?? '').trim().toLowerCase()
        const stateLabel = String(commande.current_state_label ?? '').trim().toLowerCase()
        const stateId = String(commande.current_state ?? '').trim().toLowerCase()

        const matchesReference = searchReference ? reference.includes(searchReference) : true
        const matchesCustomer = searchCustomer ? customerName.includes(searchCustomer) : true
        const matchesCity = searchCity ? city.includes(searchCity) : true
        const matchesState = searchState ? stateLabel.includes(searchState) || stateId.includes(searchState) : true

        return matchesReference && matchesCustomer && matchesCity && matchesState
    })

    commandePagination.resetPage()

    commandePagination.resetPage()
}

function resetFilters() {
    filters.value = { reference: '', customer: '', city: '', stateId: '' }
    commandes.value = allCommandes.value
    commandePagination.resetPage()
}

async function onStateChange(commande, event) {
    const newState = event.target.value
    try {
        await changeOrderState(commande.id, newState)
        // update local model
        commande.current_state = newState
        const label = statesCommande.value.find((s) => s.id === String(newState))
        commande.current_state_label = label ? label.name : String(newState)
    } catch (error) {
        console.error('Erreur lors du changement d\'état :', error)
        alert('Erreur lors du changement d\'état')
    }
}

onMounted(() => {
    fetchCommandes()
})

console.log(commandes.value)
</script>

<template>
    <div>
        <h1>Commandes</h1>

        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Référence
                <input v-model="filters.reference" type="text" />
            </label>
            <label>
                Client
                <input v-model="filters.customer" type="text" />
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
                    <th>Client</th>
                    <th>Livraison</th>
                    <th>Total</th>
                    <th>Paiement</th>
                    <th>Etat</th>
                    <th>Date</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                <tr v-for="(commande, index) in visibleCommandes" :key="commande?.id ?? ('commande-' + index)">
                    <td>{{ commande?.id ?? '' }}</td>
                    <td>{{ commande?.reference ?? '' }}</td>
                    <td>{{ commande?.customer_name ?? '' }}</td>
                    <td>{{ commande?.city ?? '' }}</td>
                    <td>{{ commande?.total_paid ?? '' }}</td>
                    <td>{{ commande?.payment ?? '' }}</td>
                    <td>{{ commande?.current_state_label ?? '' }}</td>
                    <td>{{ commande?.date_add ?? '' }}</td>
                    <td>
                        <select :value="commande?.current_state ?? ''" @change="(e) => onStateChange(commande, e)">
                            <option
                                v-for="state in statesCommande"
                                :key="state?.id ?? state"
                                :value="state?.id ?? state"
                            >
                                {{ state?.name ?? state?.id ?? state ?? '' }}
                            </option>
                        </select>
                    </td>
                </tr>
                <tr v-if="commandes.length === 0">
                    <td colspan="9" style="text-align: center;">Aucune commande</td>
                </tr>
            </tbody>
        </table>

        <div v-if="commandePagination.totalPages.value > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" :disabled="commandePagination.currentPage.value === 1" @click="commandePagination.prevPage">Précédent</button>
            <span>Page {{ commandePagination.currentPage.value }} / {{ commandePagination.totalPages.value }}</span>
            <button type="button" :disabled="commandePagination.currentPage.value === commandePagination.totalPages.value" @click="commandePagination.nextPage">Suivant</button>
        </div>
    </div>
</template>