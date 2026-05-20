<template>
    <div style="padding: 20px; max-width: 1400px; margin: 0 auto;">
        <h2>Import CSV — Produits / Déclinaisons / Commandes / Images</h2>
        <p style="color: #555; margin-top: 0;">
            Chargez les fichiers CSV et/ou un fichier ZIP, puis cliquez sur "Importer tout".
        </p>

        <!-- ── Message global ─────────────────────────────────────────── -->
        <div v-if="globalMessage" :style="msgStyle(globalMessageType)">
            {{ globalMessage }}
        </div>

        <!-- ═══════════════════════════════════════════════════════════════
             GRILLE DES 3 SLOTS (CSV)
        ════════════════════════════════════════════════════════════════ -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 28px;">

            <div
                v-for="{ key, label } in SLOTS"
                :key="key"
                style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: #fff;"
            >
                <!-- En-tête slot -->
                <h3 style="margin: 0 0 12px; font-size: 1rem; color: #333;">
                    {{ label }}
                </h3>

                <!-- Input fichier -->
                <label :for="`file-${key}`" style="font-weight: 500; display: block; margin-bottom: 6px;">
                    Fichier CSV :
                </label>
                <input
                    :id="`file-${key}`"
                    type="file"
                    accept=".csv"
                    style="width: 100%; box-sizing: border-box;"
                    @change="handleFileUpload(key, $event)"
                    :disabled="isImporting"
                />

                <!-- Badge "chargé" -->
                <div v-if="slots[key].parsed" style="margin-top: 8px; font-size: 0.85rem; color: #28a745;">
                    ✓ {{ slots[key].content.data.length }} ligne(s) chargée(s)
                </div>

                <!-- Message du slot -->
                <div v-if="slots[key].message" :style="{ ...msgStyle(slots[key].messageType), marginTop: '10px' }">
                    {{ slots[key].message }}
                </div>

                <!-- ── Mapping (products + combinations) ───────────────── -->
                <template v-if="slots[key].parsed && key !== 'orders' && slots[key].csvHeaders.length">
                    <details style="margin-top: 14px;">
                        <summary style="cursor: pointer; font-weight: 500; color: #555;">
                            Mapping des colonnes
                        </summary>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.82rem;">
                            <thead>
                                <tr>
                                    <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee;">CSV</th>
                                    <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee;">Champ API</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="mapping in slots[key].columnMappings" :key="mapping.csvColumn">
                                    <td style="padding: 4px 6px; border-bottom: 1px solid #f5f5f5; white-space: nowrap; max-width: 130px; overflow: hidden; text-overflow: ellipsis;">
                                        {{ mapping.csvColumn }}
                                    </td>
                                    <td style="padding: 4px 6px; border-bottom: 1px solid #f5f5f5;">
                                        <select
                                            v-model="mapping.apiField"
                                            style="width: 100%; font-size: 0.82rem;"
                                            @change="refreshXmlPreview(key)"
                                            :disabled="isImporting"
                                        >
                                            <option
                                                v-for="opt in getFieldOptions(key)"
                                                :key="opt.value"
                                                :value="opt.value"
                                            >
                                                {{ opt.label }}
                                            </option>
                                        </select>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </details>
                </template>

                <!-- Info orders (pas de mapping) -->
                <div v-if="key === 'orders' && slots[key].parsed" style="margin-top: 10px; font-size: 0.85rem; color: #666;">
                    Le mapping est automatique pour les commandes.
                </div>

                <!-- Résultat individuel -->
                <div v-if="slots[key].result" style="margin-top: 12px; font-size: 0.85rem;">
                    <span style="color: #28a745;">✓ {{ slots[key].result.success }} réussie(s)</span>
                    <span v-if="slots[key].result.errors.length" style="color: #dc3545; margin-left: 10px;">
                        ✗ {{ slots[key].result.errors.length }} erreur(s)
                    </span>
                </div>

                <!-- Spinner -->
                <div v-if="slots[key].isLoading" style="margin-top: 10px; font-size: 0.85rem; color: #888;">
                    ⏳ Import en cours…
                </div>
            </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════
             SECTION IMPORT IMAGES
        ════════════════════════════════════════════════════════════════ -->
        <div style="margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: #fff;">
            <h3 style="margin: 0 0 16px;">🖼️ Images produits (ZIP)</h3>
            <p style="color: #555; margin-bottom: 16px; font-size: 0.9rem;">
                Format attendu : ZIP contenant des images nommées selon la référence produit.<br>
                Exemple : <code>T_01.jpg</code> → produit référence <code>T_01</code><br>
                Extensions supportées : .jpg, .jpeg, .png, .webp, .gif
            </p>
            
            <div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <label style="font-weight: 500; display: block; margin-bottom: 6px;">
                        Fichier ZIP :
                    </label>
                    <input
                        ref="imageFileInput"
                        type="file"
                        accept=".zip"
                        style="width: 100%; box-sizing: border-box;"
                        @change="handleImageFileUpload"
                        :disabled="isImporting"
                    />
                    <div v-if="imageImport.file && !isImporting" style="margin-top: 8px; font-size: 0.85rem; color: #28a745;">
                        ✓ Prêt : {{ imageImport.file.name }}
                    </div>
                </div>
            </div>

            <!-- Résultat images (résumé rapide) -->
            <div v-if="imageImport.results && !isImporting" style="margin-top: 12px; font-size: 0.85rem;">
                <span style="color: #28a745;">✓ {{ imageImport.results.success?.length || 0 }} importée(s)</span>
                <span v-if="imageImport.results.notFound?.length" style="color: #dc3545; margin-left: 10px;">
                    ✗ {{ imageImport.results.notFound.length }} produit(s) non trouvé(s)
                </span>
                <span v-if="imageImport.results.errors?.length" style="color: #dc3545; margin-left: 10px;">
                    ⚠ {{ imageImport.results.errors.length }} erreur(s)
                </span>
            </div>
        </div>
        <div>
            <label for="import image">Importer Image</label>
             <input
                :checked="true"
                type="checkbox"
                @change="ImportImage()"
            />
        </div>

        <!-- ── Bouton global unique ───────────────────────────────────── -->
        <div style="text-align: center; margin-top: 8px; margin-bottom: 30px;">
            <button
                type="button"
                :disabled="!hasAnyContent() || isImporting"
                style="
                    padding: 14px 48px;
                    font-size: 1.1rem;
                    font-weight: bold;
                    background-color: #28a745;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                "
                @click="importAll"
            >
                {{ isImporting ? 'Import en cours...' : '🚀 Importer tout' }}
            </button>
        </div>


        <!-- ── Barre de progression globale ───────────────────────────── -->
        <div v-if="isImporting && globalProgress.total > 0" style="margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
                <span>Progression globale : {{ globalProgress.current }} / {{ globalProgress.total }}</span>
                <span>{{ globalProgress.currentSection }}</span>
            </div>
            <div style="background-color: #e0e0e0; border-radius: 4px; overflow: hidden;">
                <div
                    :style="{
                        width: `${(globalProgress.current / globalProgress.total) * 100}%`,
                        backgroundColor: '#28a745',
                        height: '10px',
                        transition: 'width 0.3s ease'
                    }"
                ></div>
            </div>
        </div>

        <!-- ── Logs globaux ───────────────────────────────────────────── -->
        <div style="margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0;">📋 Journal d'import</h4>
                <button
                    v-if="globalLogs.length"
                    @click="clearGlobalLogs"
                    style="
                        padding: 4px 12px;
                        font-size: 0.8rem;
                        background-color: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    "
                >
                    Effacer
                </button>
            </div>
            
            <div
                style="
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    border-radius: 8px;
                    padding: 12px;
                    font-family: 'Courier New', monospace;
                    font-size: 0.8rem;
                    max-height: 400px;
                    overflow-y: auto;
                "
            >
                <div v-if="!globalLogs.length" style="color: #888; text-align: center; padding: 20px;">
                    Aucun log pour le moment. Chargez des fichiers et cliquez sur "Importer tout".
                </div>
                <div
                    v-for="(log, idx) in globalLogs"
                    :key="idx"
                    :style="{
                        padding: '4px 8px',
                        marginBottom: '2px',
                        borderBottom: '1px solid #333',
                        color: log.type === 'success' ? '#4ade80' : 
                               log.type === 'error' ? '#f87171' : 
                               log.type === 'skip' ? '#fbbf24' : '#9ca3af',
                        fontFamily: 'monospace'
                    }"
                >
                    <span style="color: #6b7280;">[{{ log.timestamp }}]</span>
                    <span style="margin-left: 8px;">{{ getLogIcon(log.type) }} {{ log.message }}</span>
                </div>
            </div>
        </div>

        <!-- ── Résumé final global ────────────────────────────────────── -->
        <div v-if="globalSummary" style="margin-top: 20px; padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
            <h4 style="margin: 0 0 12px;">📊 Résumé global de l'import</h4>

            <div v-if="importRollbackDone" style="background: #f8d7da; color: #721c24; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                <strong>Import annulé.</strong> Un rollback total a été lancé, donc aucun résultat d'import n'est conservé.
            </div>

            <div v-else style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                <div style="background: #d4edda; padding: 12px; border-radius: 6px;">
                    <div style="font-size: 1.5rem; font-weight: bold;">{{ globalSummary.products || 0 }}</div>
                    <div style="font-size: 0.85rem;">Produits importés</div>
                </div>
                <div style="background: #d4edda; padding: 12px; border-radius: 6px;">
                    <div style="font-size: 1.5rem; font-weight: bold;">{{ globalSummary.combinations || 0 }}</div>
                    <div style="font-size: 0.85rem;">Déclinaisons importées</div>
                </div>
                <div style="background: #d4edda; padding: 12px; border-radius: 6px;">
                    <div style="font-size: 1.5rem; font-weight: bold;">{{ globalSummary.orders || 0 }}</div>
                    <div style="font-size: 0.85rem;">Commandes importées</div>
                </div>
                <div style="background: #d4edda; padding: 12px; border-radius: 6px;">
                    <div style="font-size: 1.5rem; font-weight: bold;">{{ globalSummary.images || 0 }}</div>
                    <div style="font-size: 0.85rem;">Images importées</div>
                </div>
                <div v-if="globalSummary.totalErrors" style="background: #f8d7da; padding: 12px; border-radius: 6px;">
                    <div style="font-size: 1.5rem; font-weight: bold;">{{ globalSummary.totalErrors }}</div>
                    <div style="font-size: 0.85rem;">Total erreurs</div>
                </div>
            </div>
        </div>

        <!-- ── Aperçu XML (collapsible) ───────────────────────────────── -->
        <div style="margin-top: 30px;">
            <template v-for="{ key, label } in SLOTS" :key="`preview-${key}`">
                <details v-if="slots[key].xmlData && slots[key].xmlData.length" style="margin-bottom: 16px;">
                    <summary style="cursor: pointer; font-weight: 500;">
                        Aperçu XML — {{ label }}
                        ({{ slots[key].xmlData.length }} entrée(s))
                    </summary>
                    <div style="margin-top: 8px;">
                        <pre
                            v-for="(xml, idx) in slots[key].xmlData.slice(0, 2)"
                            :key="idx"
                            style="white-space: pre-wrap; max-height: 150px; overflow: auto; background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 0.7rem; margin-bottom: 6px;"
                        >{{ xml }}</pre>
                    </div>
                </details>
            </template>
        </div>
    </div>
</template>

<script>
import Papa from 'papaparse'
import JSZip from 'jszip'
import {
    getRessourceData,
    getRessourceSchema,
    convertRowsToIndividualXml,
    updateResourceData,
    insertResourceData,
    deleteCriticalResourcesData,
    getProductByReferenceForImage,
    uploadProductImage,
    importImagesFromZip,
} from '../services/ressourcesService.js'
import {
    ensureSimpleProductStock,
    forceProductCombinationMode,
    getCategoryNameLookup,
    getTaxRulesGroupRateLookup,
    getTaxRuleGroupsByRateLookup,
    importCustomerOrders,
    prepareRowsForProductImport,
    prepareVariantImportOperations,
    upsertStockAvailable,
    validateCsvImport ,
} from '../services/importService.js'

// ─── Constantes ressources fixes ────────────────────────────────────────────
const SLOTS = [
    { key: 'products',      label: 'Produits',      resource: 'products' },
    { key: 'combinations',  label: 'Déclinaisons',  resource: 'combinations' },
    { key: 'orders',        label: 'Commandes',     resource: 'orders' },
]

// ─── État initial d'un slot ──────────────────────────────────────────────────
function makeSlotState() {
    return {
        file: null,
        parsed: false,
        content: { data: [], meta: { fields: [] } },
        csvHeaders: [],
        columnMappings: [],
        resourceFields: [],
        xmlData: null,
        categoryNameLookup: {},
        taxRuleGroupsByRateLookup: {},
        taxRulesGroupRateLookup: {},
        result: null,
        isLoading: false,
        message: '',
        messageType: '',
    }
}

export default {
    data() {
        return {
            slots: {
                products:     makeSlotState(),
                combinations: makeSlotState(),
                orders:       makeSlotState(),
            },
            languageIds: [1],
            isImporting: false,
            isImportImage: true,
            globalMessage: '',
            globalMessageType: '',
            globalLogs: [],
            globalProgress: { current: 0, total: 0, currentSection: '' },
            globalSummary: null,
            importRollbackDone: false,
            imageImport: {
                file: null,
                results: null
            },
            SLOTS,
        }
    },

    async mounted() {
        try {
            const languages = await getRessourceData('languages')
            const ids = languages
                .map((l) => Number(l.id))
                .filter((id) => Number.isInteger(id) && id > 0)
            if (ids.length > 0) this.languageIds = ids
        } catch (e) {
            console.warn('Impossible de récupérer les langues, fallback [1]', e)
        }

        await Promise.all([
            this.loadSchemaFor('products'),
            this.loadSchemaFor('combinations'),
            this.loadProductLookups(),
        ])
    },

    methods: {
        ImportImage()
        {
            this.isImportImage = false
        },

        // ── Logs ─────────────────────────────────────────────────────────
        addGlobalLog(message, type = 'info') {
            this.globalLogs.unshift({
                message,
                type,
                timestamp: new Date().toLocaleTimeString()
            })
            if (this.globalLogs.length > 300) {
                this.globalLogs.pop()
            }
        },

        clearGlobalLogs() {
            this.globalLogs = []
        },

        getLogIcon(type) {
            switch(type) {
                case 'success': return '✅'
                case 'error': return '❌'
                case 'skip': return '⏭️'
                case 'info': return 'ℹ️'
                default: return '📝'
            }
        },

        // ── Normalisation ──────────────────────────────────────────────────
        normalizeHeader(value) {
            return String(value ?? '')
                .trim().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\*/g, '').replace(/[()/\-_.]/g, ' ')
                .replace(/[^a-z0-9]+/g, '')
        },

        normalizeFieldName(value) {
            return String(value ?? '')
                .trim().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '')
        },

        // ── Chargement schéma ──────────────────────────────────────────────
        async loadSchemaFor(slotKey) {
            const slot = this.slots[slotKey]
            if (slotKey === 'orders') return
            try {
                slot.resourceFields = await getRessourceSchema(slotKey)
                if (slotKey === 'products' && !slot.resourceFields.includes('categories')) {
                    slot.resourceFields.push('categories')
                }
            } catch (e) {
                console.warn(`Schéma ${slotKey} indisponible`, e)
                slot.resourceFields = []
            }
        },

        async loadProductLookups() {
            const slot = this.slots.products
            try {
                const [byRate, byId, catLookup] = await Promise.all([
                    getTaxRuleGroupsByRateLookup(),
                    getTaxRulesGroupRateLookup(),
                    getCategoryNameLookup(),
                ])
                slot.taxRuleGroupsByRateLookup = byRate
                slot.taxRulesGroupRateLookup   = byId
                slot.categoryNameLookup        = catLookup
            } catch (e) {
                console.warn('Lookups produits indisponibles', e)
            }
        },

        // ── Upload fichier ─────────────────────────────────────────────────
        handleFileUpload(slotKey, event) {
            const file = event.target.files[0]
            if (!file) return
            this.slots[slotKey].file = file
            this.parseFile(slotKey, file)
        },

        parseFile(slotKey, file) {
            const slot = this.slots[slotKey]
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: (results) => {
                    slot.content    = results
                    slot.parsed     = true
                    slot.csvHeaders = results.meta?.fields || []
                    slot.result     = null
                    slot.message    = ''

                    if (slotKey !== 'orders') {
                        slot.columnMappings = this.buildColumnMappings(slotKey, slot.csvHeaders)
                        this.refreshXmlPreview(slotKey)
                    }
                },
                error: (err) => {
                    console.error(`Erreur parsing CSV (${slotKey}):`, err)
                    this.setSlotMessage(slotKey, 'Erreur parsing CSV', 'error')
                },
            })
        },

        handleImageFileUpload(event) {
            const file = event.target.files[0]
            if (!file) return
            
            if (!file.name.endsWith('.zip')) {
                this.addGlobalLog('❌ Le fichier doit être au format ZIP', 'error')
                return
            }
            
            this.imageImport.file = file
            this.addGlobalLog(`📁 Fichier ZIP sélectionné: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, 'info')
        },

        buildColumnMappings(slotKey, headers) {
            return headers.map((col) => ({
                csvColumn: col,
                apiField: this.suggestFieldForColumn(slotKey, col),
            }))
        },

        suggestFieldForColumn(slotKey, csvColumn) {
            const slot = this.slots[slotKey]
            const normalized = this.normalizeHeader(csvColumn)

            const schemaLookup = slot.resourceFields.reduce((acc, f) => {
                acc[this.normalizeFieldName(f)] = f
                return acc
            }, {})

            if (schemaLookup[normalized]) return schemaLookup[normalized]

            const productAliases = {
                nom: 'name', titre: 'name', name: 'name',
                reference: 'reference', actif: 'active', active: 'active',
                prixttc: 'price', prixht: 'price', price: 'price', prix_ttc: 'price',
                prixachat: 'wholesale_price', wholesaleprice: 'wholesale_price',
                tva: 'id_tax_rules_group', taxe: 'id_tax_rules_group', tax: 'id_tax_rules_group',
                categorie: 'id_category_default', category: 'id_category_default',
                categories: 'categories',
                description: 'description', descriptioncourte: 'description_short',
                quantite: 'quantity', stock: 'quantity',
                ean13: 'ean13', isbn: 'isbn', upc: 'upc',
                poids: 'weight', weight: 'weight',
                metatitle: 'meta_title', metadescription: 'meta_description',
                linkrewrite: 'link_rewrite', urlrewrite: 'link_rewrite',
                dateavailabilityproduit: 'available_date',
            }

            const combinationAliases = {
                reference: 'reference', price: 'price', prix: 'price',
                specificite: 'specificite', specificites: 'specificite',
                karazany: 'karazany', value: 'karazany',
                stockinitial: 'quantity', stock: 'quantity', quantite: 'quantity',
                prixventettc: 'price',
            }

            const aliasMap = slotKey === 'combinations' ? combinationAliases : productAliases
            if (aliasMap[normalized]) {
                const target = aliasMap[normalized]
                return schemaLookup[this.normalizeFieldName(target)] || target
            }

            return 'no'
        },

        getFieldOptions(slotKey) {
            const slot = this.slots[slotKey]
            const base = [{ value: 'no', label: 'Ignorer' }]
            if (slot.resourceFields.length > 0) {
                return base.concat(slot.resourceFields.map((f) => ({ value: f, label: f })))
            }
            return base
        },

        refreshXmlPreview(slotKey) {
            const slot = this.slots[slotKey]
            if (!slot.content.data.length || slotKey === 'orders') {
                slot.xmlData = null
                return
            }
            try {
                const lookups = slotKey === 'products'
                    ? { categoryNameLookup: slot.categoryNameLookup, taxRulesGroupRateLookup: slot.taxRulesGroupRateLookup }
                    : {}
                slot.xmlData = convertRowsToIndividualXml(
                    slotKey,
                    slot.content.data,
                    slot.columnMappings,
                    this.languageIds,
                    lookups
                )
            } catch (e) {
                console.error(`Erreur génération XML (${slotKey}):`, e)
                slot.xmlData = null
            }
        },

        setSlotMessage(slotKey, text, type) {
            this.slots[slotKey].message     = text
            this.slots[slotKey].messageType = type
            setTimeout(() => { this.slots[slotKey].message = '' }, 7000)
        },

        msgStyle(type) {
            const colors = {
                success: { bg: '#d4edda', color: '#155724' },
                error:   { bg: '#f8d7da', color: '#721c24' },
                info:    { bg: '#d1ecf1', color: '#0c5460' },
            }
            const c = colors[type] || colors.info
            return { padding: '10px', borderRadius: '4px', backgroundColor: c.bg, color: c.color, marginBottom: '12px' }
        },

        hasAnyContent() {
            const hasCsv = SLOTS.some(({ key }) => this.slots[key].parsed && this.slots[key].content.data.length > 0)
            const hasZip = !!this.imageImport.file
            return hasCsv || hasZip
        },

        extractCreatedId(xmlText) {
            const parser = new DOMParser()
            const xmlDoc = parser.parseFromString(String(xmlText ?? ''), 'application/xml')
            if (xmlDoc.documentElement.nodeName === 'parsererror') return ''
            const idNode = xmlDoc.getElementsByTagName('id')[0]
            return String(idNode?.textContent ?? '').trim()
        },

        async rollbackCriticalResources(error) {
            if (this.importRollbackDone) {
                return
            }

            this.importRollbackDone = true
            const message = error instanceof Error ? error.message : String(error)
            this.addGlobalLog('─────────────────────────────────────────', 'error')
            this.addGlobalLog(`❌ ${message} — rollback total en cours...`, 'error')

            try {
                await deleteCriticalResourcesData()
                this.addGlobalLog('🗑️ Rollback total effectué', 'error')
            } catch (deleteErr) {
                const deleteMessage = deleteErr instanceof Error ? deleteErr.message : String(deleteErr)
                this.addGlobalLog(`⚠️ Rollback échoué: ${deleteMessage}`, 'error')
            }
        },

        hasVariantColumns(slotKey) {
            return this.slots[slotKey].csvHeaders.some((h) => {
                const n = this.normalizeFieldName(h)
                return n === 'specificite' || n === 'specificites' || n === 'karazany'
            })
        },

        hasVariantData(slotKey) {
            return this.slots[slotKey].content.data.some((row) => {
                if (!row || typeof row !== 'object') return false
                const lookup = Object.entries(row).reduce((acc, [k, v]) => {
                    acc[this.normalizeFieldName(k)] = v
                    return acc
                }, {})
                const s = String(lookup.specificite ?? lookup.specificites ?? '').trim()
                const k = String(lookup.karazany ?? '').trim()
                return Boolean(s || k)
            })
        },
        async validateSlot(slotKey) {
            const slot = this.slots[slotKey]
            const data = slot.content.data
            const headers = slot.csvHeaders

            // Colonnes obligatoires + colonnes date + colonnes montant par type
            const configs = {
                products: {
                    expectedColumns: ['date_availability_produit','nom', 'reference','prix_ttc','Taxe','categorie','prix_achat'],
                    dateColumns: ['date_availability_produit'],
                    amountColumns: ['prix_ttc', 'prix_achat'],
                },
                combinations: {
                    expectedColumns: ['reference', 'specificité', 'karazany', 'stock_initial', 'prix_vente_ttc'],
                    dateColumns: [],
                    amountColumns: ['prix_vente_ttc'],
                },
                orders: {
                    expectedColumns: ['email', 'date', 'achat','nom','pwd','adresse','achat','etat'],
                    dateColumns: ['date'],
                    amountColumns: [],
                },
            }

            const config = configs[slotKey]
            if (!config) return null

            const result = await validateCsvImport(data, {
                expectedColumns: config.expectedColumns,
                dateColumns: config.dateColumns,
                amountColumns: config.amountColumns,
            })

            return result
        },

        // ── IMPORT GLOBAL UNIQUE ──────────────────────────────────────────
        async importAll() {

            this.isImporting = true
            this.globalLogs = []
            this.globalSummary = null
            this.globalProgress = { current: 0, total: 0, currentSection: '' }
            this.importRollbackDone = false
            
            this.addGlobalLog('🚀 Démarrage de l\'import global...', 'info')
            this.addGlobalLog('─────────────────────────────────────────', 'info')

            const summary = {
                products: 0,
                combinations: 0,
                orders: 0,
                images: 0,
                totalErrors: 0
            }

            // Compter le nombre total d'opérations
            let totalOps = 0
            for (const { key } of SLOTS) {
                if (this.slots[key].parsed && this.slots[key].content.data.length) {
                    totalOps += this.slots[key].content.data.length
                }
            }
            if (this.imageImport.file) totalOps += 1 // 1 pour tout le ZIP
            
            let currentOp = 0

            try 
            {

                // 1. IMPORT PRODUITS
                if (this.slots.products.parsed && this.slots.products.content.data.length) {
                    const validation = await this.validateSlot('products')
                    if (validation && !validation.isValid) {
                        validation.errors.forEach(e => this.addGlobalLog(`⚠️ ${e}`, 'error'))
                        throw new Error(`Données produits invalides — ${validation.errors.length} erreur(s)`)
                    }
                    this.globalProgress.currentSection = 'Import des produits...'
                    this.addGlobalLog(`📦 Import des produits (${this.slots.products.content.data.length} lignes)`, 'info')
                    
                    const result = await this.importSlotWithProgress('products', (idx, total) => {
                        currentOp++
                        this.globalProgress.current = currentOp
                        this.globalProgress.total = totalOps
                    })
                    
                    if (result) {
                        summary.products = result.success
                        summary.totalErrors += result.errors?.length || 0
                    }
                }

                // 2. IMPORT COMBINAISONS
                if (this.slots.combinations.parsed && this.slots.combinations.content.data.length) {
                    const validation = await this.validateSlot('combinations')
                    if (validation && !validation.isValid) {
                        validation.errors.forEach(e => this.addGlobalLog(`⚠️ ${e}`, 'error'))
                        throw new Error(`Données déclinaisons invalides — ${validation.errors.length} erreur(s)`)
                    }
                    this.globalProgress.currentSection = 'Import des déclinaisons...'
                    this.addGlobalLog(`🔧 Import des déclinaisons (${this.slots.combinations.content.data.length} lignes)`, 'info')
                    
                    const result = await this.importSlotWithProgress('combinations', (idx, total) => {
                        currentOp++
                        this.globalProgress.current = currentOp
                        this.globalProgress.total = totalOps
                    })
                    
                    if (result) {
                        summary.combinations = result.success
                        summary.totalErrors += result.errors?.length || 0
                    }
                }

                // 3. IMPORT COMMANDES
                if (this.slots.orders.parsed && this.slots.orders.content.data.length) {
                     const validation = await this.validateSlot('orders')
                    if (validation && !validation.isValid) {
                        validation.errors.forEach(e => this.addGlobalLog(`⚠️ ${e}`, 'error'))
                        throw new Error(`Données commandes invalides — ${validation.errors.length} erreur(s)`)
                    }
                    this.globalProgress.currentSection = 'Import des commandes...'
                    this.addGlobalLog(`📋 Import des commandes (${this.slots.orders.content.data.length} lignes)`, 'info')
                    
                    const result = await this.importSlotWithProgress('orders', (idx, total) => {
                        currentOp++
                        this.globalProgress.current = currentOp
                        this.globalProgress.total = totalOps
                    })
                    
                    if (result) {
                        summary.orders = result.success
                        summary.totalErrors += result.errors?.length || 0
                    }
                }

                // 4. IMPORT IMAGES
                if( this.isImportImage) 
                {
                    if (this.imageImport.file) {
                        this.globalProgress.currentSection = 'Import des images...'
                        this.addGlobalLog(`🖼️ Import des images depuis ZIP...`, 'info')
                        
                        currentOp++
                        this.globalProgress.current = currentOp
                        this.globalProgress.total = totalOps
                        
                        try {
                            const zipResults = await importImagesFromZip(
                                this.imageImport.file,
                                (progress) => {
                                    // Progression interne du ZIP
                                },
                                (message, type) => {
                                    this.addGlobalLog(message, type)
                                }
                            )
                            
                            if (zipResults) {
                                summary.images = zipResults.success?.length || 0
                                summary.totalErrors += (zipResults.notFound?.length || 0) + (zipResults.errors?.length || 0)
                                this.imageImport.results = zipResults
                            }
                        } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : String(error)
                            this.addGlobalLog(`💥 Erreur import images: ${errorMsg}`, 'error')
                            await this.rollbackCriticalResources(error)
                            throw error
                        }
                    }
                }

                this.globalSummary = summary
                this.globalProgress.current = totalOps
                this.isImporting = false
                
                this.addGlobalLog('─────────────────────────────────────────', 'info')
                this.addGlobalLog(`✅ IMPORT TERMINÉ - ${summary.products + summary.combinations + summary.orders + summary.images} éléments importés, ${summary.totalErrors} erreur(s)`, 'success')
            }
            catch( err)
            {
                await this.rollbackCriticalResources(err)

                this.globalSummary = summary
            }
            finally {
                this.isImporting = false
            }
        },

        async importSlotWithProgress(slotKey, onProgress) {
            const slot = this.slots[slotKey]
            if (!slot.parsed || !slot.content.data.length) return null

            slot.isLoading = true
            slot.result = null

            const results = { success: 0, errors: [] }

            try {
                if (slotKey === 'orders') {
                    const prepared = await importCustomerOrders(slot.content.data, this.languageIds)
                    results.success = prepared.success || 0
                    if (Array.isArray(prepared.errors) && prepared.errors.length > 0) {
                        prepared.errors.forEach((e) => results.errors.push({ message: e.reason || 'Erreur commande' }))
                        const firstError = prepared.errors[0]
                        await this.rollbackCriticalResources(firstError?.reason || firstError || 'Erreur d’import')
                        throw new Error(firstError?.reason || 'Erreur d’import')
                    }
                } 
                else if ((slotKey === 'products' || slotKey === 'combinations') && 
                         (this.hasVariantColumns(slotKey) || this.hasVariantData(slotKey))) {
                    
                    const prepared = await prepareVariantImportOperations(slot.content.data, this.languageIds)
                    const operations = prepared.operations || []

                    for (let i = 0; i < operations.length; i++) {
                        const op = operations[i]
                        try {
                            let response = ''
                            if (op.method === 'UPSERT' && op.resource === 'stock_availables') {
                                response = await upsertStockAvailable({
                                    productId: op.productId,
                                    productAttributeId: op.productAttributeId,
                                    quantity: op.quantity,
                                })
                            } else if (op.method === 'PUT') {
                                response = await updateResourceData(op.resource, op.id, op.xml)
                            } else {
                                response = await insertResourceData(op.resource, op.xml)
                            }

                            if (op.resource === 'combinations' && op.stockQuantity != null) {
                                const combinationId = this.extractCreatedId(response)
                                if (combinationId) {
                                    await forceProductCombinationMode(op.productId, combinationId)
                                    await new Promise((r) => setTimeout(r, 800))
                                    await upsertStockAvailable({
                                        productId: op.productId,
                                        productAttributeId: combinationId,
                                        quantity: op.stockQuantity,
                                    })
                                }
                            }

                            results.success++
                            if (onProgress) onProgress(i, operations.length)
                            await new Promise((r) => setTimeout(r, 300))
                        } catch (err) {
                            results.errors.push({ message: err instanceof Error ? err.message : String(err) })
                            await this.rollbackCriticalResources(err)
                            throw err
                        }
                    }
                } 
                else {
                    let rowsToImport = slot.content.data
                    let referenceLookups = {
                        categoryNameLookup: slot.categoryNameLookup || {},
                        taxRulesGroupRateLookup: slot.taxRulesGroupRateLookup || {},
                        taxRateToGroupIdLookup: {},
                    }

                    if (slotKey === 'products') {
                        const prepared = await prepareRowsForProductImport(
                            slot.content.data,
                            slot.columnMappings,
                            this.languageIds,
                            {
                                categoryNameLookup: slot.categoryNameLookup,
                                taxRuleGroupsByRateLookup: slot.taxRuleGroupsByRateLookup,
                            }
                        )
                        rowsToImport = prepared.rows
                        referenceLookups = {
                            categoryNameLookup: prepared.categoryNameLookup,
                            taxRulesGroupRateLookup: prepared.taxRulesGroupRateLookup,
                            taxRateToGroupIdLookup: prepared.taxRateToGroupIdLookup || {},
                        }
                    }

                    const xmlList = convertRowsToIndividualXml(
                        slotKey,
                        rowsToImport,
                        slot.columnMappings,
                        this.languageIds,
                        referenceLookups
                    )

                    for (let i = 0; i < xmlList.length; i++) {
                        const xml = xmlList[i]
                        const sourceRow = slot.content.data[i] || {}
                        try {
                            await insertResourceData(slotKey, xml)
                            results.success++

                            if (slotKey === 'products' && !this.hasVariantData(slotKey)) {
                                try {
                                    const mappingLookup = slot.columnMappings.reduce((acc, m) => {
                                        if (m.apiField && m.apiField !== 'no') acc[m.csvColumn] = m.apiField
                                        return acc
                                    }, {})
                                    let reference = '', quantity = 0
                                    Object.entries(sourceRow).forEach(([col, val]) => {
                                        const f = mappingLookup[col]
                                        if (f === 'reference') reference = String(val ?? '').trim()
                                        if (f === 'quantity') quantity = Number(String(val ?? '').replace(/,/g, '.')) || 0
                                    })
                                    if (reference) {
                                        await new Promise((r) => setTimeout(r, 800))
                                        // await ensureSimpleProductStock(reference, quantity)
                                    }
                                } catch (stockErr) {
                                    console.warn(`Stock non créé ligne ${i + 1}:`, stockErr)
                                }
                            }

                            if (onProgress) onProgress(i, xmlList.length)
                            await new Promise((r) => setTimeout(r, 300))
                        } catch (err) {
                            results.errors.push({ message: err instanceof Error ? err.message : String(err) })
                            await this.rollbackCriticalResources(err)
                            throw err
                        }
                    }
                }
            } finally {
                slot.isLoading = false
                slot.result = results
                this.addGlobalLog(`📊 ${slotKey}: ${results.success} importé(s), ${results.errors.length} erreur(s)`, results.errors.length === 0 ? 'success' : 'info')
            }

            return results
        }
    },
}
</script>