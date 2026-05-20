const BASE_URL = import.meta.env.VITE_API_PROXY_PATH
const SHOP_BASE_URL = String(import.meta.env.VITE_API_URL_BACKEND ?? '')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')
const API_KEY = import.meta.env.VITE_API_KEY
const REQUEST_TIMEOUT_MS = 10000

// Header pour appele l API_KEY
export function getAuthHeaders() {
    if (!API_KEY) {
        return {}
    }

    return {
        Authorization: `Basic ${btoa(`${API_KEY}:`)}`,
    }
}

function getResourceUrl(resourceElement) {
    return (
        resourceElement.getAttribute('xlink:href') ||
        resourceElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        resourceElement.getAttribute('href') ||
        ''
    )
}

function extractFirstScalar(value) {
    if (value == null) {
        return ''
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const extracted = extractFirstScalar(item)
            if (extracted) {
                return extracted
            }
        }

        return ''
    }

    if (typeof value === 'object') {
        const preferredKeys = ['id_default_image', 'id_image', 'id', 'image', 'value']

        for (const key of preferredKeys) {
            if (value[key] != null) {
                const extracted = extractFirstScalar(value[key])
                if (extracted) {
                    return extracted
                }
            }
        }

        for (const nestedValue of Object.values(value)) {
            const extracted = extractFirstScalar(nestedValue)
            if (extracted) {
                return extracted
            }
        }

        return ''
    }

    return String(value).trim()
}

function buildImagePathFromId(imageId) {
    const cleanedImageId = String(imageId ?? '').trim()

    if (!cleanedImageId) {
        return ''
    }

    return `${cleanedImageId.split('').join('/')}/${cleanedImageId}`
}

export function buildProductImageUrl(product, size = 'home_default') {
    const cleanedProductId = String(product?.id ?? '').trim()
    if (!cleanedProductId || !SHOP_BASE_URL) {
        return ''
    }

    const imageId = extractFirstScalar(
        product?.id_default_image
        ?? product?.id_image
        ?? product?.associations?.images?.image
        ?? product?.associations?.image
        ?? product?.image
    )

    if (!imageId) {
        return ''
    }

    const imagePath = buildImagePathFromId(imageId)
    if (!imagePath) {
        return ''
    }

    return `${SHOP_BASE_URL}/img/p/${imagePath}-${size}.jpg`
}

// Singulariser les noms de ressources pour trouver les balises d'items (ex: categories → category, products → product, etc)
function singularizeResourceName(pluralName) {
    const specialCases = {
        categories: 'category',
        categoriess: 'category',
        order_states: 'order_state',
        tax_rules: 'tax_rule',
        stock_availables: 'stock_available',
        product_option_values: 'product_option_value',
        stock_movements: 'stock_mvt',
    }

    if (specialCases[pluralName]) {
        return specialCases[pluralName]
    }

    // ies → y (categories → category)
    if (pluralName.endsWith('ies')) {
        return pluralName.slice(0, -3) + 'y'
    }

    // es → (addresses → address)
    if (pluralName.endsWith('es')) {
        return pluralName.slice(0, -2)
    }

    // s → (products → product)
    if (pluralName.endsWith('s')) {
        return pluralName.slice(0, -1)
    }

    return pluralName
}

// parser le XML de la liste des ressources ou des items d'une ressource en tableau d'objets { name, url, id }
function parseResourcesFromXml(xmlDoc, containerTagName, itemTagName = null) {
    const containerNode = xmlDoc.getElementsByTagName(containerTagName)[0]

    if (!containerNode) {
        return []
    }

    // Si itemTagName est fourni, chercher les enfants de ce nom
    // Sinon, prendre tous les enfants directs sauf script/description/schema
    const childrenToProcess = itemTagName
        ? Array.from(containerNode.getElementsByTagName(itemTagName))
        : Array.from(containerNode.children)

    return childrenToProcess
        .filter((resourceElement) => resourceElement.tagName !== 'description' && resourceElement.tagName !== 'schema' && resourceElement.tagName !== 'script')
        .map((resourceElement) => ({
        name: resourceElement.tagName,
        url: getResourceUrl(resourceElement),
        id: resourceElement.getAttribute('id') || null,
        }))
}

export function getHttpErrorMessage(status) {
    if (status === 401 || status === 403) {
        return 'Erreur authentification API'
    }

    if (status === 404) {
        return 'Ressource inaccessible'
    }

    return 'Erreur ' + status
}

function extractResourceItemId(resourceItem) {
    if (!resourceItem || typeof resourceItem !== 'object') {
        return ''
    }

    const directId = String(resourceItem.id ?? '').trim()
    if (directId) {
        return directId
    }

    const resourceUrl = String(resourceItem.url ?? resourceItem.href ?? '').trim()
    if (!resourceUrl) {
        return ''
    }

    const match = resourceUrl.match(/\/(\d+)(?:\/?$)/)
    return match ? match[1] : ''
}

async function deleteResourceById(resourceName, id) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const base = BASE_URL.replace(/\/$/, '')
        const url = `${base}/${resourceName}/${id}`

        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                ...getAuthHeaders(),
            },
            signal: controller.signal,
        })

        if (!res.ok) {
            throw new Error(getHttpErrorMessage(res.status))
        }

        return true
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error instanceof Error ? error : new Error(String(error))
    } finally {
        window.clearTimeout(timeoutId)
    }
}

export async function deleteCriticalResourcesData() {
    const resourcesToDelete = [
        { resourceName: 'taxes', label: 'tax' },
        { resourceName: 'tax_rules', label: 'tax_rule' },
        { resourceName: 'tax_rule_groups', label: 'tax_rules_group' },
        { resourceName: 'categories', label: 'categories', keepIds: ['1', '2'] },
        { resourceName: 'customers', label: 'customers' },
        { resourceName: 'addresses', label: 'addresses' },
        { resourceName: 'orders', label: 'orders' },
        { resourceName: 'order_histories', label: 'order_history' },
        { resourceName: 'products', label: 'products' },
        { resourceName: 'carts', label: 'carts' },
        { resourceName: 'order_details', label: 'order_details' },
        { resourceName: 'order_payments', label: 'order_payments' },
    ]

    const results = []

    for (const resource of resourcesToDelete) {
        const summary = {
            resource: resource.resourceName,
            label: resource.label,
            deleted: [],
            skipped: [],
            errors: [],
            deletedCount: 0,
            skippedCount: 0,
            errorCount: 0,
            totalCount: 0,
        }

        try {
            const items = await getRessourceData(resource.resourceName)
            const ids = items
                .map((item) => extractResourceItemId(item))
                .filter(Boolean)

            const idsToDelete = resource.keepIds && resource.keepIds.length > 0
                ? ids.filter((id) => !resource.keepIds.includes(String(id)))
                : ids

            summary.totalCount = ids.length
            summary.skipped = ids.filter((id) => resource.keepIds && resource.keepIds.includes(String(id)))
            summary.skippedCount = summary.skipped.length

            for (const id of idsToDelete) {
                try {
                    await deleteResourceById(resource.resourceName, id)
                    summary.deleted.push(id)
                } catch (error) {
                    summary.errors.push({
                        id,
                        message: error instanceof Error ? error.message : String(error),
                        timestamp: new Date().toISOString(),
                    })
                }
            }

            summary.deletedCount = summary.deleted.length
            summary.errorCount = summary.errors.length
        } catch (error) {
            summary.errors.push({
                id: null,
                message: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            })
            summary.errorCount = summary.errors.length
        }

        results.push(summary)
    }

    return results
}

// maka anle /api/ rehetra
export async function getRessources() {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res

    try {
        res = await fetch(`${BASE_URL}/`, {
        // ito le manome authorization header raha misy API key, raha tsy misy dia tsy asiana
        headers: {
            ...getAuthHeaders(),
        },
        signal: controller.signal,
        })
    } catch (error) {
        if (error.name === 'AbortError') {
        throw new Error('Timeout API')
        }

        throw new Error('Erreur réseau API')
    } finally {
        window.clearTimeout(timeoutId)
    }

    if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

    const xmlText = await res.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        throw new Error('Erreur parsing XML')
    }

    return parseResourcesFromXml(xmlDoc, 'api')
}

// maka ny data anle ressource manokana (ohatra products, categories, etc)
export async function getRessourceData(ressourceName, options = {}) {
    const itemTagName = singularizeResourceName(ressourceName)

    const fetchPage = async (queryOptions = {}) => {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
        const queryParams = buildCollectionQueryParams(queryOptions)
        const queryString = queryParams.toString()

        let res

        try {
            res = await fetch(queryString ? `${BASE_URL}/${ressourceName}?${queryString}` : `${BASE_URL}/${ressourceName}`, {
                headers: {
                    ...getAuthHeaders(),
                },
                signal: controller.signal,
            })
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Timeout API')
            }

            throw new Error('Erreur réseau API')
        } finally {
            window.clearTimeout(timeoutId)
        }

        if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

        const xmlText = await res.text()
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

        if (xmlDoc.documentElement.nodeName === 'parsererror') {
            throw new Error('Erreur parsing XML')
        }

        return parseResourcesFromXml(xmlDoc, 'prestashop', itemTagName)
    }

    const hasExplicitPagination = Number(options.page ?? 0) > 0 || Number(options.perPage ?? 0) > 0 || Number(options.limit ?? 0) > 0

    if (hasExplicitPagination) {
        return await fetchPage(options)
    }

    const perPage = 100
    const maxPages = 200
    const allItems = []

    for (let page = 1; page <= maxPages; page += 1) {
        const pageItems = await fetchPage({
            ...options,
            page,
            perPage,
        })

        if (!Array.isArray(pageItems) || pageItems.length === 0) {
            break
        }

        allItems.push(...pageItems)

        if (pageItems.length < perPage) {
            break
        }
    }

    return allItems
}

// récupérer le schéma (structure) d'une ressource via ?schema=blank
export async function getRessourceSchema(ressourceName) {
    if (!ressourceName) throw new Error('resourceName required')

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res

    try {
        res = await fetch(`${BASE_URL}/${ressourceName}?schema=blank`, {
            headers: {
                ...getAuthHeaders(),
            },
            signal: controller.signal,
        })
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw new Error('Erreur réseau API')
    } finally {
        window.clearTimeout(timeoutId)
    }

    if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

    const xmlText = await res.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        throw new Error('Erreur parsing XML')
    }

    // chercher le premier élément d'exemple de la ressource (singulier)
    const itemTagName = singularizeResourceName(ressourceName)
    const items = xmlDoc.getElementsByTagName(itemTagName)

    if (!items || items.length === 0) {
        // fallback: essayer le nom tel quel
        const tryDirect = xmlDoc.getElementsByTagName(ressourceName)
        if (!tryDirect || tryDirect.length === 0) return []
        const firstDirect = tryDirect[0]
        return Array.from(firstDirect.children).map((c) => c.tagName).filter(Boolean)
    }

    const first = items[0]

    // retourner les noms des champs enfants (ex: name, description, price...)
    const childNames = Array.from(first.children)
        .map((c) => c.tagName)
        .filter((n, i, arr) => n && arr.indexOf(n) === i) // unique

    return childNames
}

// tramsforme les donnees en tableau en xml a envoyer a prestashop 
export function convertCsvDataToXml(resourceName, rows, languages = [1]) {
    if (!resourceName) {
        throw new Error('resourceName required')
    }

    if (!Array.isArray(rows)) {
        throw new Error('rows must be an array')
    }

    const resource = resourceName.endsWith('s')
        ? resourceName.slice(0, -1)
        : resourceName

    const multilingualFields = [
        'name',
        'description',
        'description_short',
        'link_rewrite',
        'meta_title',
        'meta_description',
        'meta_keywords',
        'available_now',
        'available_later'
    ]

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`
    xml += `
            <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
            `

                rows.forEach(row => {

                    xml += `<${resource}>`

                    Object.entries(row).forEach(([key, value]) => {

                        if (value === undefined || value === null) {
                            value = ''
                        }

                        // Champs multilingues
                        if (multilingualFields.includes(key)) {

                            xml += `<${key}>`

                            languages.forEach(langId => {

                                xml += `
            <language id="${langId}">
            <![CDATA[${value}]]>
            </language>
            `
                            })

                            xml += `</${key}>`
                        }
                        else {

                            xml += `
            <${key}>
            <![CDATA[${value}]]>
            </${key}>
            `
                        }
                    })

                    xml += `</${resource}>`
                })

                xml += `
            </prestashop>
            `

    return xml
}

function formatCollectionQueryValue(value) {
    if (value == null || value === '') {
        return null
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => String(item ?? '').trim()).join(',')}]`
    }

    if (typeof value === 'object') {
        const minValue = value.min ?? value.from ?? ''
        const maxValue = value.max ?? value.to ?? ''
        return `[${String(minValue ?? '').trim()},${String(maxValue ?? '').trim()}]`
    }

    const stringValue = String(value).trim()
    if (!stringValue) {
        return null
    }

    if (stringValue.startsWith('[') && stringValue.endsWith(']')) {
        return stringValue
    }

    return `[${stringValue}]`
}

function buildCollectionQueryParams(options = {}) {
    const params = new URLSearchParams()

    const display = options.display
    if (display) {
        if (Array.isArray(display)) {
            params.set('display', `[${display.join(',')}]`)
        } else {
            params.set('display', String(display))
        }
    }

    const page = Number(options.page ?? 0)
    const perPage = Number(options.perPage ?? 0)
    if (page > 0 && perPage > 0) {
        const offset = Math.max(0, (page - 1) * perPage)
        params.set('limit', `${offset},${perPage}`)
    } else if (Number(options.limit ?? 0) > 0) {
        params.set('limit', String(options.limit))
    }

    if (options.sort) {
        params.set('sort', String(options.sort))
    }

    const filters = options.filters && typeof options.filters === 'object'
        ? options.filters
        : {}

    for (const [fieldName, fieldValue] of Object.entries(filters)) {
        const formattedValue = formatCollectionQueryValue(fieldValue)
        if (!formattedValue) {
            continue
        }

        params.set(`filter[${fieldName}]`, formattedValue)
    }

    return params
}

export function convertRowsToIndividualXml(resourceName, rows, columnMappings = [], languages = [1], referenceLookups = {}) {
    if (!resourceName) {
        throw new Error('resourceName required')
    }

    if (!Array.isArray(rows)) {
        throw new Error('rows must be an array')
    }

    const resource = singularizeResourceName(resourceName)
    const normalizedResource = resource.toLowerCase()

    const fieldTransformers = {
        createMultiLangField: (value, langIds) => ({
            isMultilingual: true,
            languages: langIds.map((langId) => ({
                id: langId,
                value: String(value ?? '')
            }))
        }),
        getBoolean: (value) => {
            const normalized = String(value ?? '').trim().toLowerCase()
            const truthyValues = ['1', 'true', 'yes', 'on']

            return {
                isMultilingual: false,
                value: truthyValues.includes(normalized) ? '1' : '0'
            }
        },
        getPrice: (value) => ({
            isMultilingual: false,
            value: String(value ?? '0')
                .replace(/,/g, '.')
                .replace(/%/g, '')
        }),
        simple: (value) => ({
            isMultilingual: false,
            value: String(value ?? '')
        })
    }

    const fieldConfig = {
        name: 'createMultiLangField',
        description: 'createMultiLangField',
        description_short: 'createMultiLangField',
        link_rewrite: 'createMultiLangField',
        meta_title: 'createMultiLangField',
        meta_description: 'createMultiLangField',
        meta_keywords: 'createMultiLangField',
        available_now: 'createMultiLangField',
        available_later: 'createMultiLangField',
        active: 'getBoolean',
        online_only: 'getBoolean',
        price_tex: 'getPrice',
        price_tin: 'getPrice',
        price: 'getPrice',
        reduction_price: 'getPrice',
        reduction_percent: 'getPrice',
        wholesale_price: 'getPrice',
        ecotax: 'getPrice',
        tax_rate: 'getPrice'
    }
    // valeur par defaut au cas ou hoe tsy apetraka leizy
    const defaultValues = {
        category: {
            active: '1',
            id_parent: '2',
            id_shop_default: '1',
            link_rewrite: ''
        },
        product: {
            active: '1',
            id_shop_default: '1',
            state: '1',
            show_price: '1',
            available_for_order: '1',
            visibility: 'both',
            on_sale: '0'
        }
    }

    const multilingualFields = new Set([
        'name',
        'description',
        'description_short',
        'link_rewrite',
        'meta_title',
        'meta_description',
        'meta_keywords',
        'available_now',
        'available_later'
    ])

    const slugify = (value) => String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    const parseDecimal = (value) => {
        const normalized = String(value ?? '')
            .trim()
            .replace(/\s+/g, '')
            .replace(/%/g, '')
            .replace(/,/g, '.')

        if (!normalized) {
            return null
        }

        const parsed = Number(normalized)
        return Number.isFinite(parsed) ? parsed : null
    }

    const parseDate = (value) => {
        const cleaned = String(value ?? '').trim()

        if (!cleaned) {
            return null
        }

        const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (isoMatch) {
            return cleaned
        }

        const slashMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (slashMatch) {
            const [, day, month, year] = slashMatch
            return `${year}-${month}-${day}`
        }

        const date = new Date(cleaned)
        if (Number.isNaN(date.getTime())) {
            return cleaned
        }

        const year = String(date.getFullYear())
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const formatDecimal = (value) => {
        if (!Number.isFinite(value)) {
            return '0'
        }

        return String(Math.round((value + Number.EPSILON) * 1000000) / 1000000)
    }

    const mappingLookup = Array.isArray(columnMappings)
        ? columnMappings.reduce((accumulator, mapping) => {
            if (!mapping || !mapping.csvColumn) {
                return accumulator
            }

            const apiField = String(mapping.apiField ?? '').trim()
            if (!apiField || apiField === 'no') {
                return accumulator
            }

            accumulator[mapping.csvColumn] = apiField
            return accumulator
        }, {})
        : {}

    const normalizeLookupKey = (value) => String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '')

    const normalizeRateKey = (value) => String(value ?? '')
        .trim()
        .replace(/%/g, '')
        .replace(/,/g, '.')
        .replace(/\s+/g, '')

    const splitCategoryValues = (value) => String(value ?? '')
        .split(/[,;|]/g)
        .map((item) => item.trim())
        .filter(Boolean)

    const resolveCategoryId = (value) => {
        const cleanedValue = String(value ?? '').trim()
        if (!cleanedValue) {
            return ''
        }

        if (/^\d+$/.test(cleanedValue)) {
            return cleanedValue
        }

        const categoryLookup = referenceLookups.categoryNameLookup || {}
        const normalizedValue = normalizeLookupKey(cleanedValue)

        return categoryLookup[normalizedValue] || ''
    }

    function transformField(fieldName, value, langIds) {
        const keyNorm = String(fieldName).replace(/\s+/g, '').toLowerCase()

        if (keyNorm === 'id') {
            return null
        }

        const transformerName = fieldConfig[fieldName] || 'simple'
        const transformer = fieldTransformers[transformerName]

        if (!transformer) {
            throw new Error(`Transformateur inconnu: ${transformerName}`)
        }

        return transformer(value, langIds)
    }

    return rows.map((row) => {
        const rowFields = {
            ...defaultValues[normalizedResource]
        }
        let rawName = ''
        let rawPriceTtc = null
        let rawPriceHt = null
        let rawWholesalePrice = null
        let rawTaxRulesGroupId = null
        let rawTaxRate = null

        Object.entries(row).forEach(([csvColumn, csvValue]) => {
            const apiField = mappingLookup[csvColumn]

            if (!apiField) {
                return
            }

            const normalizedCsvColumn = normalizeLookupKey(csvColumn)

            if (normalizedResource === 'product' && (apiField === 'categories' || apiField === 'category' || apiField === 'id_category_default')) {
                const categoryIds = splitCategoryValues(csvValue)
                    .map(resolveCategoryId)
                    .filter(Boolean)

                if (apiField === 'id_category_default') {
                    const defaultCategoryId = categoryIds[0] || resolveCategoryId(csvValue)
                    if (defaultCategoryId) {
                        rowFields.id_category_default = defaultCategoryId
                        rowFields.associations = rowFields.associations || {}
                        rowFields.associations.categories = rowFields.associations.categories || [{ id: defaultCategoryId }]
                    }
                } else if (categoryIds.length > 0) {
                    rowFields.id_category_default = rowFields.id_category_default || categoryIds[0]
                    rowFields.associations = rowFields.associations || {}
                    rowFields.associations.categories = categoryIds.map((id) => ({ id }))
                }

                return
            }

            if (normalizedResource === 'product' && (apiField === 'tax_rate' || apiField === 'Taxe' || apiField === 'taxe')) {
                rawTaxRate = csvValue
                return
            }

            if (normalizedResource === 'product' && apiField === 'id_tax_rules_group') {
                rawTaxRulesGroupId = csvValue
            }

            if (normalizedResource === 'product' && apiField === 'price') {
                if (normalizedCsvColumn.includes('prix_ttc') || normalizedCsvColumn.includes('ttc')) {
                    rawPriceTtc = csvValue
                    return
                }

                rawPriceHt = csvValue
                return
            }

            if (normalizedResource === 'product' && apiField === 'wholesale_price') {
                rawWholesalePrice = csvValue
            }

            if (normalizedResource === 'product' && apiField === 'available_date') {
                rowFields[apiField] = {
                    isMultilingual: false,
                    value: parseDate(csvValue) || ''
                }
                return
            }

            const transformed = transformField(apiField, csvValue, languages)

            if (transformed === null) {
                return
            }

            rowFields[apiField] = transformed

            if (apiField === 'name') {
                rawName = String(csvValue ?? '')
            }
        })

        if (normalizedResource === 'product') {
            const explicitPrice = parseDecimal(rawPriceHt)
            const ttcPrice = parseDecimal(rawPriceTtc)
            let resolvedTaxRulesGroupId = String(rawTaxRulesGroupId ?? '').trim()

            if (!resolvedTaxRulesGroupId && rawTaxRate) {
                resolvedTaxRulesGroupId = referenceLookups.taxRateToGroupIdLookup?.[normalizeRateKey(rawTaxRate)] || ''
            }

            if (resolvedTaxRulesGroupId) {
                rowFields.id_tax_rules_group = resolvedTaxRulesGroupId
            }

            const lookupTaxRate = resolvedTaxRulesGroupId
                ? parseDecimal(referenceLookups.taxRulesGroupRateLookup?.[resolvedTaxRulesGroupId])
                : null
            const taxRate = parseDecimal(rawTaxRate) ?? lookupTaxRate ?? 0

            if (explicitPrice !== null) {
                rowFields.price = {
                    isMultilingual: false,
                    value: formatDecimal(explicitPrice)
                }
            } else if (ttcPrice !== null) {
                const taxFactor = 1 + (taxRate / 100)
                const htPrice = taxRate > 0 && taxFactor > 0 ? (ttcPrice / taxFactor) : ttcPrice
                rowFields.price = {
                    isMultilingual: false,
                    value: formatDecimal(htPrice)
                }
            }

            if (rawWholesalePrice !== null && rowFields.wholesale_price === undefined) {
                rowFields.wholesale_price = {
                    isMultilingual: false,
                    value: formatDecimal(parseDecimal(rawWholesalePrice) ?? 0)
                }
            }
        }

        if (normalizedResource === 'category' && !rowFields.link_rewrite) {
            const sourceName = rawName || (rowFields.name && rowFields.name.isMultilingual
                ? rowFields.name.languages[0]?.value
                : '')

            rowFields.link_rewrite = fieldTransformers.createMultiLangField(slugify(sourceName), languages)
        }

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
        xml += `<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n`
        xml += `<${resource}>`

        Object.entries(rowFields).forEach(([fieldName, fieldValue]) => {
            if (fieldName === 'associations' || fieldName === 'tax_rate') {
                return
            }

            if (fieldValue === undefined || fieldValue === null) {
                return
            }

            if (multilingualFields.has(fieldName) && fieldValue.isMultilingual) {
                xml += `\n<${fieldName}>`
                fieldValue.languages.forEach(({ id, value: langValue }) => {
                    xml += `\n  <language id="${id}"><![CDATA[${langValue}]]></language>`
                })
                xml += `\n</${fieldName}>`
                return
            }

            if (typeof fieldValue === 'object' && fieldValue !== null && 'value' in fieldValue) {
                xml += `\n<${fieldName}><![CDATA[${fieldValue.value}]]></${fieldName}>`
                return
            }

            xml += `\n<${fieldName}><![CDATA[${fieldValue}]]></${fieldName}>`
        })

        if (normalizedResource === 'product' && rowFields.associations && Array.isArray(rowFields.associations.categories) && rowFields.associations.categories.length > 0) {
            xml += `\n<associations>`
            xml += `\n  <categories>`
            rowFields.associations.categories.forEach(({ id }) => {
                if (!id) {
                    return
                }

                xml += `\n    <category>`
                xml += `\n      <id><![CDATA[${id}]]></id>`
                xml += `\n    </category>`
            })
            xml += `\n  </categories>`
            xml += `\n</associations>`
        }

        xml += `\n</${resource}>\n</prestashop>`

        return xml
    })
}

function xmlNodeToObject(node) {
    // Pas d'enfants => valeur texte
    if (!node.children.length) {
        return node.textContent.trim()
    }

    const result = {}

    Array.from(node.children).forEach(child => {
        const key = child.tagName
        const value = xmlNodeToObject(child)

        // gérer les tableaux (plusieurs balises identiques)
        if (result[key]) {
            if (!Array.isArray(result[key])) {
                result[key] = [result[key]]
            }
            result[key].push(value)
        } else {
            result[key] = value
        }
    })

    return result
}


// récupérer un élément (par id) d'une ressource (ex: customers/3)
export async function getRessourceItemById(resourceName, id) {
    if (!resourceName) throw new Error('resourceName required')
    if (id == null) throw new Error('id required')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
        controller.abort()
    }, REQUEST_TIMEOUT_MS)

    try {
        const res = await fetch(`${BASE_URL}/${resourceName}/${id}?display=full`, {
            headers: getAuthHeaders(),
            signal: controller.signal
        })

        if (!res.ok) {
            throw new Error(getHttpErrorMessage(res.status))
        }

        const xmlText = await res.text()

        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Erreur parsing XML')
        }

        const itemTag = singularizeResourceName(resourceName)
        const itemNode = xmlDoc.getElementsByTagName(itemTag)[0]

        if (!itemNode) {
            throw new Error(`${itemTag} introuvable`)
        }

        return xmlNodeToObject(itemNode)

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

// {
//   id: "24",
//   id_default_group: "2",
//   id_lang: "1",
//   lastname: "Randrianomena",
//   firstname: "Harimalala",
//   email: "harimalalaerickarandria@gmail.com",
//   active: "1",
//   is_guest: "1",
//   associations: {
//     groups: {
//       group: {
//         id: "2"
//       }
//     }
//   }
// }
// customer.associations.groups.group.id

export async function updateResourceData(resourceName, resourceId, xmlData)
{
    if (!resourceName) {
        throw new Error('resourceName required')
    }

    if (!resourceId) {
        throw new Error('resourceId required')
    }

    if (!xmlData) {
        throw new Error('xml data required')
    }

    const controller = new AbortController()

    const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    )

    try {
        const base = BASE_URL.replace(/\/$/, '')
        const url = `${base}/${resourceName}/${resourceId}`

        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/xml',
                ...getAuthHeaders(),
            },
            body: xmlData,
            signal: controller.signal,
        })

        if (!res.ok) {
            const statusText = `${res.status} ${res.statusText}`
            const errorText = await res.text()
            try {
                console.error(`[API] PUT ${url} failed: ${statusText}`)
                console.error('[API] Response body:', errorText)
                console.error('[API] Payload (truncated):', String(xmlData ?? '').slice(0, 2000))
            } catch (e) {
                // ignore logging errors
            }
            throw new Error(`API PUT ${statusText}: ${String(errorText).slice(0, 2000)}`)
        }

        return await res.text()
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error instanceof Error
            ? error
            : new Error(String(error))
    } finally {
        window.clearTimeout(timeoutId)
    }
}
export async function patchResourceData(resourceName, resourceId, xmlData)
{
    if (!resourceName) {
        throw new Error('resourceName required')
    }
    
    if (!resourceId) {
        throw new Error('resourceId required')
    }
    
    if (!xmlData) {
        throw new Error('xml data required')
    }
    
    const controller = new AbortController()
    
    const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    )
    
    try {
        const base = BASE_URL.replace(/\/$/, '')
        const url = `${base}/${resourceName}/${resourceId}`
        
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/xml',
                ...getAuthHeaders(),
            },
            body: xmlData,
            signal: controller.signal,
        })
        
        if (!res.ok) {
            const statusText = `${res.status} ${res.statusText}`
            const errorText = await res.text()
            try {
                console.error(`[API] PATCH ${url} failed: ${statusText}`)
                console.error('[API] Response body:', errorText)
                console.error('[API] Payload (truncated):', String(xmlData ?? '').slice(0, 2000))
            } catch (e) {
                // ignore logging errors
            }
            throw new Error(`API PATCH ${statusText}: ${String(errorText).slice(0, 2000)}`)
        }
        
        return await res.text()
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }
        
        throw error instanceof Error
            ? error
            : new Error(String(error))
    } finally {
        window.clearTimeout(timeoutId)
    }
}

// récupérer l'XML brut d'un élément (utile pour reconstruire et PUT sans perdre de champs)
export async function getRessourceItemXml(resourceName, id) {
    if (!resourceName) throw new Error('resourceName required')
    if (id == null) throw new Error('id required')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const res = await fetch(`${BASE_URL}/${resourceName}/${id}`, {
            headers: getAuthHeaders(),
            signal: controller.signal
        })

        if (!res.ok) {
            throw new Error(getHttpErrorMessage(res.status))
        }

        return await res.text()
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

export async function getRessourceItemXmlShemaBlank(resourceName) {
    if (!resourceName) throw new Error('resourceName required')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const res = await fetch(`${BASE_URL}/${resourceName}?schema=blank`, {
            headers: getAuthHeaders(),
            signal: controller.signal
        })

        if (!res.ok) {
            throw new Error(getHttpErrorMessage(res.status))
        }

        return await res.text()
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

export async function insertResourceData(resourceName, xmlData)
{
    if (!resourceName) {
        throw new Error('resourceName required')
    }

    if (!xmlData) {
        throw new Error('xml data required')
    }

    const controller = new AbortController()

    const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    )

    try {

        const base = BASE_URL.replace(/\/$/, '')
        const url = `${base}/${resourceName}`

        const res = await fetch(url, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/xml',
                ...getAuthHeaders(),
            },

            body: xmlData,

            signal: controller.signal,
        })

        if (!res.ok) {
            const statusText = `${res.status} ${res.statusText}`
            const errorText = await res.text()
            try {
                console.error(`[API] POST ${url} failed: ${statusText}`)
                console.error('[API] Response body:', errorText)
                console.error('[API] Payload (truncated):', String(xmlData ?? '').slice(0, 2000))
                // If this is an order payload, also print full payload and response headers
                if ((resourceName && resourceName.toString().includes('orders')) || String(xmlData ?? '').includes('<order>')) {
                    try {
                        console.error('[API] Full Payload:', String(xmlData ?? ''))
                    } catch (e) {
                        // ignore
                    }

                    try {
                        const headers = {}
                        res.headers.forEach((v, k) => { headers[k] = v })
                        console.error('[API] Response headers:', JSON.stringify(headers, null, 2))
                    } catch (e) {
                        // ignore
                    }
                }
            } catch (e) {
                // ignore logging errors
            }
            throw new Error(`API POST ${statusText}: ${String(errorText).slice(0, 2000)}`)
        }

        return await res.text()
    }
    catch(error) {

        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error instanceof Error
            ? error
            : new Error(String(error))
    }
    finally {
        window.clearTimeout(timeoutId)
    }
}

export function setOrCreateXmlField(parentNode, fieldName, value, xmlDoc) {
    let element = parentNode.getElementsByTagName(fieldName)[0]
    
    if (!element) {
        element = xmlDoc.createElement(fieldName)      // Créer
        parentNode.appendChild(element)                 // Ajouter au parent
    } else {
        // Vider s'il y avait déjà du contenu
        while (element.firstChild) {
            element.removeChild(element.firstChild)
        }
    }
    
    element.appendChild(xmlDoc.createCDATASection(String(value)))
    return element
}

// ─── Gestion des images produits ──────────────────────────────────────────

export async function getProductByReferenceForImage(reference) {
    const cleanedReference = String(reference ?? '').trim()
    
    if (!cleanedReference) {
        return null
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    
    try {
        const url = `${BASE_URL}/products?display=[id,reference]&filter[reference]=[${encodeURIComponent(cleanedReference)}]`
        const res = await fetch(url, {
            headers: getAuthHeaders(),
            signal: controller.signal
        })
        
        if (!res.ok) {
            throw new Error(getHttpErrorMessage(res.status))
        }
        
        const xmlText = await res.text()
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml')
        
        if (xmlDoc.documentElement.nodeName === 'parsererror') {
            return null
        }
        
        const productNode = xmlDoc.getElementsByTagName('product')[0]
        if (!productNode) {
            return null
        }
        
        const idNode = productNode.getElementsByTagName('id')[0]
        const referenceNode = productNode.getElementsByTagName('reference')[0]
        
        return {
            id: String(idNode?.textContent ?? '').trim(),
            reference: String(referenceNode?.textContent ?? '').trim()
        }
    } catch (error) {
        console.error(`[API] Erreur recherche produit ${cleanedReference}:`, error)
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}

export async function uploadProductImage(productId, imageFile, imageName = '') {
    if (!productId) {
        throw new Error('ID produit requis')
    }
    
    if (!imageFile || !(imageFile instanceof File)) {
        throw new Error('Fichier image invalide')
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 2) // 20s timeout pour upload
    
    try {
        const formData = new FormData()
        formData.append('image', imageFile, imageName || imageFile.name)
        
        const base = BASE_URL.replace(/\/$/, '')
        const url = `${base}/images/products/${productId}`
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                // Ne pas setter Content-Type, le navigateur le fera avec le boundary
            },
            body: formData,
            signal: controller.signal
        })
        
        if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`HTTP ${res.status}: ${errorText.slice(0, 200)}`)
        }
        
        const responseText = await res.text()
        
        // Extraire l'ID de l'image créée depuis la réponse XML
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(responseText, 'application/xml')
        const imageNode = xmlDoc.getElementsByTagName('image')[0]
        const idNode = imageNode?.getElementsByTagName('id')[0]
        const imageId = String(idNode?.textContent ?? '').trim()
        
        return {
            success: true,
            imageId: imageId || 'unknown',
            message: `Image uploadée avec succès`
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout lors de l\'upload')
        }
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

export async function importImagesFromZip(zipFile, onProgress = null, onLog = null) {
    const results = {
        success: [],
        notFound: [],
        errors: [],
        skipped: [],
        total: 0,
        processed: 0
    }
    
    if (!zipFile || !(zipFile instanceof File)) {
        throw new Error('Fichier ZIP invalide')
    }
    
    try {
        if (onLog) onLog('📦 Décompression du fichier ZIP...', 'info')
        
        const zip = await JSZip.loadAsync(zipFile)
        const files = []
        
        // Parcourir tous les fichiers du ZIP
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            // Ignorer les dossiers
            if (zipEntry.dir) continue
            
            // Ignorer les fichiers/dossiers système Mac
            if (filename.startsWith('__MACOSX/') || 
                filename.includes('/__MACOSX/') ||
                filename.startsWith('._') ||
                filename.includes('/._')) {
                if (onLog) onLog(`⏭️ Fichier système ignoré: ${filename}`, 'skip')
                results.skipped.push({ file: filename, reason: 'Fichier système (__MACOSX)' })
                continue
            }
            
            // Ignorer les fichiers cachés Unix (commencent par .)
            const baseName = filename.split('/').pop()
            if (baseName.startsWith('.')) {
                if (onLog) onLog(`⏭️ Fichier caché ignoré: ${filename}`, 'skip')
                results.skipped.push({ file: filename, reason: 'Fichier caché' })
                continue
            }
            
            // Ignorer les fichiers .DS_Store
            if (baseName === '.DS_Store') {
                if (onLog) onLog(`⏭️ .DS_Store ignoré: ${filename}`, 'skip')
                results.skipped.push({ file: filename, reason: '.DS_Store' })
                continue
            }
            
            // Vérifier l'extension
            const ext = filename.split('.').pop().toLowerCase()
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif']
            if (!allowedExtensions.includes(ext)) {
                if (onLog) onLog(`⏭️ Fichier ignoré (extension non supportée): ${filename}`, 'skip')
                results.skipped.push({ file: filename, reason: 'Extension non supportée' })
                continue
            }
            
            // Extraire la référence (nom sans extension, en ignorant le chemin)
            const nameWithExt = filename.split('/').pop()
            const baseNameOnly = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'))
            
            // Nettoyer la référence: garder uniquement les caractères alphanumériques, tirets, underscores
            const reference = baseNameOnly.replace(/[^a-zA-Z0-9_-]/g, '')
            
            if (!reference) {
                if (onLog) onLog(`⏭️ Fichier ignoré (nom invalide): ${filename}`, 'skip')
                results.skipped.push({ file: filename, reason: 'Nom de fichier invalide pour la référence' })
                continue
            }
            
            files.push({
                filename: nameWithExt,
                fullPath: filename,
                reference,
                ext,
                zipEntry
            })
        }
        
        results.total = files.length
        if (onLog) onLog(`📁 ${results.total} fichier(s) image trouvé(s) dans le ZIP`, 'info')
        
        // 2. Traiter chaque fichier
        for (let i = 0; i < files.length; i++) {
            const { filename, reference, ext, zipEntry, fullPath } = files[i]
            
            try {
                // Mise à jour progression
                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: results.total,
                        reference,
                        status: 'processing'
                    })
                }
                
                if (onLog) onLog(`🔍 Recherche du produit: ${reference}`, 'info')
                
                // 3. Rechercher le produit par référence
                const product = await getProductByReferenceForImage(reference)
                
                if (!product || !product.id) {
                    if (onLog) onLog(`❌ Produit non trouvé: ${reference}`, 'error')
                    results.notFound.push({ file: filename, reference })
                    continue
                }
                
                if (onLog) onLog(`✅ Produit trouvé: ${reference} (ID: ${product.id})`, 'success')
                
                // 4. Lire le contenu du fichier image
                const imageBlob = await zipEntry.async('blob')
                const imageFile = new File([imageBlob], filename, { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` })
                
                // 5. Upload de l'image
                if (onLog) onLog(`📤 Upload de l'image: ${filename}`, 'info')
                const uploadResult = await uploadProductImage(product.id, imageFile, filename)
                
                if (uploadResult.success) {
                    if (onLog) onLog(`✅ Image importée: ${reference} → ${filename} (ID image: ${uploadResult.imageId})`, 'success')
                    results.success.push({
                        file: filename,
                        reference,
                        productId: product.id,
                        imageId: uploadResult.imageId
                    })
                } else {
                    throw new Error(uploadResult.message || 'Upload failed')
                }
                
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error)
                if (onLog) onLog(`❌ Erreur pour ${reference}: ${errorMsg}`, 'error')
                results.errors.push({
                    file: filename,
                    reference,
                    error: errorMsg
                })
            }
            
            results.processed = i + 1
        }
        
        // Résumé final
        if (onLog) {
            onLog('', 'info')
            onLog('═══════════════════════════════════════════════════', 'info')
            onLog(`📊 RÉSUMÉ DE L'IMPORT:`, 'info')
            onLog(`✅ Succès: ${results.success.length}`, 'success')
            onLog(`❌ Produits non trouvés: ${results.notFound.length}`, 'error')
            onLog(`⚠️ Erreurs techniques: ${results.errors.length}`, 'error')
            onLog(`⏭️ Fichiers ignorés: ${results.skipped.length}`, 'skip')
            onLog(`📁 Total traités: ${results.processed}/${results.total}`, 'info')
            onLog('═══════════════════════════════════════════════════', 'info')
        }
        
        return results
        
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (onLog) onLog(`💥 Erreur fatale: ${errorMsg}`, 'error')
        throw error
    }
}

