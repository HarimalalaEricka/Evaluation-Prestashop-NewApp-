const BASE_URL = import.meta.env.VITE_API_URL_BACKEND
const REQUEST_TIMEOUT_MS = 10000

function getResourceUrl(resourceElement) {
  return (
    resourceElement.getAttribute('xlink:href') ||
    resourceElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
    resourceElement.getAttribute('href') ||
    ''
  )
}

function parseResourcesFromXml(xmlDoc) {
  return Array.from(xmlDoc.documentElement.children)
    .filter((resourceElement) => resourceElement.tagName !== 'description' && resourceElement.tagName !== 'schema')
    .map((resourceElement) => ({
      name: resourceElement.tagName,
      url: getResourceUrl(resourceElement),
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

  return parseResourcesFromXml(xmlDoc)
}