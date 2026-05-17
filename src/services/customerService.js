import { getRessourceData, getRessourceItemById, getRessourceItemXmlShemaBlank, insertResourceData } from './ressourcesService.js'

function extractCreatedId(xmlText) {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        return ''
    }

    const idNode = xmlDoc.getElementsByTagName('id')[0]
    return String(idNode?.textContent ?? '').trim()
}

export async function getAllCustomers()
{
    const customersDetails = []
    try
    {
        const customers = await getRessourceData('customers')
        for( const customer of customers )
        {
            if(!customer?.id)
            {
                continue
            }
            const customerDetails = await getRessourceItemById('customers', customer.id)
            customersDetails.push(customerDetails)
        }
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
    return customersDetails    
}

export async function createAnonymeCustomer()
{
    try {
        const blankGuest = await getRessourceItemXmlShemaBlank('guests')
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(blankGuest, 'application/xml')

        const guestNode = xmlDoc.getElementsByTagName('guest')[0]
        if (!guestNode) {
            throw new Error('Invalid guest XML schema')
        }

        const serializer = new XMLSerializer()
        const finalXml = serializer.serializeToString(xmlDoc)
        const response = await insertResourceData('guests', finalXml)
        const createdId = extractCreatedId(response)

        if (!createdId) {
            throw new Error('Impossible de récupérer l id du guest créé')
        }

        // Return the full guest object (not only id)
        const guestDetails = await getRessourceItemById('guests', createdId)
        return guestDetails
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}