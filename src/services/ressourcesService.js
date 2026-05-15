const BASE_URL = import.meta.env.VITE_API_PROXY_PATH
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

// Singulariser les noms de ressources pour trouver les balises d'items (ex: categories → category, products → product, etc)
function singularizeResourceName(pluralName) {
    const specialCases = {
        categories: 'category',
        categoriess: 'category',
        order_states: 'order_state',
        tax_rules: 'tax_rule',
        stock_availables: 'stock_available',
        product_option_values: 'product_option_value',
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
export async function getRessourceData(ressourceName) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res

    try {
        res = await fetch(`${BASE_URL}/${ressourceName}`, {
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

    // Singulariser le nom de ressource (categories → category, products → product, etc)
    const itemTagName = singularizeResourceName(ressourceName)

    const result = parseResourcesFromXml(xmlDoc, 'prestashop', itemTagName)
    
    return result
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
            ...(defaultValues[normalizedResource] || {})
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
        const res = await fetch(`${BASE_URL}/${resourceName}/${id}`, {
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