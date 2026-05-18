import { getRessourceItemXmlShemaBlank, insertResourceData, setOrCreateXmlField } from './ressourcesService.js'

const DEFAULT_ID_LANG = 1
const DEFAULT_ID_PARENT = 2 // Catégorie parent par défaut

/**
 * Insérer une nouvelle catégorie
 * @param {string} categoryName - Nom de la catégorie
 * @returns {Promise<Object>} Résultat de l'insertion
 */
export async function insertCategory(categoryName) {
  if (!categoryName) {
    throw new Error('categoryName is required')
  }

  const blankCategoryXml = await getRessourceItemXmlShemaBlank('categories')

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(blankCategoryXml, 'application/xml')

  const categoryNode = xmlDoc.getElementsByTagName('category')[0]
  if (!categoryNode) {
    throw new Error('Invalid category XML schema')
  }

  // Champs obligatoires
  setOrCreateXmlField(categoryNode, 'id_lang', String(DEFAULT_ID_LANG), xmlDoc)
  setOrCreateXmlField(categoryNode, 'id_parent', String(DEFAULT_ID_PARENT), xmlDoc)
  setOrCreateXmlField(categoryNode, 'active', String(0), xmlDoc)

  // name doit être multilingue: <name><language id="1"><![CDATA[name]]></language></name>
  const existingName = categoryNode.getElementsByTagName('name')[0]
  if (existingName) {
    while (existingName.firstChild) existingName.removeChild(existingName.firstChild)
    const lang = xmlDoc.createElement('language')
    lang.setAttribute('id', String(DEFAULT_ID_LANG))
    lang.appendChild(xmlDoc.createCDATASection(String(categoryName)))
    existingName.appendChild(lang)
  } else {
    const nameEl = xmlDoc.createElement('name')
    const lang = xmlDoc.createElement('language')
    lang.setAttribute('id', String(DEFAULT_ID_LANG))
    lang.appendChild(xmlDoc.createCDATASection(String(categoryName)))
    nameEl.appendChild(lang)
    categoryNode.appendChild(nameEl)
  }

  // link_rewrite doit être multilingue (slug)
  const slugify = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const linkRewriteValue = slugify(categoryName)
  const existingLink = categoryNode.getElementsByTagName('link_rewrite')[0]
  if (existingLink) {
    while (existingLink.firstChild) existingLink.removeChild(existingLink.firstChild)
    const lang = xmlDoc.createElement('language')
    lang.setAttribute('id', String(DEFAULT_ID_LANG))
    lang.appendChild(xmlDoc.createCDATASection(String(linkRewriteValue)))
    existingLink.appendChild(lang)
  } else {
    const lr = xmlDoc.createElement('link_rewrite')
    const lang = xmlDoc.createElement('language')
    lang.setAttribute('id', String(DEFAULT_ID_LANG))
    lang.appendChild(xmlDoc.createCDATASection(String(linkRewriteValue)))
    lr.appendChild(lang)
    categoryNode.appendChild(lr)
  }

  const serializer = new XMLSerializer()
  const finalXml = serializer.serializeToString(xmlDoc)

  console.log('XML envoyé pour création de catégorie:', finalXml.substring(0, 1000))
  const result = await insertResourceData('categories', finalXml)
  console.log('Catégorie créée:', result)

  return result
}
