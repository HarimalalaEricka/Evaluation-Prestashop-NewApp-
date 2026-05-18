<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllCustomers, createAnonymeCustomer } from '../services/customerService.js'
import { usePagination } from '../composables/usePagination.js'

const router = useRouter()
const customers = ref([])
const loading = ref(false)
const errorMessage = ref('')
const filters = ref({ search: '', email: '' })
const allCustomers = ref([])
const customerPagination = usePagination(customers, 10)
const visibleCustomers = computed(() => (customerPagination.paginatedItems.value ?? []).filter((customer) => customer && typeof customer === 'object'))

async function fetchCustomers() {
    loading.value = true
    errorMessage.value = ''

    try {
        allCustomers.value = await getAllCustomers()
        customers.value = allCustomers.value
        customerPagination.resetPage()
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
        console.error('Erreur lors de la récupération des clients :', error)
    } finally {
        loading.value = false
    }
}

function applyFilters() {
    const searchText = String(filters.value.search ?? '').trim().toLowerCase()
    const searchEmail = String(filters.value.email ?? '').trim().toLowerCase()

    customers.value = allCustomers.value.filter((customer) => {
        const fullName = `${customer.firstname ?? ''} ${customer.lastname ?? ''}`.trim().toLowerCase()
        const email = String(customer.email ?? '').trim().toLowerCase()

        const matchesSearch = searchText ? fullName.includes(searchText) || email.includes(searchText) : true
        const matchesEmail = searchEmail ? email.includes(searchEmail) : true

        return matchesSearch && matchesEmail
    })

    customerPagination.resetPage()
}

function resetFilters() {
    filters.value = { search: '', email: '' }
    customers.value = allCustomers.value
    customerPagination.resetPage()
}

function login(customerId)
{
    router.push({ name: 'loginCustomer', query: { customerId } })
}

async function anonyme()
{
    const guest = await createAnonymeCustomer()
    console.log('Anonyme guest created:', guest)
    const guestSession = {
        sessionType: 'guest',
        guestId: Number(guest?.id ?? guest?.id_guest ?? 0),
        customerId: Number(guest?.id_customer ?? 0),
        ...guest,
    }
    localStorage.removeItem('customerConnected')
    localStorage.setItem('guest', JSON.stringify(guestSession))
    console.log('[CustomerView] session active = guest', guestSession)
    router.push({ name: 'products' })
}

onMounted(() => {
    fetchCustomers()
})
</script>
<template>
    <div>
        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: end; flex-wrap: wrap;">
            <label>
                Nom ou e-mail
                <input v-model="filters.search" type="text" />
            </label>
            <label>
                E-mail
                <input v-model="filters.email" type="text" />
            </label>
            <button type="button" @click="applyFilters">Filtrer</button>
            <button type="button" @click="resetFilters">Réinitialiser</button>
        </div>

        <p v-if="loading">Chargement...</p>
        <p v-else-if="errorMessage">{{ errorMessage }}</p>

        <table v-else border="1">
            <thead>
                <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                <tr>
                    <td>Anonyme</td>
                    <td>-</td>
                    <td><button @click="anonyme">Naviguer en tant qu'anonyme</button></td>
                </tr>
                <tr v-for="customer in visibleCustomers" :key="customer.id ?? customer.email ?? `${customer.firstname}-${customer.lastname}`">
                    <td>{{ customer.firstname ?? '' }} {{ customer.lastname ?? '' }}</td>
                    <td>{{ customer.email ?? '' }}</td>
                    <td><button @click="login(customer.id)">Se Connecter</button></td>
                </tr>
                <tr v-if="customers.length === 0">
                    <td colspan="3" style="text-align: center;">Aucun client</td>
                </tr>
            </tbody>
            
        </table>

        <div v-if="customerPagination.totalPages > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" :disabled="customerPagination.currentPage === 1" @click="customerPagination.prevPage">Précédent</button>
            <span>Page {{ customerPagination.currentPage }} / {{ customerPagination.totalPages }}</span>
            <button type="button" :disabled="customerPagination.currentPage === customerPagination.totalPages" @click="customerPagination.nextPage">Suivant</button>
        </div>
    </div>
</template>