import { getRessourceData, getRessourceItemById, getRessourceItemXmlShemaBlank, insertResourceData } from './ressourcesService.js'

function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase()
}

async function buildCustomerDetailsList(customerItems) {
    const customersDetails = []

    for (const customer of customerItems) {
        if (!customer?.id) {
            continue
        }

        const customerDetails = await getRessourceItemById('customers', customer.id)
        customersDetails.push(customerDetails)
    }

    return customersDetails
}

function applyCustomerFilters(customers, filters = {}) {
    const searchText = normalizeText(filters.search)
    const searchEmail = normalizeText(filters.email)

    return customers.filter((customer) => {
        const fullName = normalizeText(`${customer?.firstname ?? ''} ${customer?.lastname ?? ''}`)
        const email = normalizeText(customer?.email)

        const matchesSearch = searchText ? fullName.includes(searchText) || email.includes(searchText) : true
        const matchesEmail = searchEmail ? email.includes(searchEmail) : true

        return matchesSearch && matchesEmail
    })
}

export async function getCustomersPage({ page = 1, perPage = 10, filters = {} } = {}) {
    const rawFilters = {}

    if (filters.email) {
        rawFilters.email = `[%${String(filters.email).trim()}%]`
    }

    const customerItems = await getRessourceData('customers', {
        display: ['id'],
        page,
        perPage: perPage + 1,
        filters: rawFilters,
        sort: 'id_ASC',
    })

    const hasMore = customerItems.length > perPage
    const visibleItems = customerItems.slice(0, perPage)
    const customersDetails = await buildCustomerDetailsList(visibleItems)

    return {
        items: applyCustomerFilters(customersDetails, filters),
        hasMore,
    }
}

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
    try
    {
        const customers = await getRessourceData('customers')
        return await buildCustomerDetailsList(customers)
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
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
export async function getAddressIdByCustomerId(id_customer)
{
    if (!id_customer) {
        throw new Error('id_customer is required')
    }

    try {
        const addresses = await getRessourceData('addresses')
        const addressIds = addresses
            .map((address) => address?.id)
            .filter((id) => id != null)

        const matchingAddresses = []

        for (const addressId of addressIds) {
            const addressDetails = await getRessourceItemById('addresses', addressId)
            if (String(addressDetails?.id_customer ?? '').trim() === String(id_customer).trim()) {
                matchingAddresses.push(addressDetails)
            }
        }

        const matchingAddress = matchingAddresses.sort((a, b) => Number(b.id) - Number(a.id))[0]

        if (matchingAddress?.id) {
            return matchingAddress.id
        }

        throw new Error(`No address found for customer id ${id_customer}`)
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}