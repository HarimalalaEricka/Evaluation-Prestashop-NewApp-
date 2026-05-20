import { buildProductImageUrl, getRessourceData, getRessourceItemById, getRessourceItemXmlShemaBlank, insertResourceData, setOrCreateXmlField } from './ressourcesService.js'
import { getCombinationValues } from './stockService.js'
import { insertCategory } from './categoryService.js'
import { insertTaxRule } from './taxService.js'

const ID_COUNTRY = import.meta.env.VITE_ID_COUNTRY

const categoryCache = new Map()
const taxRulesListCache = new Map()
const taxRuleCache = new Map()
const taxRateCache = new Map()

function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase()
}

function getMultilingualText(value) {
    if (!value) return ''

    if (typeof value === 'string') {
        return value
    }

    if (Array.isArray(value)) {
        const firstText = value.find((item) => typeof item === 'string' && item.trim())
        return firstText ?? ''
    }

    if (typeof value === 'object') {
        return value.language ?? value[1] ?? value.value ?? ''
    }

    return String(value)
}

function getProductPriceWithTax(product) {
    const basePrice = Number(product?.price ?? 0)
    const taxRate = Number(product?.tax_rate ?? 0)
    return basePrice * (1 + taxRate / 100)
}

function getMarqueFromAvailabilityDate(availableDate) {
    if (!availableDate || availableDate === '0000-00-00') {
        return ''
    }

    const today = new Date()
    const yesterday = new Date(today)
    const sevenDaysAgo = new Date(today)

    yesterday.setDate(yesterday.getDate() - 1)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const todayStr = today.toISOString().split('T')[0]
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    if (availableDate >= yesterdayStr && availableDate <= todayStr) {
        return 'HOT'
    }

    if (availableDate > sevenDaysAgoStr && availableDate < yesterdayStr) {
        return 'NEW'
    }

    return ''
}

async function getCategoryById(categoryId) {
    if (!categoryId) {
        return null
    }

    if (categoryCache.has(String(categoryId))) {
        return categoryCache.get(String(categoryId))
    }

    const category = await getRessourceItemById('categories', categoryId)
    categoryCache.set(String(categoryId), category)
    return category
}

async function buildProductDetailsList(productItems) {
    const productsDetails = []

    for (const product of productItems) {
        if (!product?.id) continue

        const productDetails = await getRessourceItemById('products', product.id)

        if (productDetails?.id_category_default) {
            const categorieDetail = await getCategoryById(productDetails.id_category_default)
            productDetails.categorie = categorieDetail?.name ?? null
        }

        productDetails.tax_rate = await getRateByTaxRulesGroupId(productDetails.id_tax_rules_group)
        productDetails.marque = getMarqueFromAvailabilityDate(productDetails.available_date)
        productDetails.imageUrl = buildProductImageUrl(productDetails)

        productsDetails.push(productDetails)
    }

    return productsDetails
}

function applyProductFilters(products, filters = {}) {
    const searchName = normalizeText(filters.name)
    const searchReference = normalizeText(filters.reference)
    const searchCategorie = normalizeText(filters.categorie)
    const minPrice = filters.min_price ?? filters.minPrice ?? null
    const maxPrice = filters.max_price ?? filters.maxPrice ?? null

    return products.filter((product) => {
        const productName = normalizeText(getMultilingualText(product?.name))
        const productReference = normalizeText(product?.reference)
        const productCategorie = normalizeText(getMultilingualText(product?.categorie))
        const priceWithTax = getProductPriceWithTax(product)

        const matchesName = searchName ? productName.includes(searchName) : true
        const matchesReference = searchReference ? productReference.includes(searchReference) : true
        const matchesCategorie = searchCategorie ? productCategorie.includes(searchCategorie) : true
        const matchesMinPrice = minPrice != null ? priceWithTax >= Number(minPrice) : true
        const matchesMaxPrice = maxPrice != null ? priceWithTax <= Number(maxPrice) : true

        return matchesName && matchesReference && matchesCategorie && matchesMinPrice && matchesMaxPrice
    })
}

export async function getProductsPage({ page = 1, perPage = 10, filters = {}, sort = 'id_ASC' } = {}) {
    const rawFilters = {}

    if (filters.reference) {
        rawFilters.reference = `[%${String(filters.reference).trim()}%]`
    }

    if (filters.name) {
        rawFilters.name = `[%${String(filters.name).trim()}%]`
    }

    const minPrice = filters.min_price ?? filters.minPrice
    const maxPrice = filters.max_price ?? filters.maxPrice
    if (minPrice != null || maxPrice != null) {
        rawFilters.price = {
            min: minPrice ?? '',
            max: maxPrice ?? '',
        }
    }

    const productItems = await getRessourceData('products', {
        display: ['id'],
        page,
        perPage: perPage + 1,
        sort,
        filters: rawFilters,
    })

    const hasMore = productItems.length > perPage
    const visibleItems = productItems.slice(0, perPage)
    const productsDetails = await buildProductDetailsList(visibleItems)

    return {
        items: applyProductFilters(productsDetails, filters),
        hasMore,
    }
}

export async function getAllProducts() {
    try {
        const perPage = 100
        let page = 1
        const products = []

        while (true) {
            const pageItems = await getRessourceData('products', {
                display: ['id'],
                page,
                perPage,
                sort: 'id_ASC',
            })

            if (!Array.isArray(pageItems) || pageItems.length === 0) {
                break
            }

            products.push(...pageItems)

            if (pageItems.length < perPage) {
                break
            }

            page += 1
        }

        return await buildProductDetailsList(products)
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getProductByIdProductWithTax(id_product)
{
    if( !id_product ) throw new Error('id_product required')
    const produit = []
    try {
        const product = await getRessourceItemById('products', id_product)
        product.tax_rate = await getRateByTaxRulesGroupId(product.id_tax_rules_group)
        produit.push(product)
    }
    catch ( error) {
        throw error instanceof Error? error: new Error(String(error))
    }
    return produit
}

export async function getRateByTaxRulesGroupId(id_tax_rules_group) {
    if (!id_tax_rules_group) throw new Error('id_tax_rules_group required2')

    const cacheKey = `group:${id_tax_rules_group}`
    if (taxRateCache.has(cacheKey)) {
        return taxRateCache.get(cacheKey)
    }

    try {
        const taxRule = await getTaxRuleByTaxRulesGroupId(id_tax_rules_group)
        if (!taxRule) {
            console.log('Tax rule not found for group', id_tax_rules_group)
            taxRateCache.set(cacheKey, 0)
            return 0
        }
        const rate = await getRateByTaxRule(taxRule)
        taxRateCache.set(cacheKey, rate)
        return rate
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getTaxRuleByTaxRulesGroupId(id_tax_rules_group, id_country = ID_COUNTRY) {
    if (!id_tax_rules_group) throw new Error('id_tax_rules_group required2')

    const cacheKey = `rule:${id_tax_rules_group}:${id_country}`
    if (taxRuleCache.has(cacheKey)) {
        return taxRuleCache.get(cacheKey)
    }

    try {
        let taxRules = taxRulesListCache.get('tax_rules')
        if (!taxRules) {
            taxRules = await getRessourceData('tax_rules')
            taxRulesListCache.set('tax_rules', taxRules)
        }

        for( const taxRule of taxRules) {
            const taxRuleDetails = await getRessourceItemById('tax_rules', taxRule.id)
            if (String(taxRuleDetails.id_tax_rules_group) === String(id_tax_rules_group) && String(taxRuleDetails.id_country) === String(id_country)) {
                taxRuleCache.set(cacheKey, taxRuleDetails)
                return taxRuleDetails
            }
        }
        taxRuleCache.set(cacheKey, null)
        return null
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getRateByTaxRule( taxRule ){
    if (!taxRule) throw new Error('taxRule required')

    const cacheKey = `tax:${taxRule.id_tax}`
    if (taxRateCache.has(cacheKey)) {
        return taxRateCache.get(cacheKey)
    }

    try {
        const tax = await getRessourceItemById('taxes', taxRule.id_tax)
        if (tax && tax.rate) {
            const rate = Number(tax.rate)
            taxRateCache.set(cacheKey, rate)
            return rate
        }
        taxRateCache.set(cacheKey, 2)
        return 2
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getMarqueByProductId(id_product, availableDate = null) 
{
    if (!id_product) throw new Error('id_product required')
    
    try {
        if (availableDate) {
            return getMarqueFromAvailabilityDate(availableDate)
        }

        const product = await getRessourceItemById('products', id_product)
        return getMarqueFromAvailabilityDate(product?.available_date)
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}


export async function FilterProducts(name, categorie, min_price, max_price)
{
    const allProducts = await getAllProducts()
    const searchName = normalizeText(name)
    const searchCategorie = normalizeText(categorie)

    return allProducts.filter((product) => {
        const productName = normalizeText(getMultilingualText(product?.name))
        const productCategorie = normalizeText(getMultilingualText(product?.categorie))
        const priceWithTax = getProductPriceWithTax(product)

        const matchesName = searchName ? productName.includes(searchName) : true
        const matchesCategorie = searchCategorie ? productCategorie.includes(searchCategorie) : true
        const matchesMinPrice = min_price != null ? priceWithTax >= Number(min_price) : true
        const matchesMaxPrice = max_price != null ? priceWithTax <= Number(max_price) : true
        return matchesName && matchesCategorie && matchesMinPrice && matchesMaxPrice
    })
}

export async function getQuantityAvailableByProductId(id_product)
{
    if (!id_product) throw new Error('id_product required')
    try {
        const stocks = await getRessourceData('stock_availables')
        for (const stock of stocks) {
            const stockDetail = await getRessourceItemById('stock_availables', stock.id)
            if( stockDetail.id_product == id_product && stockDetail.id_product_attribute == '0') {
                return Number(stockDetail.quantity ?? 0)
            }
        }
        return 0
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function getQuantityAvailableByProductIdAndAttribute(id_product)
{
    if (!id_product) throw new Error('id_product required')
    const quantity = []
    try{
        const stocks = await getRessourceData('stock_availables')
        for (const stock of stocks) {
            const stockDetail = await getRessourceItemById('stock_availables', stock.id)
            if( stockDetail.id_product == id_product && stockDetail.id_product_attribute != '0') {
                const combinationValues = await getCombinationValues(stockDetail.id_product_attribute)
                const groupeName = combinationValues.map( item=> item.groupe ).join(', ')
                const valueName = combinationValues.map( item=> item.valeur ).join(', ')
                const price = Number(combinationValues[0]?.pricePlus ?? combinationValues[0]?.price ?? 0)
                stockDetail.group = groupeName
                stockDetail.value = valueName
                stockDetail.price = price
                quantity.push(stockDetail)
            }
        }
        return quantity
    }catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

/**
 * Chercher une catégorie par nom
 * @param {string} categoryName - Nom de la catégorie
 * @returns {Promise<Object|null>} Catégorie trouvée ou null
 */
export async function getCategoryByName(categoryName) {
    if (!categoryName) return null
    
    try {
        const categories = await getRessourceData('categories')
        for (const category of categories) {
            const categoryDetail = await getRessourceItemById('categories', category.id)
            const name = getMultilingualText(categoryDetail?.name)
            if (normalizeText(name) === normalizeText(categoryName)) {
                return categoryDetail
            }
        }
        return null
    } catch (error) {
        console.error('[ProductService] Erreur lors de la recherche de catégorie:', error)
        return null
    }
}

/**
 * Chercher une taxe par pourcentage
 * @param {number|string} taxRate - Taux de taxe en pourcentage
 * @returns {Promise<Object|null>} Taxe trouvée ou null
 */
export async function getTaxByRate(taxRate) {
    if (!taxRate && taxRate !== 0) return null
    
    const normalizedRate = parseFloat(String(taxRate ?? '0').replace(/[^0-9.]/g, ''))
    
    try {
        const taxes = await getRessourceData('taxes')
        for (const tax of taxes) {
            const taxDetail = await getRessourceItemById('taxes', tax.id)
            if (parseFloat(String(taxDetail?.rate ?? '0')) === normalizedRate) {
                return taxDetail
            }
        }
        return null
    } catch (error) {
        console.error('[ProductService] Erreur lors de la recherche de taxe:', error)
        return null
    }
}

/**
 * Calculer le prix HT à partir du prix TTC
 * Formule: ttc = ht + (ht * taxe)/100
 * Donc: ht = ttc / (1 + taxe/100)
 * @param {number|string} priceTTC - Prix TTC
 * @param {number|string} taxRate - Taux de taxe en pourcentage
 * @returns {number} Prix HT
 */
function calculatePriceHT(priceTTC, taxRate) {
    const ttc = parseFloat(String(priceTTC ?? '0').replace(/,/g, '.'))
    const rate = parseFloat(String(taxRate ?? '0').replace(/[^0-9.]/g, ''))
    
    if (rate === 0 || !rate) {
        return ttc
    }
    
    return ttc / (1 + (rate / 100))
}

/**
 * Parser une date au format DD/MM/YYYY en ISO YYYY-MM-DD
 * @param {string} dateStr - Date au format DD/MM/YYYY
 * @returns {string} Date au format ISO YYYY-MM-DD
 */
function parseDate(dateStr) {
    const str = String(dateStr ?? '').trim()
    
    if (!str) return ''
    
    // Format ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str
    }
    
    // Format DD/MM/YYYY
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) {
        const [, day, month, year] = match
        return `${year}-${month}-${day}`
    }
    
    return str
}

async function insertProduct(productData) {
    const {
        date_availability_produit,
        nom,
        reference,
        prix_ttc,
        taxe,
        categorie,
        prix_achat
    } = productData

    if (!nom) throw new Error('nom (name) is required')

    // Chercher ou créer la catégorie
    let categoryId = null
    if (categorie) {
        try {
            const existingCategory = await getCategoryByName(categorie)
            if (existingCategory) {
                categoryId = existingCategory.id
                console.log(`[ProductService] Catégorie trouvée: ${categorie} (id: ${categoryId})`)
            } else {
                console.log(`[ProductService] Création de la catégorie: ${categorie}`)
                const newCategory = await insertCategory(categorie)
                categoryId = newCategory?.id || null
                console.log(`[ProductService] Catégorie créée (id: ${categoryId})`)
            }
        } catch (err) {
            console.error(`[ProductService] Erreur catégorie "${categorie}":`, err.message)
        }
    }

    // Chercher ou créer la taxe
    let taxRulesGroupId = null
    if (taxe) {
        try {
            const existingTax = await getTaxByRate(taxe)
            if (existingTax) {
                taxRulesGroupId = existingTax.id_tax_rules_group
                console.log(`[ProductService] Taxe trouvée: ${taxe}% (group id: ${taxRulesGroupId})`)
            } else {
                console.log(`[ProductService] Création de la taxe: ${taxe}%`)
                const newTax = await insertTaxRule(taxe)
                taxRulesGroupId = newTax?.id_tax_rules_group || null  
                console.log(`[ProductService] Taxe créée:`, newTax)
            }
        } catch (err) {
            console.error(`[ProductService] Erreur taxe "${taxe}":`, err.message)
        }
    }

    // Calculer le prix HT
    const priceHT = calculatePriceHT(prix_ttc, taxe)
    console.log(`[ProductService] Prix HT calculé: ${priceHT.toFixed(2)} (TTC: ${prix_ttc}, taxe: ${taxe}%)`)

    // Récupérer le template XML vide
    const blankProductXml = await getRessourceItemXmlShemaBlank('products')
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(blankProductXml, 'application/xml')
    const productNode = xmlDoc.getElementsByTagName('product')[0]
    if (!productNode) throw new Error('Invalid product XML schema')

    // Champs simples
    setOrCreateXmlField(productNode, 'price', String(priceHT.toFixed(2)), xmlDoc)
    setOrCreateXmlField(productNode, 'position_in_category', '1', xmlDoc)   // ← minimum 1
    setOrCreateXmlField(productNode, 'minimal_quantity', '1', xmlDoc)        // ← minimum 1
    setOrCreateXmlField(productNode, 'active', '1', xmlDoc)
    setOrCreateXmlField(productNode, 'state', '1', xmlDoc)

    if (reference) setOrCreateXmlField(productNode, 'reference', reference, xmlDoc)
    if (prix_achat) setOrCreateXmlField(productNode, 'wholesale_price', String(prix_achat), xmlDoc)
    if (date_availability_produit) setOrCreateXmlField(productNode, 'available_date', parseDate(date_availability_produit), xmlDoc)
    if (taxRulesGroupId) setOrCreateXmlField(productNode, 'id_tax_rules_group', String(taxRulesGroupId), xmlDoc)
    if (categoryId) setOrCreateXmlField(productNode, 'id_category_default', String(categoryId), xmlDoc)

    // Champs multilingues — cibler le <language> existant dans le schéma
    const multiLangFields = {
        name: nom,
        link_rewrite: nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), // ← requis par PrestaShop
        meta_title: nom,
    }

    for (const [field, value] of Object.entries(multiLangFields)) {
        const fieldNode = productNode.getElementsByTagName(field)[0]
        if (fieldNode) {
            const langNode = fieldNode.getElementsByTagName('language')[0]
            if (langNode) {
                while (langNode.firstChild) langNode.removeChild(langNode.firstChild)
                langNode.appendChild(xmlDoc.createCDATASection(String(value)))
            }
        }
    }

    const finalXml = new XMLSerializer().serializeToString(xmlDoc)
    console.log('[ProductService] XML produit envoyé:', finalXml.substring(0, 1000))

    try {
        const result = await insertResourceData('products', finalXml)
        console.log('[ProductService] Produit créé avec succès')
        return result
    } catch (err) {
        console.error('[ProductService] Erreur création produit:', err.message)
        throw err
    }
}

/**
 * Importer les produits du fichier 1
 * @param {XMLDocument} xmlDoc - Document XML parsé
 * @returns {Promise<Object>} Résultats de l'import
 */
export async function importProductsFile1(xmlDoc) {
    if (!xmlDoc) {
        throw new Error('xmlDoc is required')
    }

    const results = {
        success: [],
        errors: [],
        total: 0
    }

    try {
        // Chercher tous les éléments produits (variante du tag selon Prestashop)
        let productElements = xmlDoc.getElementsByTagName('product')
        
        if (productElements.length === 0) {
            throw new Error('Aucun élément produit trouvé dans le XML')
        }

        results.total = productElements.length

        console.log(`[ProductService] Importation de ${productElements.length} produit(s)`)

        for (let i = 0; i < productElements.length; i++) {
            const productElement = productElements[i]
            
            try {
                // Extraire les données du XML
                const productData = {}
                
                Array.from(productElement.children).forEach(child => {
                    const key = child.tagName
                    const value = child.textContent || ''
                    productData[key] = value
                })

                // Insérer le produit
                const result = await insertProduct(productData)
                
                results.success.push({
                    nom: productData.nom,
                    reference: productData.reference,
                    result
                })
            } catch (error) {
                console.error(`[ProductService] Erreur lors de l'insertion du produit ${i + 1}:`, error)
                results.errors.push({
                    row: i + 1,
                    error: error.message
                })
            }
        }

        console.log('[ProductService] Import terminé:', results)
        return results
    } catch (error) {
        console.error('[ProductService] Erreur globale lors de l\'import:', error)
        throw error
    }
}

// --- CSV import helpers ---
function parseCsvToObjects(csvText) {
    if (!csvText) return []

    const rows = []
    const parsedRows = []
    let cur = ''
    let row = []
    let inQuotes = false
    for (let i = 0; i < csvText.length; i++) {
        const ch = csvText[i]
        if (ch === '"') {
            if (inQuotes && csvText[i + 1] === '"') {
                cur += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
        } else if (ch === ',' && !inQuotes) {
            row.push(cur)
            cur = ''
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && csvText[i + 1] === '\n') i++
            row.push(cur)
            parsedRows.push(row)
            row = []
            cur = ''
        } else {
            cur += ch
        }
    }

    if (cur !== '' || row.length > 0) {
        row.push(cur)
        parsedRows.push(row)
    }

    if (parsedRows.length === 0) return []

    const headers = parsedRows[0].map((h) => String(h ?? '').trim())

    for (let i = 1; i < parsedRows.length; i++) {
        const r = parsedRows[i]
        if (r.every((c) => String(c ?? '').trim() === '')) continue
        const obj = {}
        for (let j = 0; j < headers.length; j++) {
            const key = String(headers[j] ?? '').trim()
            const raw = r[j] ?? ''
            const normKey = key.toLowerCase()
            obj[normKey] = String(raw ?? '').trim()
        }
        rows.push(obj)
    }

    return rows
}

/**
 * Importer des produits depuis un CSV (texte)
 * @param {string} csvText
 * @returns {Promise<Object>} résultats
 */
export async function importProductsFromCsv(csvText) {
    const results = { success: [], errors: [], total: 0 }

    try {
        const rows = parseCsvToObjects(csvText)
        results.total = rows.length

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            try {
                const productData = {
                    date_availability_produit: row['date_availability_produit'] || row['date_availability'] || row['available_date'],
                    nom: row['nom'] || row['name'] || row['product_name'],
                    reference: row['reference'],
                    prix_ttc: row['prix_ttc'] || row['price_ttc'] || row['prix'] || row['price'],
                    taxe: row['taxe'] || row['tax'] || row['taxe%'] || row['taxe %'] || row['taxe%'],
                    categorie: row['categorie'] || row['category'],
                    prix_achat: row['prix_achat'] || row['purchase_price'] || row['prixachat'] || row['wholesale_price'],
                }

                const res = await insertProduct(productData)
                results.success.push({ row: i + 1, nom: productData.nom, reference: productData.reference, result: res })
            } catch (err) {
                results.errors.push({ row: i + 1, error: err instanceof Error ? err.message : String(err) })
            }
        }

        return results
    } catch (err) {
        throw err instanceof Error ? err : new Error(String(err))
    }
}
