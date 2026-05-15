<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllCustomers } from '../services/customerService.js'

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
    if (customerId == null) {
        localStorage.setItem('customerConnected', JSON.stringify({ id: null, isAnonymous: true }))
        router.push({ name: 'products' })
    } else {
        router.push({ name: 'loginCustomer', query: { customerId } })
    }
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
                    <td>Anonyme</td>  
                    <td><button @click="login(null)">Naviguer anonymement</button></td>  
                </tr>
                <tr v-for="customer in customers" :key="customer.id">
                    <td>{{ customer.lastname }}</td>  
                    <td>{{ customer.email }}</td>  
                    <td><button @click="login(customer.id)">Se Connecter</button></td>  
                </tr>
            </tbody>
            
        </table>
    </div>
</template>