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

function parseResourcesFromXml(xmlDoc, tagname) {
    const apiNode = xmlDoc.getElementsByTagName(tagname)[0]

    if (!apiNode) {
        return []
    }

    return Array.from(apiNode.children)
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

    return parseResourcesFromXml(xmlDoc, 'prestashop')
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

export async function deleteAllResourceData(resourceName) {
    // Récupérer tous les items de la ressource
    const items = await getRessourceData(resourceName)

    // Extraire les ids
    const ids = items.filter((item) => item.id).map((item) => item.id)

    if (ids.length === 0) {
        throw new Error(`Aucun item trouvé pour ${resourceName}`)
    }

    const errors = []
    const deleted = []

    // Boucler et supprimer chaque item
    for (const id of ids) {
        try {
            await deleteResource(resourceName, id)
            deleted.push(id)
        } catch (error) {
            errors.push({
                id,
                message: error instanceof Error ? error.message : String(error),
            })
        }
    }

    return {
        deleted,
        errors,
        deletedCount: deleted.length,
        errorCount: errors.length,
    }
}

