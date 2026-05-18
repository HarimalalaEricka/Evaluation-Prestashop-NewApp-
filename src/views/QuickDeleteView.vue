<script setup>
import { ref } from 'vue'
import { deleteCriticalResourcesData } from '../services/ressourcesService.js'
import Disconnect from '../components/Disconnect.vue'

const isRunning = ref(false)
const result = ref(null)

async function handleQuickDelete() {
  if (!confirm(`Confirmer la suppression des données?`)) return

  isRunning.value = true
  result.value = null
  try {
    const res = await deleteCriticalResourcesData()
    result.value = res
  } catch (err) {
    result.value = { error: err instanceof Error ? err.message : String(err) }
  } finally {
    isRunning.value = false
  }
}
</script>

<template>
  <div style="padding:20px">
    <Disconnect />
    <h2>Effacement rapide des données</h2>
    <p>Ce bouton supprime les données de <strong>tax, tax_rule, tax_rules_group, categories sauf id 1 et 2, customers, addresses, orders, order_history, carts</strong>.</p>
    <button @click="handleQuickDelete" :disabled="isRunning">{{ isRunning ? 'Suppression...' : 'Effacer toutes les données' }}</button>

    <div v-if="result" style="margin-top:16px">
      <h3>Résultats</h3>
      <pre style="background:#f5f5f5;padding:8px;border-radius:4px">{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
button { padding: 8px 12px; margin-top: 8px }
</style>
