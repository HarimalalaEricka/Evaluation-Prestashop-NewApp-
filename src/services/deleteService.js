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

