import { getRessourceData, getAuthHeaders, getHttpErrorMessage } from './ressourcesService.js'

const BASE_URL = import.meta.env.VITE_API_PROXY_PATH
const REQUEST_TIMEOUT_MS = 10000

// supprimer une ressource spécifique par id (ex: DELETE /api/products/123)
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

// mamafa ny data rehetra ny ressource ray ohatra hoe produit 
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

// supprimer le dernier item (par id décroissant) d'une ressource
export async function deleteLastResource(resourceName) {
    if (!resourceName) throw new Error('resourceName is required')

    // Récupérer le dernier item via tri id_DESC, limit=1
    let items = await getRessourceData(resourceName, { display: ['id'], page: 1, perPage: 1, sort: 'id_DESC' })
    if (!items || items.length === 0) {
        // try fetching full list as fallback
        items = await getRessourceData(resourceName)
        if (!items || items.length === 0) {
            return { resource: resourceName, deleted: false, reason: 'no_items' }
        }
    }

    // Try to obtain id from different possible fields
    let id = items[0].id || ''
    if (!id) {
        // try extract id from url attribute if present (e.g. '/api/customers/123')
        const url = String(items[0].url ?? items[0].href ?? '').trim()
        const m = url.match(/\/(\d+)(?:\/?$)/)
        if (m) id = m[1]
    }

    if (!id) {
        // fallback: try the first element of a full fetch
        try {
            const all = await getRessourceData(resourceName)
            if (Array.isArray(all) && all.length > 0) {
                id = all[0].id || ''
                if (!id) {
                    const url2 = String(all[0].url ?? all[0].href ?? '').trim()
                    const m2 = url2.match(/\/(\d+)(?:\/?$)/)
                    if (m2) id = m2[1]
                }
            }
        } catch (e) {
            // ignore fallback errors
        }
    }

    if (!id) return { resource: resourceName, deleted: false, reason: 'no_id' }

    try {
        await deleteResource(resourceName, id)
        return { resource: resourceName, deleted: true, id }
    } catch (err) {
        return { resource: resourceName, deleted: false, id, reason: err instanceof Error ? err.message : String(err) }
    }
}

// reset une liste de ressources en supprimant toutes les lignes de chacune
export async function resetResources(resourceNames = []) {
    if (!Array.isArray(resourceNames) || resourceNames.length === 0) {
        throw new Error('resourceNames must be a non-empty array')
    }

    const results = []
    for (const name of resourceNames) {
        try {
            const res = await deleteAllResourceData(name)
            results.push(res)
        } catch (err) {
            results.push({ resource: name, deleted: false, reason: err instanceof Error ? err.message : String(err) })
        }
    }

    return results
}

