<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { checkLoginCustomer } from '../services/loginService.js'
import { getRessourceItemById } from '../services/ressourcesService.js'

const router = useRouter()
const route = useRoute()
const id_userSelected = route.params.customerId ?? route.query.customerId ?? null
console.log('ID client sélectionné :', id_userSelected, '(source: params or query)')
const userSelected = ref(null)
const customerConnected = ref(null)
const email = ref('')
const password = ref('')

async function fetchUserSelected() {
    try {
        userSelected.value = await getRessourceItemById('customers', id_userSelected)
        email.value = userSelected.value.email
        password.value = userSelected.value.passwd
    } catch (error) {
        console.error('Erreur lors de la récupération du client :', error)
    }
}

async function Connect() {
    try {
        const result = await checkLoginCustomer(email.value, password.value)
        if (result) {
            customerConnected.value = result

            // stockage dans session
            localStorage.setItem(
                'customerConnected',
                JSON.stringify(result)
            )
            //redirection
            router.push('/products') 
        }

    } catch (error) {
        console.error('Erreur lors de la connexion :', error)
        alert('Une erreur est survenue lors de la connexion.')
    }
}

onMounted(() => {
    if (id_userSelected) {
        fetchUserSelected()
    }
})
</script>
<template>
    <div>
        <h1>Login</h1>
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="email" required />
        <label for="pwd">Password:</label>
        <input type="password" id="pwd" v-model="password" required />
        <button @click="Connect">Se connecter</button>
    </div>
</template>
<style lang="">

</style>