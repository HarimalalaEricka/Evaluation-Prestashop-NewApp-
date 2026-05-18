import { getRessourceItemXmlShemaBlank, insertResourceData, setOrCreateXmlField } from './ressourcesService.js'

const DEFAULT_ID_LANG = 1
const ID_COUNTRY = import.meta.env.VITE_ID_COUNTRY || 8

function generateTaxName(percentage) {
    const cleanPercentage = String(percentage ?? '0')
        .replace(',', '.')
        .replace(/[^0-9.]/g, '')
    return `TVA France ${cleanPercentage}%`
}

function createMultiLangElement(xmlDoc, fieldName, value, idLang = DEFAULT_ID_LANG) {
    const el = xmlDoc.createElement(fieldName)
    const lang = xmlDoc.createElement('language')
    lang.setAttribute('id', String(idLang))
    lang.appendChild(xmlDoc.createCDATASection(String(value)))
    el.appendChild(lang)
    return el
}

/**
 * @returns {Promise<string>} id de la taxe créée
 */
export async function insertTax(pourcentage) {
    if (pourcentage === undefined || pourcentage === null || pourcentage === '') {
        throw new Error('pourcentage is required')
    }

    const blankTaxXml = await getRessourceItemXmlShemaBlank('taxes')
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(blankTaxXml, 'application/xml')
    const taxName = generateTaxName(pourcentage)
    const cleanRate = String(pourcentage).replace(',', '.').replace(/[^0-9.]/g, '')

    const taxNode = xmlDoc.getElementsByTagName('tax')[0]
    if (!taxNode) throw new Error('Invalid tax XML schema')

    setOrCreateXmlField(taxNode, 'rate', cleanRate, xmlDoc)
    setOrCreateXmlField(taxNode, 'active', '1', xmlDoc)

    const existingName = taxNode.getElementsByTagName('name')[0]
    if (existingName) taxNode.removeChild(existingName)
    taxNode.appendChild(createMultiLangElement(xmlDoc, 'name', taxName))

    const finalXml = new XMLSerializer().serializeToString(xmlDoc)
    console.log('XML envoyé pour création de tax:', finalXml.substring(0, 1000))

    const resultXml = await insertResourceData('taxes', finalXml)
    const resultDoc = parser.parseFromString(resultXml, 'application/xml')
    const createdId = resultDoc.documentElement
        .firstElementChild?.getElementsByTagName('id')[0]?.textContent || null

    console.log('Tax créée (id):', createdId)
    return createdId
}

/**
 * @returns {Promise<string>} id du groupe créé
 */
export async function insertTaxRuleGroup(name) {
    if (!name) throw new Error('name is required')

    // On ignore le schéma blank et on construit le XML manuellement
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <tax_rule_group>
        <name>
            <language id="${DEFAULT_ID_LANG}"><![CDATA[${name}]]></language>
        </name>
        <active><![CDATA[1]]></active>
        <deleted><![CDATA[0]]></deleted>
    </tax_rule_group>
</prestashop>`

    console.log('XML envoyé pour création de tax_rule_group:', xmlString)

    const resultXml = await insertResourceData('tax_rule_groups', xmlString)
    const parser = new DOMParser()
    const resultDoc = parser.parseFromString(resultXml, 'application/xml')
    const createdId = resultDoc.documentElement
        .firstElementChild?.getElementsByTagName('id')[0]?.textContent || null

    console.log('Tax rules group créé (id):', createdId)
    return createdId
}

/**
 * @returns {Promise<{ id_tax_rules_group: string, id_tax: string, id_tax_rule: string }>}
 */
export async function insertTaxRule(pourcentage) {
    if (pourcentage === undefined || pourcentage === null || pourcentage === '') {
        throw new Error('pourcentage is required')
    }

    const taxName = generateTaxName(pourcentage)
    const cleanRate = String(pourcentage).replace(',', '.').replace(/[^0-9.]/g, '')

    // Créer dans l'ordre : tax → group → rule
    const taxId = await insertTax(pourcentage)
    const groupId = await insertTaxRuleGroup(taxName)

    const blankXml = await getRessourceItemXmlShemaBlank('tax_rules')
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(blankXml, 'application/xml')

    const ruleNode = xmlDoc.getElementsByTagName('tax_rule')[0]
    if (!ruleNode) throw new Error('Invalid tax_rule XML schema')

    setOrCreateXmlField(ruleNode, 'id_tax_rules_group', String(groupId), xmlDoc)
    setOrCreateXmlField(ruleNode, 'id_country', String(ID_COUNTRY), xmlDoc)
    setOrCreateXmlField(ruleNode, 'id_tax', String(taxId), xmlDoc)
    setOrCreateXmlField(ruleNode, 'id_lang', String(DEFAULT_ID_LANG), xmlDoc)

    const finalXml = new XMLSerializer().serializeToString(xmlDoc)
    console.log('XML envoyé pour création de tax_rule:', finalXml.substring(0, 1000))

    const resultXml = await insertResourceData('tax_rules', finalXml)
    const resultDoc = parser.parseFromString(resultXml, 'application/xml')
    const ruleId = resultDoc.documentElement
        .firstElementChild?.getElementsByTagName('id')[0]?.textContent || null

    console.log('Tax rule créée (id):', ruleId)

    return {
        id_tax_rules_group: groupId,
        id_tax: taxId,
        id_tax_rule: ruleId
    }
}