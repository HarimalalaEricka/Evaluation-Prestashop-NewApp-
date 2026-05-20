<script setup>
import { ref, onMounted, computed } from 'vue'
import { getBeneficeByCategorie, getMontantVenteHt, getMontantAchatHt } from '../services/stateService.js'
import { getRessourceItemById } from '../services/ressourcesService.js'

const loading = ref(true)
const error = ref(null)
const beneficeData = ref({})
const venteData = ref({})
const achatData = ref({})
const categories = ref({})

const sortBy = ref('benefice') // 'benefice', 'vente', 'achat', 'categorie'
const sortOrder = ref('desc') // 'asc', 'desc'

const tableData = computed(() => {
    const data = Object.entries(beneficeData.value).map(([categoryId, benefice]) => ({
        categoryId,
        categoryName: categories.value[categoryId] || `Catégorie ${categoryId}`,
        vente: venteData.value[categoryId] || 0,
        achat: achatData.value[categoryId] || 0,
        benefice,
    }))

    // Tri
    data.sort((a, b) => {
        let compareA = 0
        let compareB = 0

        switch (sortBy.value) {
            case 'benefice':
                compareA = a.benefice
                compareB = b.benefice
                break
            case 'vente':
                compareA = a.vente
                compareB = b.vente
                break
            case 'achat':
                compareA = a.achat
                compareB = b.achat
                break
            case 'categorie':
                compareA = a.categoryName.localeCompare(b.categoryName)
                compareB = 0
                break
        }

        return sortOrder.value === 'asc' ? compareA - compareB : compareB - compareA
    })

    return data
})

const totals = computed(() => {
    return tableData.value.reduce(
        (acc, row) => ({
            vente: acc.vente + row.vente,
            achat: acc.achat + row.achat,
            benefice: acc.benefice + row.benefice,
        }),
        { vente: 0, achat: 0, benefice: 0 }
    )
})

async function loadData() {
    loading.value = true
    error.value = null
    try {
        // Charger les données
        const benefice = await getBeneficeByCategorie()
        const vente = await getMontantVenteHt()
        const achat = await getMontantAchatHt()

        beneficeData.value = benefice
        venteData.value = vente
        console.log('Données de vente par catégorie:', vente)
        achatData.value = achat
        console.log('Donnees achar', achat)

        // Charger les noms des catégories
        const allCategoryIds = Object.keys(benefice)
        for (const categoryId of allCategoryIds) {
            try {
                if (categoryId !== 'undefined') {
                    const category = await getRessourceItemById('categories', categoryId)
                    categories.value[categoryId] = category.name || `Catégorie ${categoryId}`
                } else {
                    categories.value[categoryId] = 'Sans catégorie'
                }
            } catch (err) {
                console.warn(`[BeneficeByCategorieView] Erreur lors du chargement de la catégorie ${categoryId}:`, err.message)
                categories.value[categoryId] = `Catégorie ${categoryId}`
            }
        }
    } catch (err) {
        error.value = err.message || 'Erreur lors du chargement des données'
        console.error('[BeneficeByCategorieView] Erreur:', err)
    } finally {
        loading.value = false
    }
}

function toggleSort(column) {
    if (sortBy.value === column) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
        sortBy.value = column
        sortOrder.value = 'desc'
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(value)
}

function getBeneficeClass(benefice) {
    if (benefice > 0) return 'text-success'
    if (benefice < 0) return 'text-danger'
    return 'text-muted'
}

onMounted(() => {
    loadData()
})
</script>

<template>
    <div class="container-fluid mt-4">
        <div class="row mb-4">
            <div class="col-md-12">
                <h1>Bénéfice par Catégorie</h1>
            </div>
        </div>

        <!-- Erreur -->
        <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
            {{ error }}
            <button type="button" class="btn-close" @click="error = null"></button>
        </div>

        <!-- Chargement -->
        <div v-if="loading" class="text-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Chargement...</span>
            </div>
        </div>

        <!-- Tableau -->
        <div v-if="!loading && tableData.length > 0" class="card">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th style="cursor: pointer" @click="toggleSort('categorie')">
                                    Catégorie
                                    <span v-if="sortBy === 'categorie'" class="ms-2">
                                        <i :class="sortOrder === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down'"></i>
                                    </span>
                                </th>
                                <th class="text-end" style="cursor: pointer" @click="toggleSort('vente')">
                                    Vente HT
                                    <span v-if="sortBy === 'vente'" class="ms-2">
                                        <i :class="sortOrder === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down'"></i>
                                    </span>
                                </th>
                                <th class="text-end" style="cursor: pointer" @click="toggleSort('achat')">
                                    Achat HT
                                    <span v-if="sortBy === 'achat'" class="ms-2">
                                        <i :class="sortOrder === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down'"></i>
                                    </span>
                                </th>
                                <th class="text-end" style="cursor: pointer" @click="toggleSort('benefice')">
                                    Bénéfice
                                    <span v-if="sortBy === 'benefice'" class="ms-2">
                                        <i :class="sortOrder === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down'"></i>
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in tableData" :key="row.categoryId">
                                <td>{{ row.categoryName }}</td>
                                <td class="text-end">{{ formatCurrency(row.vente) }}</td>
                                <td class="text-end">{{ formatCurrency(row.achat) }}</td>
                                <td class="text-end" :class="getBeneficeClass(row.benefice)">
                                    <strong>{{ formatCurrency(row.benefice) }}</strong>
                                </td>
                            </tr>
                        </tbody>
                        <tfoot class="table-light fw-bold">
                            <tr>
                                <td>TOTAL</td>
                                <td class="text-end">{{ formatCurrency(totals.vente) }}</td>
                                <td class="text-end">{{ formatCurrency(totals.achat) }}</td>
                                <td class="text-end" :class="getBeneficeClass(totals.benefice)">
                                    {{ formatCurrency(totals.benefice) }}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>

        <!-- Aucune donnée -->
        <div v-if="!loading && tableData.length === 0" class="alert alert-info">
            Aucune donnée disponible
        </div>

        <!-- Bouton Actualiser -->
        <div v-if="!loading" class="mt-3">
            <button @click="loadData" class="btn btn-primary">
                <i class="bi bi-arrow-clockwise"></i> Actualiser
            </button>
        </div>
    </div>
</template>

<style scoped>
table {
    font-size: 0.95rem;
}

thead th {
    border-bottom: 2px solid #dee2e6;
}

tfoot td {
    border-top: 2px solid #dee2e6;
    background-color: #f8f9fa;
}

.table-hover tbody tr:hover {
    background-color: #f8f9fa;
}

.text-success {
    color: #28a745 !important;
}

.text-danger {
    color: #dc3545 !important;
}

.text-muted {
    color: #6c757d !important;
}
</style>
