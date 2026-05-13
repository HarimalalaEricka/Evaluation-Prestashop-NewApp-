import { getRessourceData, getRessourceItemById } from './ressourcesService.js'
import { getTaxRulesGroupRateLookup } from './importService.js'

export async function getAllProducts() {
    const productsDetails = []
    try {
        const products = await getRessourceData('products')
        // const taxRulesGroupRateLookup = await getTaxRulesGroupRateLookup().catch(() => ({}))

        for (const product of products) {
            if (!product?.id) continue

            const productDetails = await getRessourceItemById('products', product.id)

            if (productDetails?.id_category_default) {
                const categorieDetail = await getRessourceItemById('categories',productDetails.id_category_default)
                productDetails.categorie = categorieDetail?.name
            }

            const taxRulesGroupId = String(productDetails.id_tax_rules_group ?? '').trim()

            // const rate = Number(taxRulesGroupRateLookup[taxRulesGroupId] ?? 0)

            productsDetails.push(productDetails)
        }

        return productsDetails
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}