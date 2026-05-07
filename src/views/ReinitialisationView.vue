<script setup>
import { onMounted, ref } from 'vue'
import { getRessources } from '../services/ressourcesService.js'

const ressources = ref([])
const selectedRessources = ref(new Set())
const isLoading = ref(true)
const errorMessage = ref('')
const allselected = ref(false)

function toggleRessource(name) {
  const nextSelection = new Set(selectedRessources.value)

  if (nextSelection.has(name)) {
    nextSelection.delete(name)
  } else {
    nextSelection.add(name)
  }

  selectedRessources.value = nextSelection
}

function SelectAll() {
  if (allselected.value) {
    selectedRessources.value = new Set()
  } else {
    selectedRessources.value = new Set(ressources.value.map(item => item.name))
  }
  allselected.value = !allselected.value
}

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
    <button @click="SelectAll">
        <p v-if="allselected">Tout désélectionner</p>
        <p v-else>Tout sélectionner</p>
    </button>
    <button @click="DeleteSelected" :disabled="selectedRessources.size === 0">Supprimer</button>
    <p v-if="isLoading">Chargement...</p>
    <p v-else-if="errorMessage">{{ errorMessage }}</p>
    <ul v-else>
      <li v-for="item in ressources" :key="item.name">
        <label>
          <input
            :checked="selectedRessources.has(item.name)"
            type="checkbox"
            @change="toggleRessource(item.name)"
          />
          {{ item.name }}
        </label>
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>