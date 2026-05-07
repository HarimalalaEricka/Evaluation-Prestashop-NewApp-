const BASE_URL = import.meta.env.VITE_API_URL_BACKEND

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

export async function getRessources() {
  const res = await fetch(`${BASE_URL}/`)
  if (!res.ok) throw new Error('Erreur ' + res.status)

  const xmlText = await res.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

  if (xmlDoc.documentElement.nodeName === 'parsererror') {
    throw new Error('Erreur parsing XML')
  }

  return parseResourcesFromXml(xmlDoc)
}