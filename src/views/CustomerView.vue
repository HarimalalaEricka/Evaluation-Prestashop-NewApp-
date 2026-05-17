<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllCustomers, createAnonymeCustomer } from '../services/customerService.js'

const router = useRouter()
const customers = ref([])

async function fetchCustomers() {
    try {
        customers.value = await getAllCustomers()
        console.log(customers.value)
    } catch (error) {
        console.error('Erreur lors de la récupération des clients :', error)
    }
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
        <table border="1">
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
                <tr v-for="customer in customers" :key="customer.id">
                    <td>{{ customer.firstname }} {{ customer.lastname}}</td>  
                    <td>{{ customer.email }}</td>  
                    <td><button @click="login(customer.id)">Se Connecter</button></td>  
                </tr>
            </tbody>
            
        </table>
    </div>
</template>