<script setup>
import { ref, onMounted } from 'vue'
import { getAllCommandes, getOrderState, changeOrderState } from '../services/commandeService.js'

const commandes = ref([])
const statesCommande = ref([])

async function fetchCommandes() {
    try {
        commandes.value = await getAllCommandes()
        statesCommande.value = await getOrderState()
        console.log(commandes.value)
        console.log(statesCommande.value)
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes :', error)
    }
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

        <table border="1">
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
                <tr v-for="commande in commandes" :key="commande.id">
                    <td>{{ commande.id }}</td>
                    <td>{{ commande.reference }}</td>
                    <td>{{ commande.customer_name }}</td>
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