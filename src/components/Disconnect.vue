<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function disconnect()
{
    try {
        const isAdmin = localStorage.getItem('userConnected')
        const isCustomer = localStorage.getItem('customerConnected')
        const isGuest = localStorage.getItem('guest')

        if (isAdmin) {
            localStorage.removeItem('userConnected')
        }

        if (isCustomer) {
            localStorage.removeItem('customerConnected')
        }

        if (isGuest) {
            localStorage.removeItem('guest')
            localStorage.removeItem('guestSession')
        }

        router.push({ name: 'customers' })
        
        alert('Déconnexion réussie.')
    } catch (error) {
        console.error('Erreur lors de la déconnexion :', error)
        alert('Une erreur est survenue lors de la déconnexion.')
    }
}
</script>
<template>
    <div>
        <button @click="disconnect">Se déconnecter</button>
    </div>
</template>