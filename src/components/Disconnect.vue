<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function disconnect()
{
    try {
        const isAdmin = localStorage.getItem('userConnected')
        const isCustomer = localStorage.getItem('customerConnected')
        
        // Supprimer les deux sessions
        localStorage.removeItem('userConnected')
        localStorage.removeItem('customerConnected')
        
        // Rediriger vers la page appropriée
        if (isAdmin) {
            router.push('/')
        } else if (isCustomer) {
            router.push('/customers')
        } else {
            router.push('/')
        }
        
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