<script setup>
import { computed, onMounted, ref } from 'vue'
import { getBeneficeByCategorie, getQuantityByCategory } from '../services/stateService.js'
import { usePagination } from '../composables/usePagination.js'

const loading = ref(true)
const error = ref('')
const beneficeByCategorie = ref({})
const quantityByCategory = ref({})

const rows = computed(() => {
    return Object.entries(beneficeByCategorie.value).map(([categorie, values]) => ({
        categorie,
        vente: Number(values?.vente ?? 0),
        achat: Number(values?.achat ?? 0),
        benefice: Number(values?.benefice ?? 0),
    }))
})

const beneficePagination = usePagination(rows, 10)
const visibleRows = computed(() => beneficePagination.paginatedItems.value ?? [])

const quantityRows = computed(() => {
    return Object.entries(quantityByCategory.value || {}).map(([categorie, values]) => ({
        categorie,
        physique: Number(values?.physique ?? 0),
        reserved: Number(values?.reserved ?? 0),
        dispo: Number(values?.dispo ?? 0),
    }))
})

const quantityPagination = usePagination(quantityRows, 10)
const visibleQuantityRows = computed(() => quantityPagination.paginatedItems.value ?? [])

const totals = computed(() => {
    return rows.value.reduce((accumulator, row) => {
        accumulator.vente += row.vente
        accumulator.achat += row.achat
        accumulator.benefice += row.benefice
        return accumulator
    }, { vente: 0, achat: 0, benefice: 0 })
})

function formatCurrency(value) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(Number(value ?? 0))
}

function formatNumber(value) {
    return new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))
}

onMounted(async () => {
    try {
        beneficeByCategorie.value = await getBeneficeByCategorie()
        quantityByCategory.value = await getQuantityByCategory()
        beneficePagination.resetPage()
        quantityPagination.resetPage()
        // console.log('Bénéfice par catégorie :', beneficeByCategorie.value)
        console.log('Quantité par catégorie :', quantityByCategory.value)
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
        console.error('Erreur lors de la récupération du bénéfice par catégorie :', err)
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <div style="padding: 20px; max-width: 1200px; margin: 0 auto;">
        <h1 style="margin-bottom: 16px;">Bénéfice par catégorie</h1>

        <div v-if="loading" style="padding: 16px;">Chargement...</div>

        <div v-else-if="error" style="padding: 16px; color: #b00020; background: #fdecea; border-radius: 6px;">
            {{ error }}
        </div>

        <div v-else>
            <div style="overflow-x: auto; border: 1px solid #ddd; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; background: #fff;">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #ddd;">Catégorie</th>
                            <th style="text-align: right; padding: 12px; border-bottom: 1px solid #ddd;">Vente HT</th>
                            <th style="text-align: right; padding: 12px; border-bottom: 1px solid #ddd;">Achat HT</th>
                            <th style="text-align: right; padding: 12px; border-bottom: 1px solid #ddd;">Bénéfice</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in visibleRows" :key="row.categorie">
                            <td style="padding: 12px; border-bottom: 1px solid #eee;">{{ row.categorie }}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">{{ formatCurrency(row.vente) }}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">{{ formatCurrency(row.achat) }}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; font-weight: 600;">
                                {{ formatCurrency(row.benefice) }}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot style="background: #f1f3f5; font-weight: 700;">
                        <tr>
                            <td style="padding: 12px; border-top: 2px solid #ddd;">TOTAL</td>
                            <td style="padding: 12px; text-align: right; border-top: 2px solid #ddd;">{{ formatCurrency(totals.vente) }}</td>
                            <td style="padding: 12px; text-align: right; border-top: 2px solid #ddd;">{{ formatCurrency(totals.achat) }}</td>
                            <td style="padding: 12px; text-align: right; border-top: 2px solid #ddd;">{{ formatCurrency(totals.benefice) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div v-if="beneficePagination.totalPages.value > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button type="button" :disabled="beneficePagination.currentPage.value === 1" @click="beneficePagination.prevPage">Précédent</button>
                <span>Page {{ beneficePagination.currentPage.value }} / {{ beneficePagination.totalPages.value }}</span>
                <button type="button" :disabled="beneficePagination.currentPage.value === beneficePagination.totalPages.value" @click="beneficePagination.nextPage">Suivant</button>
            </div>
        </div>
        
        <div style="margin-top: 24px;">
            <hr style="border: none; height: 1px; background: #e9ecef; margin: 16px 0;" />
            <h2 style="margin-bottom: 12px;">Quantité par catégorie</h2>

            <div v-if="!quantityByCategory || Object.keys(quantityByCategory).length === 0" style="padding: 12px; color: #6c757d;">Aucune donnée de stock</div>

            <div v-else style="overflow-x: auto; border: 1px solid #ddd; border-radius: 8px; background: #fff;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #ddd;">Catégorie</th>
                            <th style="text-align: right; padding: 12px; border-bottom: 1px solid #ddd;">Physique</th>
                            <th style="text-align: right; padding: 12px; border-bottom: 1px solid #ddd;">Réservé</th>
                            <th style="text-align: right; padding: 12px; border-bottom: 1px solid #ddd;">Disponible</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in visibleQuantityRows" :key="row.categorie">
                            <td style="padding: 12px; border-bottom: 1px solid #eee;">{{ row.categorie }}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">{{ formatNumber(row.physique) }}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">{{ formatNumber(row.reserved) }}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">{{ formatNumber(row.dispo) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="quantityPagination.totalPages.value > 1" style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button type="button" :disabled="quantityPagination.currentPage.value === 1" @click="quantityPagination.prevPage">Précédent</button>
                <span>Page {{ quantityPagination.currentPage.value }} / {{ quantityPagination.totalPages.value }}</span>
                <button type="button" :disabled="quantityPagination.currentPage.value === quantityPagination.totalPages.value" @click="quantityPagination.nextPage">Suivant</button>
            </div>
        </div>
    </div>
</template>