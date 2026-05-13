<script setup>
import { onMounted, ref } from 'vue'
import { getRessources } from '../services/ressourcesService.js'
import { deleteAllResourceData } from '../services/deleteService.js'

const ressources = ref([])
const selectedRessources = ref(new Set())
const isLoading = ref(true)
const errorMessage = ref('')
const allselected = ref(false)
const deletionResults = ref(null)
const isDeleting = ref(false)

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

async function DeleteSelected() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer les ressources sélectionnées ?')) {
        return
    }

    isDeleting.value = true
    const allResults = []

    try {
        for (const name of selectedRessources.value) {
            try {
                const result = await deleteAllResourceData(name)
                allResults.push(result)
                console.log(`Ressource supprimée : ${name}`, result)
            } catch (error) {
                allResults.push({
                    resource: name,
                    deleted: [],
                    errors: [{
                        message: error instanceof Error ? error.message : 'Erreur inconnue'
                    }],
                    deletedCount: 0,
                    errorCount: 1,
                    totalCount: 0
                })
            }
        }

        deletionResults.value = {
            resources: allResults,
            totalDeleted: allResults.reduce((sum, r) => sum + r.deletedCount, 0),
            totalErrors: allResults.reduce((sum, r) => sum + r.errorCount, 0),
        }

        selectedRessources.value = new Set()
        allselected.value = false
    } finally {
        isDeleting.value = false
    }
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
    <button @click="DeleteSelected" :disabled="selectedRessources.size === 0 || isDeleting">
        {{ isDeleting ? 'Suppression en cours...' : 'Supprimer' }}
    </button>

    <p v-if="isLoading">Chargement...</p>
    <p v-else-if="errorMessage">{{ errorMessage }}</p>

    <div v-if="deletionResults" style="margin-top: 20px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
        <h2>Rapport de suppression</h2>
        <p><strong>Total supprimés :</strong> {{ deletionResults.totalDeleted }}</p>
        <p><strong>Total erreurs :</strong> {{ deletionResults.totalErrors }}</p>

        <div v-for="result in deletionResults.resources" :key="result.resource" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <p><strong>{{ result.resource }}</strong> - Supprimés: {{ result.deletedCount }} / Erreurs: {{ result.errorCount }}</p>
            <ul v-if="result.errors.length > 0">
                <li v-for="(error, i) in result.errors" :key="i">
                    ID {{ error.id }}: {{ error.message }}
                </li>
            </ul>
        </div>
    </div>

    <ul v-else-if="!isLoading && !errorMessage">
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