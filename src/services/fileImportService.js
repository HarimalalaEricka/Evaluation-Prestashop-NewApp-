const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost/Evaluation-Prestashop-NewApp-'

import { importProductsFile1, importProductsFromCsv } from './productService.js'

/** Simple CSV parser returning array of objects (headers normalized to lowercase) */
function parseCsvText(csvText) {
  if (!csvText) return []

  const rows = []
  const parsedRows = []
  let cur = ''
  let row = []
  let inQuotes = false
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur); cur = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csvText[i + 1] === '\n') i++
      row.push(cur)
      parsedRows.push(row)
      row = []
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); parsedRows.push(row) }
  if (parsedRows.length === 0) return []
  const headers = parsedRows[0].map(h => String(h ?? '').trim())
  for (let i = 1; i < parsedRows.length; i++) {
    const r = parsedRows[i]
    if (r.every(c => String(c ?? '').trim() === '')) continue
    const obj = {}
    for (let j = 0; j < headers.length; j++) {
      const key = String(headers[j] ?? '').trim().toLowerCase()
      obj[key] = String(r[j] ?? '').trim()
    }
    rows.push(obj)
  }
  return rows
}

export async function parseFile(file) {
  if (!file) throw new Error('Aucun fichier fourni')
  const fileType = file.type || ''
  const fileName = file.name || ''

  if (fileType.includes('csv') || fileName.endsWith('.csv')) {
    const text = await file.text()
    const data = parseCsvText(text)
    return { format: 'csv', data, csvText: text, fileName }
  }

  if (fileType.includes('xml') || fileName.endsWith('.xml')) {
    const text = await file.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(text, 'application/xml')
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Erreur de parsing XML')
    }
    return { format: 'xml', xmlDoc, xmlText: text, fileName }
  }

  throw new Error(`Type de fichier non supporté: ${fileType}`)
}

export async function processFile1(parsedData) {
  if (!parsedData) throw new Error('Données invalides pour le traitement')

  if (parsedData.format === 'csv') {
    // Use CSV import flow
    return {
      fileType: 'csv',
      fileName: parsedData.fileName,
      results: await importProductsFromCsv(parsedData.csvText ?? parsedData.data)
    }
  }

  if (parsedData.format === 'xml') {
    if (!parsedData.xmlDoc) throw new Error('Données XML invalides pour le fichier 1')
    return {
      fileType: 'file1',
      fileName: parsedData.fileName,
      results: await importProductsFile1(parsedData.xmlDoc)
    }
  }

  throw new Error('Format non supporté pour le traitement du fichier 1')
}

/**
 * Valider les données parsées (CSV ou XML)
 * @param {Object} parsedData
 * @returns {Object} { isValid, errors, warnings, rootElement, itemsCount }
 */
export function validateFileData(parsedData) {
  const validation = { isValid: true, errors: [], warnings: [], rootElement: null, itemsCount: 0 }

  if (!parsedData) {
    validation.isValid = false
    validation.errors.push('Aucune donnée fournie')
    return validation
  }

  if (parsedData.format === 'csv') {
    if (!Array.isArray(parsedData.data)) {
      validation.isValid = false
      validation.errors.push('Données CSV invalides')
      return validation
    }

    validation.itemsCount = parsedData.data.length
    validation.rootElement = 'csv'

    if (validation.itemsCount === 0) {
      validation.warnings.push('Le fichier CSV ne contient aucune ligne de données')
    }

    return validation
  }

  if (parsedData.format === 'xml') {
    if (!parsedData.xmlDoc) {
      validation.isValid = false
      validation.errors.push('Document XML invalide')
      return validation
    }

    const root = parsedData.xmlDoc.documentElement
    if (!root) {
      validation.isValid = false
      validation.errors.push('Document XML invalide')
      return validation
    }

    validation.rootElement = root.tagName
    validation.itemsCount = root.children.length

    if (validation.itemsCount === 0) {
      validation.warnings.push('Le fichier XML ne contient aucun élément')
    }

    return validation
  }

  validation.isValid = false
  validation.errors.push('Format de fichier non supporté')
  return validation
}

// Keep downloadTemplate for compatibility
export async function downloadTemplate(resourceType) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/import/template/${resourceType}`, { method: 'GET' })
    if (!response.ok) throw new Error(`Erreur lors du téléchargement du template: ${response.status}`)
    return await response.blob()
  } catch (error) {
    console.error('[FileImportService] Erreur lors du téléchargement du template:', error)
    throw error
  }
}

export async function importMultipleFiles(files) {
  if (!files || files.length === 0) throw new Error('Aucun fichier fourni')
  const results = { success: [], errors: [], total: files.length }
  for (const file of files) {
    try {
      const parsed = await parseFile(file)
      const res = await processFile1(parsed)
      results.success.push({ fileName: file.name, details: res })
    } catch (err) {
      results.errors.push({ fileName: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
