<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function disconnect()
{
    try {
        localStorage.removeItem('customerConnected')
        router.push('/')
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