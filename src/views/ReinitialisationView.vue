<script setup>
import { onMounted, ref } from 'vue'
import { getRessources } from '../services/ressourcesService.js'

const ressources = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    ressources.value = await getRessources()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Erreur inattendue'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div>
    <h1>Reinitialisation</h1>

    <p v-if="isLoading">Chargement...</p>
    <p v-else-if="errorMessage">{{ errorMessage }}</p>
    <ul v-else>
      <li v-for="item in ressources" :key="item.name">
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>