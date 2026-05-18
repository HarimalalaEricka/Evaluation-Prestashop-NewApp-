<template>
  <div class="file-import-container">
    <h1>Import Fichiers</h1>
    
    <div class="import-form">
      <!-- File Upload 1 -->
      <div class="file-upload-group">
        <label for="file1">Products:</label>
        <input
          id="file1"
          type="file"
          @change="(e) => updateFile(e, 'file1')"
          class="file-input"
        />
        <span v-if="files.file1" class="file-name">{{ files.file1.name }}</span>
      </div>

      <!-- File Upload 2 -->
      <div class="file-upload-group">
        <label for="file2">Combinations:</label>
        <input
          id="file2"
          type="file"
          @change="(e) => updateFile(e, 'file2')"
          class="file-input"
        />
        <span v-if="files.file2" class="file-name">{{ files.file2.name }}</span>
      </div>

      <!-- File Upload 3 -->
      <div class="file-upload-group">
        <label for="file3">Orders:</label>
        <input
          id="file3"
          type="file"
          @change="(e) => updateFile(e, 'file3')"
          class="file-input"
        />
        <span v-if="files.file3" class="file-name">{{ files.file3.name }}</span>
      </div>

      <!-- File Upload 4 -->
      <div class="file-upload-group">
        <label for="file4">Images:</label>
        <input
          id="file4"
          type="file"
          @change="(e) => updateFile(e, 'file4')"
          class="file-input"
        />
        <span v-if="files.file4" class="file-name">{{ files.file4.name }}</span>
      </div>

      <!-- Import Button -->
      <div class="button-group">
        <button
          @click="importFiles"
          :disabled="!hasFiles || isLoading"
          class="import-button"
        >
          {{ isLoading ? 'Importation en cours...' : 'Importer' }}
        </button>
      </div>

      <!-- Message de statut -->
      <div v-if="message" :class="['message', messageType]">
        <pre>{{ message }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { parseFile, processFile1, validateFileData } from '../services/fileImportService.js'

const files = ref({
  file1: null,
  file2: null,
  file3: null,
  file4: null
})

const isLoading = ref(false)
const message = ref('')
const messageType = ref('') // 'success', 'error', 'info'
const importResults = ref(null)

const hasFiles = computed(() => {
  return Object.values(files.value).some(file => file !== null)
})

function updateFile(event, fileKey) {
  const file = event.target.files[0]
  if (file) {
    files.value[fileKey] = file
  }
}

async function importFiles() {
  isLoading.value = true
  message.value = ''
  importResults.value = null

  try {
    const results = {
      success: [],
      errors: []
    }

    // Traiter le fichier 1 (Produits)
    if (files.value.file1) {
      try {
        console.log('[FileImportView] Traitement du fichier 1 (Produits)')
        const parsedData = await parseFile(files.value.file1)
        const validation = validateFileData(parsedData)
        
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '))
        }

        console.log('[FileImportView] Validation OK, lancement de l\'import')
        const file1Results = await processFile1(parsedData)
        results.success.push(file1Results)
        
        message.value += `✅ Fichier 1 (Produits): ${file1Results.results.success.length}/${file1Results.results.total} produits importés\n`
        if (file1Results.results.errors.length > 0) {
          message.value += `❌ Erreurs: ${file1Results.results.errors.length}\n`
        }
      } catch (error) {
        console.error('[FileImportView] Erreur fichier 1:', error)
        results.errors.push({
          file: 'file1',
          error: error.message
        })
        message.value += `❌ Fichier 1 (Produits): ${error.message}\n`
      }
    }

    // Traiter le fichier 2 (Combinaisons) - À implémenter
    if (files.value.file2) {
      message.value += `⏳ Fichier 2 (Combinaisons): À implémenter\n`
    }

    // Traiter le fichier 3 (Commandes) - À implémenter
    if (files.value.file3) {
      message.value += `⏳ Fichier 3 (Commandes): À implémenter\n`
    }

    // Traiter le fichier 4 (Images) - À implémenter
    if (files.value.file4) {
      message.value += `⏳ Fichier 4 (Images): À implémenter\n`
    }

    importResults.value = results

    if (results.errors.length === 0) {
      messageType.value = 'success'
      if (message.value.trim() === '') {
        message.value = 'Tous les fichiers ont été importés avec succès!'
      }
    } else {
      messageType.value = 'error'
      message.value = `Import terminé avec erreurs:\n${message.value}`
    }

    // Réinitialiser les fichiers après 3 secondes
    setTimeout(() => {
      if (results.errors.length === 0) {
        resetFiles()
      }
    }, 3000)
  } catch (error) {
    console.error('[FileImportView] Erreur globale:', error)
    message.value = `Erreur critique: ${error.message}`
    messageType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

function resetFiles() {
  files.value = {
    file1: null,
    file2: null,
    file3: null,
    file4: null
  }
  message.value = ''
  importResults.value = null
  // Réinitialiser les inputs
  document.querySelectorAll('.file-input').forEach(input => {
    input.value = ''
  })
}
</script>

<style scoped>
.file-import-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #333;
  margin-bottom: 30px;
  text-align: center;
}

.import-form {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 30px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.file-upload-group {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
}

label {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  display: block;
}

.file-input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background-color: #fff;
  transition: border-color 0.3s;
}

.file-input:hover {
  border-color: #007bff;
}

.file-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
}

.file-name {
  color: #28a745;
  font-size: 0.9em;
  margin-top: 5px;
  font-style: italic;
}

.button-group {
  margin-top: 30px;
  text-align: center;
}

.import-button {
  background-color: #007bff;
  color: white;
  padding: 12px 40px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  font-weight: 600;
  transition: background-color 0.3s;
}

.import-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.import-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.message {
  margin-top: 20px;
  padding: 12px;
  border-radius: 4px;
  text-align: left;
  font-weight: 500;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message pre {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}
</style>
