import { getRessourceData, getRessourceItemById } from './ressourcesService.js'

export async function checkLogin(email, password) {
    if (!email || !password) throw new Error('Username and password are required')

    const customers = await getRessourceData('customers')
    let customerconnected = null
    try {
        for (const customer of customers) {
            if (!customer?.id) {
                continue
            }

            const customerDetails = await getRessourceItemById('customers', customer.id)
            if(customerDetails.email === email)
            {
                customerconnected = customerDetails
                break;
            }
        }
        if( !customerconnected) throw new Error('Invalid email or password')
        return customerconnected
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}