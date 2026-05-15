import { getRessourceData, getRessourceItemById } from './ressourcesService.js'

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
