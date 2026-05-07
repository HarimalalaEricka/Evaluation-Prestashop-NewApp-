const BASE_URL = import.meta.env.VITE_API_URL_BACKEND

export async function getRessources() 
{
  const res = await fetch(`${BASE_URL}/`)
  if (!res.ok) throw new Error('Erreur ' + res.status)
  
  const xmlText = await res.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml')
  
  // Vérifier les erreurs de parsing
  if (xmlDoc.documentElement.nodeName === 'parsererror') {
    throw new Error('Erreur parsing XML')
  }
  
  return xmlDoc
}