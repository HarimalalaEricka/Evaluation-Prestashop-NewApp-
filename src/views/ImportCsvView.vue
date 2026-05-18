<script>
import Papa from 'papaparse';
import { getRessourceData, getRessources, getRessourceSchema, convertRowsToIndividualXml, updateResourceData, insertResourceData } from '../services/ressourcesService.js'
import { ensureSimpleProductStock, forceProductCombinationMode, getCategoryNameLookup, getTaxRulesGroupRateLookup, getTaxRuleGroupsByRateLookup, importCustomerOrders, prepareRowsForProductImport, prepareVariantImportOperations, upsertStockAvailable } from '../services/importService.js'
import { deleteAllResourceData, resetResources } from '../services/deleteService.js'

export default {
    data() {
        return {
            file: null,
            content: {
                data: [],
                meta: { fields: [] }
            },
            parsed: false,
            ressources: [],
            selectedRessource: '',
            csvHeaders: [],
            columnMappings: [],
            resourceFields: [],
            taxRuleGroupsByRateLookup: {},
            taxRulesGroupRateLookup: {},
            categoryNameLookup: {},
            languageIds: [1],
            xmlData: null,
            isLoading: false,
            message: '',
            messageType: '' // 'success', 'error', 'info'
        }
    },

    watch: {
        selectedRessource(newValue) {
            this.resourceFields = []
            this.taxRuleGroupsByRateLookup = {}
            this.taxRulesGroupRateLookup = {}

            if (newValue) {
                this.loadResourceSchema()

                if (newValue === 'products') {
                    this.loadCategoryLookup()
                    this.loadTaxRuleGroupsLookup()
                }
            }
        }
    },

    async mounted() {
        try {
            const ressourceList = await getRessources()
            this.ressources = ressourceList

            try {
                const languages = await getRessourceData('languages')
                const languageIds = languages
                    .map((language) => Number(language.id))
                    .filter((languageId) => Number.isInteger(languageId) && languageId > 0)

                if (languageIds.length > 0) {
                    this.languageIds = languageIds
                }
            } catch (languageError) {
                console.warn('Impossible de récupérer les langues, fallback sur [1].', languageError)
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des ressources :', error)
        }
    },

    methods: {
        normalizeHeader(value) {
            return String(value ?? '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\*/g, '')
                .replace(/[()/\-_.]/g, ' ')
                .replace(/[^a-z0-9]+/g, '')
        },

        normalizeFieldName(value) {
            return String(value ?? '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '')
        },

        hasVariantColumns() {
            const headers = Array.isArray(this.csvHeaders) ? this.csvHeaders : []
            return headers.some((header) => {
                const normalized = this.normalizeFieldName(header)
                return normalized === 'specificite' || normalized === 'specificités' || normalized === 'karazany'
            })
        },

        hasVariantData() {
            const rows = Array.isArray(this.content?.data) ? this.content.data : []

            return rows.some((row) => {
                if (!row || typeof row !== 'object') {
                    return false
                }

                const lookup = Object.entries(row).reduce((accumulator, [key, value]) => {
                    const normalizedKey = this.normalizeFieldName(key)
                    if (normalizedKey) {
                        accumulator[normalizedKey] = value
                    }
                    return accumulator
                }, {})

                const specificiteValue = String(lookup.specificite ?? lookup.specificites ?? '').trim()
                const karazanyValue = String(lookup.karazany ?? '').trim()

                return Boolean(specificiteValue || karazanyValue)
            })
        },

        getSchemaFieldLookup() {
            return Array.isArray(this.resourceFields)
                ? this.resourceFields.reduce((lookup, fieldName) => {
                    const normalizedField = this.normalizeFieldName(fieldName)
                    if (normalizedField) {
                        lookup[normalizedField] = fieldName
                    }
                    return lookup
                }, {})
                : {}
        },

        getAliasLookup() {
            if (this.selectedRessource === 'categories') {
                return {
                    idparent: 'id_parent',
                    parent: 'id_parent',
                    categorie: 'id_parent',
                    categories: 'id_parent',
                    descriptioncourte: 'description_short',
                    shortdescription: 'description_short',
                    metatitle: 'meta_title',
                    metakeywords: 'meta_keywords',
                    metadescription: 'meta_description',
                    linkrewrite: 'link_rewrite',
                    urlrewrite: 'link_rewrite',
                }
            }

            if (this.selectedRessource === 'products') {
                return {
                    id: 'id',
                    actif: 'active',
                    active: 'active',
                    nom: 'name',
                    titre: 'name',
                    name: 'name',
                    categoriesxyz: 'categories',
                    category: 'categories',
                    categories: 'categories',
                    idcategorydefault: 'id_category_default',
                    prix_ttc: 'price',
                    prixttc: 'price',
                    prixht: 'price',
                    prix_achat: 'wholesale_price',
                    prixachat: 'wholesale_price',
                    whole_price: 'wholesale_price',
                    idregledetaxes: 'id_tax_rules_group',
                    idtaxrulesgroup: 'id_tax_rules_group',
                    prixdachat: 'wholesale_price',
                    taxe: 'id_tax_rules_group',
                    tva: 'id_tax_rules_group',
                    tax: 'id_tax_rules_group',
                    ensoldes01: 'on_sale',
                    montantdelaremise: 'reduction_price',
                    pourcentagedereduction: 'reduction_percent',
                    reductiondeaaaammjj: 'reduction_from',
                    reductionaaaammjj: 'reduction_to',
                    referencefournisseur: 'supplier_reference',
                    fournisseurs: 'id_supplier',
                    marque: 'id_manufacturer',
                    ecoparticipation: 'ecotax',
                    largeur: 'width',
                    hauteur: 'height',
                    profondeur: 'depth',
                    poids: 'weight',
                    delaidelivraisonpourlesproduitsenstock: 'delivery_in_stock',
                    delaidelivraisondesproduitsepuisesaveccommandeautorisee: 'delivery_out_stock',
                    quantite: 'quantity',
                    quantiterminimale: 'minimal_quantity',
                    niveaudestockbas: 'low_stock_threshold',
                    recevoirunealerteparemailorsquelestockestfaible: 'low_stock_alert',
                    visibilite: 'visibility',
                    fraisdeportsupplementaire: 'additional_shipping_cost',
                    unitepourleprixunitaire: 'unity',
                    prixunitaire: 'unit_price',
                    recapitulatif: 'description_short',
                    descriptioncourte: 'description_short',
                    description: 'description',
                    motclesxyz: 'tags',
                    motcles: 'tags',
                    balisetitre: 'meta_title',
                    metamotscles: 'meta_keywords',
                    metadescription: 'meta_description',
                    urlreecrite: 'link_rewrite',
                    libellesienstock: 'available_now',
                    libellequandprecommandeactivee: 'available_later',
                    disponiblealacommande0non1oui: 'available_for_order',
                    datededisponibiliteduproduit: 'available_date',
                    dateavailabilityproduit: 'available_date',
                    dateadduproduit: 'date_add',
                    afficherleprix0non1oui: 'show_price',
                    urldesimagesxyzetc: 'image',
                    textesalternatifdesimagesxyz: 'image_alt',
                    supprimerlesimagesexistantes0non1oui: 'delete_existing_images',
                    caracteristiquenomvaleurpositionpersonnalise: 'features',
                    disponibleenligneuniquement0non1oui: 'online_only',
                    etat: 'state',
                    personnalisable0non1oui: 'customizable',
                    fichierstelechargeables0non1oui: 'uploadable_files',
                    champstexte0non1oui: 'text_fields',
                    actionencasderupturedestock: 'out_of_stock',
                    produitematerialise0non1oui: 'is_virtual',
                    urldufichier: 'file_url',
                    nombredetelechargementsautorises: 'nb_downloadable',
                    dateexpirationaaaammjj: 'date_expiration',
                    idmanufacturer: 'id_manufacturer',
                    idsupplier: 'id_supplier',
                    reference: 'reference',
                    location: 'location',
                    width: 'width',
                    height: 'height',
                    depth: 'depth',
                    weight: 'weight',
                    ean13: 'ean13',
                    isbn: 'isbn',
                    upc: 'upc',
                    mpn: 'mpn',
                    isvirtual: 'is_virtual',
                    onlineonly: 'online_only',
                    availablefororder: 'available_for_order',
                    availabledate: 'available_date',
                    showcondition: 'show_condition',
                    condition: 'condition',
                    advancedstockmanagement: 'advanced_stock_management',
                    meta_title: 'meta_title',
                    metatitle: 'meta_title',
                    meta_keywords: 'meta_keywords',
                    metakeywords: 'meta_keywords',
                    meta_description: 'meta_description',
                    metadescription: 'meta_description',
                    linkrewrite: 'link_rewrite',
                    urlrewrite: 'link_rewrite',
                    link_rewrite: 'link_rewrite',
                    price: 'price',
                    priceht: 'price',
                    whole_price: 'wholesale_price',
                    prix_ttc: 'price',
                    prix_achat: 'wholesale_price',
                    prixachat: 'wholesale_price',
                    wholesaleprice: 'wholesale_price',
                    unity: 'unity',
                    unitprice: 'unit_price',
                    unitpriceratio: 'unit_price_ratio',
                    additionalshippingcost: 'additional_shipping_cost',
                    customisable: 'customizable',
                    customizable: 'customizable',
                    textfields: 'text_fields',
                    uploadablefiles: 'uploadable_files',
                    new: 'new',
                    state: 'state',
                    producttype: 'product_type',
                    product_type: 'product_type',
                    idshopdefault: 'id_shop_default',
                }
            }

            return {
                id: 'id',
                active: 'active',
                name: 'name',
                description: 'description',
                descriptionshort: 'description_short',
                metatitle: 'meta_title',
                metakeywords: 'meta_keywords',
                metadescription: 'meta_description',
                linkrewrite: 'link_rewrite',
            }
        },

        getFieldOptions() {
            // si on a récupéré le schéma via ?schema=blank, proposer ces champs
            if (Array.isArray(this.resourceFields) && this.resourceFields.length > 0) {
                const base = [{ value: 'no', label: 'Ignorer' }]

                const mapped = this.resourceFields.map((f) => ({ value: f, label: f }))
                return base.concat(mapped)
            }

            // fallback: anciens choix par défaut (catégories spécifiques ou génériques)
            if (this.selectedRessource === 'categories') {
                return [
                    { value: 'no', label: 'Ignorer' },
                    { value: 'id_parent', label: 'Parent category / id_parent' },
                    { value: 'active', label: 'Active (0/1)' },
                    { value: 'name', label: 'Name' },
                    { value: 'description', label: 'Description' },
                    { value: 'meta_title', label: 'Meta title' },
                    { value: 'meta_keywords', label: 'Meta keywords' },
                    { value: 'meta_description', label: 'Meta description' },
                    { value: 'link_rewrite', label: 'Rewritten URL' },
                    { value: 'is_root_category', label: 'Root category (0/1)' },
                    { value: 'image', label: 'Image URL' },
                    { value: 'shop', label: 'Store' }
                ]
            }

            return [
                { value: 'no', label: 'Ignorer' },
                { value: 'active', label: 'Active (0/1)' },
                { value: 'name', label: 'Name' },
                { value: 'price', label: 'Price' },
                { value: 'description', label: 'Description' },
                { value: 'meta_title', label: 'Meta title' },
                { value: 'meta_keywords', label: 'Meta keywords' },
                { value: 'meta_description', label: 'Meta description' },
                { value: 'link_rewrite', label: 'Rewritten URL' }
            ]
        },

        async deleteLastForSelectedResource() {
            if (!this.selectedRessource) {
                this.showMessage('Aucune ressource sélectionnée', 'error')
                return
            }
            const ok = confirm(`Confirmer la suppression de toutes les données de la ressource '${this.selectedRessource}' ?`)
            if (!ok) return

            try {
                const res = await deleteAllResourceData(this.selectedRessource)
                this.showMessage(`Suppression terminée pour ${this.selectedRessource}: ${res.deletedCount || 0} élément(s) supprimé(s)`, 'success')
            } catch (err) {
                this.showMessage(`Erreur suppression: ${err instanceof Error ? err.message : String(err)}`, 'error')
            }
        },

        async resetCriticalResources() {
            const critical = ['customers', 'orders', 'products', 'combinations', 'carts']
            const ok = confirm(`Confirmer la suppression de toutes les données pour les ressources critiques: ${critical.join(', ')} ?`)
            if (!ok) return

            try {
                const results = await resetResources(critical)
                console.log('Reset critical resources results:', results)
                this.showMessage('Reset terminé (voir console pour détails)', 'success')
            } catch (err) {
                this.showMessage(`Erreur reset: ${err instanceof Error ? err.message : String(err)}`, 'error')
            }
        },

        suggestFieldForColumn(csvColumn) {
            const normalized = this.normalizeHeader(csvColumn)
            const schemaLookup = this.getSchemaFieldLookup()
            const aliasLookup = this.getAliasLookup()

            // Special case: if CSV column is 'categorie'/'category' for products,
            // automatically map to id_category_default
            if (this.selectedRessource === 'products' && 
                (normalized === 'categorie' || normalized === 'category')) {
                return 'id_category_default'
            }

            if (schemaLookup[normalized]) {
                return schemaLookup[normalized]
            }

            if (aliasLookup[normalized]) {
                const aliasTarget = aliasLookup[normalized]
                const normalizedAliasTarget = this.normalizeFieldName(aliasTarget)
                return schemaLookup[normalizedAliasTarget] || aliasTarget
            }

            return 'no'
        },

        buildColumnMappings(headers) {
            return headers.map((csvColumn) => ({
                csvColumn,
                apiField: this.suggestFieldForColumn(csvColumn)
            }))
        },

        async loadResourceSchema() {
            if (!this.selectedRessource) return

            try {
                this.resourceFields = await getRessourceSchema(this.selectedRessource)
                
                // Add 'categories' field for products if not already present
                if (this.selectedRessource === 'products' && !this.resourceFields.includes('categories')) {
                    this.resourceFields.push('categories')
                }
                
                if (this.csvHeaders.length > 0) {
                    this.columnMappings = this.buildColumnMappings(this.csvHeaders)
                    this.refreshXmlPreview()
                }
            } catch (error) {
                console.warn('Impossible de récupérer le schéma de la ressource', error)
                this.resourceFields = []
            }
        },

        async loadCategoryLookup() {
            try {
                this.categoryNameLookup = await getCategoryNameLookup()
                if (this.parsed && this.csvHeaders.length > 0) {
                    this.refreshXmlPreview()
                }
            } catch (error) {
                console.warn('Impossible de récupérer la correspondance des catégories', error)
                this.categoryNameLookup = {}
            }
        },

        async loadTaxRuleGroupsLookup() {
            try {
                const [byRate, byId] = await Promise.all([
                    getTaxRuleGroupsByRateLookup(),
                    getTaxRulesGroupRateLookup()
                ])
                this.taxRuleGroupsByRateLookup = byRate
                this.taxRulesGroupRateLookup = byId
                if (this.parsed && this.csvHeaders.length > 0) {
                    this.refreshXmlPreview()
                }
            } catch (error) {
                console.warn('Impossible de récupérer la correspondance des taxes', error)
                this.taxRuleGroupsByRateLookup = {}
                this.taxRulesGroupRateLookup = {}
            }
        },

        refreshXmlPreview() {
            if (!this.selectedRessource || !Array.isArray(this.content.data) || this.content.data.length === 0) {
                this.xmlData = null
                return
            }

            if (this.selectedRessource === 'orders') {
                this.xmlData = null
                return
            }

            try {
                this.xmlData = convertRowsToIndividualXml(
                    this.selectedRessource,
                    this.content.data,
                    this.columnMappings,
                    this.languageIds,
                    {
                        categoryNameLookup: this.categoryNameLookup,
                        taxRulesGroupRateLookup: this.taxRulesGroupRateLookup,
                    }
                )
            } catch (error) {
                console.error('Erreur génération XML:', error)
                this.xmlData = null
            }
        },

        handleFileUpload(event) {
            this.file = event.target.files[0]
            this.parseFile()
        },
        // mamaky fichier .csv
        parseFile() {
            if (!this.file) return

            Papa.parse(this.file, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: (results) => {
                    this.content = results
                    this.parsed = true
                    this.csvHeaders = results.meta?.fields || []
                    this.columnMappings = this.buildColumnMappings(this.csvHeaders)
                    
                    // Générer un XML individuel par ligne (tableau de XML)
                    this.refreshXmlPreview()
                    if (Array.isArray(this.xmlData)) {
                        console.log('XMLs générés:', this.xmlData.length)
                        this.xmlData.forEach((xml, idx) => {
                            console.log(`XML ligne ${idx + 1}:`)
                            console.log(xml)
                        })
                    }
                },
                error: (error) => {
                    console.error('Erreur parsing CSV:', error)
                    this.showMessage('Erreur lors du parsing du fichier CSV', 'error')
                }
            })
        },

        async loadSelectedRessource() {
            if (!this.selectedRessource) return

            try {
                // Récupérer les données existantes ET le schéma de la ressource
                const [data, schema] = await Promise.all([
                    getRessourceData(this.selectedRessource),
                    getRessourceSchema(this.selectedRessource).catch((e) => { console.warn('Impossible de récupérer le schéma', e); return [] })
                ])

                // stocker les données et le schéma (champs disponibles)
                this.content = { data, meta: { fields: [] } }
                this.resourceFields = schema
                if (this.csvHeaders.length > 0) {
                    this.columnMappings = this.buildColumnMappings(this.csvHeaders)
                }
                this.parsed = true
                console.log('Ressource data:', data)
                console.log('Ressource schema fields:', schema)
            } catch (error) {
                console.error('Erreur chargement ressource:', error)
                this.showMessage('Erreur lors du chargement de la ressource', 'error')
            }
        },

        extractCreatedId(xmlText) {
            const parser = new DOMParser()
            const xmlDoc = parser.parseFromString(String(xmlText ?? ''), 'application/xml')

            if (xmlDoc.documentElement.nodeName === 'parsererror') {
                return ''
            }

            const idNode = xmlDoc.getElementsByTagName('id')[0]
            return String(idNode?.textContent ?? '').trim()
        },

        async submitImport() {
            if (!this.selectedRessource || !Array.isArray(this.content.data) || this.content.data.length === 0) {
                this.showMessage('Veuillez charger un fichier CSV et sélectionner une ressource', 'error')
                return
            }

            this.isLoading = true
            this.message = ''

            const results = {
                success: 0,
                errors: [],
            }

            try {
                if (this.selectedRessource === 'orders') {
                    this.xmlData = null

                    const prepared = await importCustomerOrders(this.content.data, this.languageIds)
                    results.success = prepared.success || 0

                    // If import reported errors, attempt to reset critical resources (remove last created)
                    if (Array.isArray(prepared.errors) && prepared.errors.length > 0) {
                        try {
                            const critical = ['customers', 'orders', 'products', 'combinations', 'carts']
                            console.warn('[IMPORT] Errors detected, attempting reset of critical resources:', critical)
                            const resetRes = await resetResources(critical)
                            console.log('[IMPORT] Reset results:', resetRes)
                        } catch (resetErr) {
                            console.error('[IMPORT] Reset resources failed:', resetErr)
                        }
                    }

                    if (Array.isArray(prepared.errors) && prepared.errors.length > 0) {
                        results.errors.push(...prepared.errors.map((item, index) => ({
                            index,
                            message: item.reason || 'Erreur import commande',
                        })))
                    }

                    if (Array.isArray(prepared.skippedRows) && prepared.skippedRows.length > 0) {
                        results.errors.push(...prepared.skippedRows.map((item, index) => ({
                            index,
                            message: item.reason || 'Ligne ignorée',
                        })))
                    }

                    if (results.errors.length === 0) {
                        this.showMessage(`Import terminé : ${results.success} commandes importées`, 'success')
                    } else {
                        this.showMessage(`Import partiel : ${results.success} réussies, ${results.errors.length} erreurs`, 'error')
                        console.error('Détails erreurs:', results.errors)
                    }

                    return
                }

                const isVariantImport = (this.selectedRessource === 'products' || this.selectedRessource === 'combinations')
                    && (this.hasVariantColumns() || this.hasVariantData())

                if (isVariantImport) {
                    const prepared = await prepareVariantImportOperations(this.content.data, this.languageIds)
                    const operations = prepared.operations || []

                    if (operations.length === 0) {
                        this.showMessage('Aucune ligne exploitable pour l’import des déclinaisons', 'error')
                        return
                    }

                    this.xmlData = operations

                    for (let i = 0; i < operations.length; i++) {
                        const operation = operations[i]
                        try {
                            if (operation.resource === 'combinations' && !String(operation.productId ?? '').trim()) {
                                throw new Error('ID produit manquant avant envoi de la déclinaison')
                            }

                            let response = ''

                            if (operation.method === 'UPSERT' && operation.resource === 'stock_availables') {
                                response = await upsertStockAvailable({
                                    productId: operation.productId,
                                    productAttributeId: operation.productAttributeId,
                                    quantity: operation.quantity,
                                })
                                console.log(`Stock mis à jour ligne ${i + 1} (produit=${operation.productId}, combinaison=${operation.productAttributeId ?? 0}, quantité=${operation.quantity})`, response)
                            } else if (operation.method === 'PUT') {
                                response = await updateResourceData(operation.resource, operation.id, operation.xml)
                            } else {
                                response = await insertResourceData(operation.resource, operation.xml)
                            }

                            if (operation.resource === 'combinations' && operation.stockQuantity !== null && operation.stockQuantity !== undefined) {
                                const combinationId = this.extractCreatedId(response)

                                if (!combinationId) {
                                    throw new Error('Impossible de récupérer l\'ID de la combinaison créée pour mettre à jour le stock')
                                }

                                await forceProductCombinationMode(operation.productId, combinationId)

                                // Attendre que PrestaShop génère l'entrée stock_available automatiquement
                                await new Promise((resolve) => setTimeout(resolve, 800))

                                await upsertStockAvailable({
                                    productId: operation.productId,
                                    productAttributeId: combinationId,
                                    quantity: operation.stockQuantity,
                                })
                                console.log(`Stock combinaison mis à jour ligne ${i + 1} (produit=${operation.productId}, combinaison=${combinationId}, quantité=${operation.stockQuantity})`)
                            }

                            results.success += 1
                            console.log(`Ligne ${i + 1} importée. Réponse:`, response)
                            await new Promise((resolve) => setTimeout(resolve, 300))
                        } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : String(error)
                            results.errors.push({ index: i, message: errorMsg })
                            console.error(`Erreur import ligne ${i + 1}:`, error)
                        }
                    }

                    if (Array.isArray(prepared.skippedRows) && prepared.skippedRows.length > 0) {
                        results.errors.push(...prepared.skippedRows.map((item, index) => ({
                            index,
                            message: item.reason || 'Ligne ignorée',
                        })))
                    }
                } else {
                    let rowsToImport = this.content.data
                    let referenceLookups = {
                        categoryNameLookup: this.categoryNameLookup,
                        taxRulesGroupRateLookup: this.taxRulesGroupRateLookup,
                        taxRateToGroupIdLookup: {},
                    }

                    if (this.selectedRessource === 'products') {
                        const prepared = await prepareRowsForProductImport(
                            this.content.data,
                            this.columnMappings,
                            this.languageIds,
                            {
                                categoryNameLookup: this.categoryNameLookup,
                                taxRuleGroupsByRateLookup: this.taxRuleGroupsByRateLookup,
                            }
                        )

                        rowsToImport = prepared.rows
                        referenceLookups = {
                            categoryNameLookup: prepared.categoryNameLookup,
                            taxRulesGroupRateLookup: prepared.taxRulesGroupRateLookup,
                            taxRateToGroupIdLookup: prepared.taxRateToGroupIdLookup || {},
                        }
                    }

                    this.xmlData = convertRowsToIndividualXml(
                        this.selectedRessource,
                        rowsToImport,
                        this.columnMappings,
                        this.languageIds,
                        referenceLookups
                    )

                    if (!this.xmlData || !Array.isArray(this.xmlData) || this.xmlData.length === 0) {
                        this.showMessage('Le XML n’a pas pu être généré avec le mapping actuel', 'error')
                        return
                    }

                    for (let i = 0; i < this.xmlData.length; i++) {
                        const xml = this.xmlData[i]
                        const sourceRow = this.content.data[i] || {}
                        try {
                            const response = await insertResourceData(this.selectedRessource, xml)
                            results.success += 1
                            console.log(`Ligne ${i + 1} importée. Réponse:`, response)

                            // Pour les produits simples (non-variantes), créer automatiquement le stock
                            if (this.selectedRessource === 'products' && !this.hasVariantData()) {
                                try {
                                    const mappingLookup = this.columnMappings.reduce((acc, m) => {
                                        if (m.apiField && m.apiField !== 'no') {
                                            acc[m.csvColumn] = m.apiField
                                        }
                                        return acc
                                    }, {})

                                    let reference = ''
                                    let quantity = 0

                                    Object.entries(sourceRow).forEach(([csvCol, csvVal]) => {
                                        const apiField = mappingLookup[csvCol]
                                        if (apiField === 'reference') {
                                            reference = String(csvVal ?? '').trim()
                                        }
                                        if (apiField === 'quantity') {
                                            quantity = Number(String(csvVal ?? '').trim().replace(/,/g, '.')) || 0
                                        }
                                    })

                                    if (reference) {
                                        // Attendre que PrestaShop génère l'entrée stock_available
                                        await new Promise((resolve) => setTimeout(resolve, 800))
                                        await ensureSimpleProductStock(reference, quantity)
                                        console.log(`Stock du produit '${reference}' créé/mis à jour (quantité=${quantity})`)
                                    }
                                } catch (stockError) {
                                    console.warn(`Attention: stock du produit non créé pour ligne ${i + 1}:`, stockError)
                                }
                            }

                            await new Promise((resolve) => setTimeout(resolve, 300))
                        } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : String(error)
                            results.errors.push({ index: i, message: errorMsg })
                            console.error(`Erreur import ligne ${i + 1}:`, error)
                        }
                    }

                    if (this.selectedRessource === 'products' && results.success > 0) {
                        await Promise.all([
                            this.loadCategoryLookup(),
                            this.loadTaxRuleGroupsLookup()
                        ])
                    }
                }

                if (results.errors.length === 0) {
                    this.showMessage(`Import terminé : ${results.success} lignes importées`, 'success')
                } else {
                    // En cas d'erreurs, tenter de réinitialiser les ressources critiques
                    try {
                        const critical = ['customers', 'orders', 'products', 'combinations', 'carts']
                        console.warn('[IMPORT] Erreurs détectées, tentative de reset des ressources critiques')
                        const resetRes = await resetResources(critical)
                        console.log('[IMPORT] Résultats reset:', resetRes)
                    } catch (resetErr) {
                        console.error('[IMPORT] Échec du reset des ressources:', resetErr)
                    }

                    this.showMessage(`Import partiel : ${results.success} réussies, ${results.errors.length} erreurs`, 'error')
                    console.error('Détails erreurs:', results.errors)
                }
            } finally {
                this.isLoading = false
            }
        },

        showMessage(text, type) {
            this.message = text
            this.messageType = type
            // Effacer le message après 5 secondes
            setTimeout(() => {
                this.message = ''
            }, 5000)
        }
    }
}
</script>

<template>
    <div style="padding: 20px;">
        <h2>Import CSV vers API</h2>
        
        <div style="margin-bottom: 20px;">
            <label for="ressource-select"><strong>Étape 1 - Choisir une ressource :</strong></label>
            <select id="ressource-select" v-model="selectedRessource">
                <option value="" disabled>-- Sélectionnez --</option>
                <option v-for="r in ressources" :key="r.name + (r.id||r.url)" :value="r.name">
                    {{ r.name }}
                </option>
            </select>
            <button type="button" @click="loadSelectedRessource" :disabled="!selectedRessource">Charger</button>
            <button type="button" @click="deleteLastForSelectedResource" :disabled="!selectedRessource" style="margin-left:8px;">Supprimer toutes les données</button>
            <button type="button" @click="resetCriticalResources" style="margin-left:8px;">Reset ressources critiques</button>
        </div>

        <hr />

        <div style="margin-bottom: 20px;">
            <label for="file"><strong>Étape 2 - Importer un CSV :</strong></label>
            <input id="file" type="file" accept=".csv" @change="handleFileUpload" />
        </div>

        <div v-if="csvHeaders.length" style="margin-bottom: 20px;">
            <h3>Étape 3 - Faire le mapping</h3>
            <p style="margin-top: 0; color: #555;">CSV = colonnes brutes, champ API = nom technique envoyé à PrestaShop.</p>
            <table style="width: 100%; border-collapse: collapse; background: #fff;">
                <thead>
                    <tr>
                        <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px;">Colonne CSV</th>
                        <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 8px;">Champ PrestaShop</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="mapping in columnMappings" :key="mapping.csvColumn">
                        <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">{{ mapping.csvColumn }}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">
                            <select v-model="mapping.apiField" @change="refreshXmlPreview" style="min-width: 280px;">
                                <option v-for="field in getFieldOptions()" :key="field.value" :value="field.value">
                                    {{ field.label }}
                                </option>
                            </select>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="message" :style="{ 
            padding: '10px', 
            marginBottom: '20px', 
            borderRadius: '4px',
            backgroundColor: messageType === 'success' ? '#d4edda' : 
                            messageType === 'error' ? '#f8d7da' : '#d1ecf1',
            color: messageType === 'success' ? '#155724' : 
                  messageType === 'error' ? '#721c24' : '#0c5460'
        }">
            {{ message }}
        </div>

        <div v-if="parsed" style="margin-top: 20px;">
            <h3>Aperçu des données ({{ content.data.length }} lignes)</h3>
            <pre style="white-space:pre-wrap; max-height:300px; overflow:auto; background:#f5f5f5; padding:10px; border-radius:4px;">{{ content }}</pre>
            
            <hr style="margin: 20px 0;" />
            
            <h3>XML à envoyer</h3>
            <div v-if="xmlData && xmlData.length">
                <pre v-for="(xml, index) in xmlData" :key="index" style="white-space:pre-wrap; max-height:300px; overflow:auto; background:#f5f5f5; padding:10px; border-radius:4px; margin-bottom: 12px;">{{ xml }}</pre>
            </div>
            <p v-else style="color: #888;">Le XML sera généré à partir du mapping.</p>
            
            <hr style="margin: 20px 0;" />
            
            <div style="margin-top: 20px;">
                <h3>Étape 4 - Soumettre l'import</h3>
                <button 
                    type="button" 
                    @click="submitImport" 
                    :disabled="(!xmlData && selectedRessource !== 'orders') || !selectedRessource || isLoading"
                    style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;"
                >
                    {{ isLoading ? 'Envoi en cours...' : 'Envoyer vers l\'API' }}
                </button>
            </div>
        </div>
    </div>
</template>