import { getRessourceData, getRessourceItemById } from './ressourcesService.js'
const ID_COUNTRY = import.meta.env.VITE_ID_COUNTRY

export async function getAllProducts() {
    const productsDetails = []
    try {
        const products = await getRessourceData('products')

        for (const product of products) {
            if (!product?.id) continue

            const productDetails = await getRessourceItemById('products', product.id)

            if (productDetails?.id_category_default) {
                const categorieDetail = await getRessourceItemById('categories',productDetails.id_category_default)
                productDetails.categorie = categorieDetail?.name
            }

            const rate = await getRateByTaxRulesGroupId(productDetails.id_tax_rules_group)
            productDetails.tax_rate = rate

            const marque = await getMarqueByProductId(productDetails.id)
            productDetails.marque = marque

            productsDetails.push(productDetails)
        }

        return productsDetails
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getRateByTaxRulesGroupId(id_tax_rules_group) {
    if (!id_tax_rules_group) throw new Error('id_tax_rules_group required')
    try {
        const taxRule = await getTaxRuleByTaxRulesGroupId(id_tax_rules_group)
        if (!taxRule) {
            console.log('Tax rule not found for group', id_tax_rules_group)
            return 0
        }
        const rate = await getRateByTaxRule(taxRule)
        return rate
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getTaxRuleByTaxRulesGroupId(id_tax_rules_group, id_country = ID_COUNTRY) {
    if (!id_tax_rules_group) throw new Error('id_tax_rules_group required')
    try {
        const taxRules = await getRessourceData('tax_rules')
        for( const taxRule of taxRules) {
            const taxRuleDetails = await getRessourceItemById('tax_rules', taxRule.id)
            if (String(taxRuleDetails.id_tax_rules_group) === String(id_tax_rules_group) && String(taxRuleDetails.id_country) === String(id_country)) {
                return taxRuleDetails
            }
        }
        return null
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getRateByTaxRule( taxRule ){
    if (!taxRule) throw new Error('taxRule required')
    try {
        const tax = await getRessourceItemById('taxes', taxRule.id_tax)
        if (tax && tax.rate) {
            return Number(tax.rate)
        }
        return 2
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getMarqueByProductId(id_product) 
{
    if (!id_product) throw new Error('id_product required')
    
    try {
        const product = await getRessourceItemById('products', id_product)
        const date_availability = product.available_date
        
        if (date_availability && date_availability !== '0000-00-00') {
            const today = new Date()
            const yesterday = new Date(today)
            const sevenDaysAgo = new Date(today)
            
            yesterday.setDate(yesterday.getDate() - 1)
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            
            const todayStr = today.toISOString().split('T')[0]
            const yesterdayStr = yesterday.toISOString().split('T')[0]
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
            
            if (date_availability >= yesterdayStr && date_availability <= todayStr) {
                return 'HOT'
            }
            
            if (date_availability > sevenDaysAgoStr && date_availability < yesterdayStr) {
                return 'NEW'
            }
        }
        
        return ''
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}