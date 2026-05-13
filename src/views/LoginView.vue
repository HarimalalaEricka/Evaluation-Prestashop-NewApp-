<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { checkLogin } from '../services/loginService.js'

const router = useRouter()
const customerConnected = ref(null)
const email = ref('nam@gmail.com')
const password = ref('nam')

async function Connect() {
    try {
        const result = await checkLogin(email.value, password.value)
        if (result) {
            customerConnected.value = result

            // stockage dans session
            localStorage.setItem(
                'customerConnected',
                JSON.stringify(result)
            )
            //redirection
            router.push('/orders') 
        }

    } catch (error) {
        console.error('Erreur lors de la connexion :', error)
        alert('Une erreur est survenue lors de la connexion.')
    }
}
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