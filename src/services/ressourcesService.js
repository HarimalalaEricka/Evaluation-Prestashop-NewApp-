const BASE_URL = import.meta.env.VITE_API_PROXY_PATH
const API_KEY = import.meta.env.VITE_API_KEY
const REQUEST_TIMEOUT_MS = 10000

function getAuthHeaders() {
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

function singularizeResourceName(pluralName) {
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

function getHttpErrorMessage(status) {
    if (status === 401 || status === 403) {
        return 'Erreur authentification API'
    }

    if (status === 404) {
        return 'Ressource inaccessible'
    }

    return 'Erreur ' + status
}

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

    return parseResourcesFromXml(xmlDoc, 'prestashop', itemTagName)
}

export async function deleteResource(resourceName, id) {
    if (!resourceName || !id) throw new Error('resourceName and id are required')

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

        if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

        // Many APIs return empty body on DELETE; consider 200/204 as success
        return true
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Timeout API')
        throw error instanceof Error ? error : new Error(String(error))
    } finally {
        window.clearTimeout(timeoutId)
    }
}

export async function deleteAllResourceData(resourceName, options = {}) {
    // Options: { delayBetweenRequests: ms, batchSize: n }
    const { delayBetweenRequests = 500, batchSize = 1 } = options

    // Récupérer tous les items de la ressource
    const items = await getRessourceData(resourceName)

    // Extraire les ids
    const ids = items.filter((item) => item.id).map((item) => item.id)

    if (ids.length === 0) {
        throw new Error(`Aucun item trouvé pour ${resourceName}`)
    }

    const errors = []
    const deleted = []
    const results = {
        resource: resourceName,
        deleted,
        errors,
        deletedCount: 0,
        errorCount: 0,
        totalCount: ids.length,
    }

    // Fonction utilitaire pour attendre
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    // Traiter en batches
    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize)

        // Lancer les suppressions du batch en parallèle
        const promises = batch.map(async (id) => {
            try {
                await deleteResource(resourceName, id)
                deleted.push(id)
                return { id, success: true }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error)
                errors.push({
                    id,
                    message: errorMsg,
                    timestamp: new Date().toISOString(),
                })
                return { id, success: false, error: errorMsg }
            }
        })

        await Promise.all(promises)

        // Attendre avant le prochain batch (sauf le dernier)
        if (i + batchSize < ids.length && delayBetweenRequests > 0) {
            await sleep(delayBetweenRequests)
        }
    }

    results.deletedCount = deleted.length
    results.errorCount = errors.length

    return results
}

