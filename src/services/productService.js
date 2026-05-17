import { getRessourceData, getRessourceItemById } from './ressourcesService.js'
import { getCombinationValues } from './stockService.js'

const ID_COUNTRY = import.meta.env.VITE_ID_COUNTRY

const categoryCache = new Map()
const taxRulesListCache = new Map()
const taxRuleCache = new Map()
const taxRateCache = new Map()

function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase()
}

function getMultilingualText(value) {
    if (!value) return ''

    if (typeof value === 'string') {
        return value
    }

    if (Array.isArray(value)) {
        const firstText = value.find((item) => typeof item === 'string' && item.trim())
        return firstText ?? ''
    }

    if (typeof value === 'object') {
        return value.language ?? value[1] ?? value.value ?? ''
    }

    return String(value)
}

function getProductPriceWithTax(product) {
    const basePrice = Number(product?.price ?? 0)
    const taxRate = Number(product?.tax_rate ?? 0)
    return basePrice * (1 + taxRate / 100)
}

function getMarqueFromAvailabilityDate(availableDate) {
    if (!availableDate || availableDate === '0000-00-00') {
        return ''
    }

    const today = new Date()
    const yesterday = new Date(today)
    const sevenDaysAgo = new Date(today)

    yesterday.setDate(yesterday.getDate() - 1)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const todayStr = today.toISOString().split('T')[0]
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    if (availableDate >= yesterdayStr && availableDate <= todayStr) {
        return 'HOT'
    }

    if (availableDate > sevenDaysAgoStr && availableDate < yesterdayStr) {
        return 'NEW'
    }

    return ''
}

async function getCategoryById(categoryId) {
    if (!categoryId) {
        return null
    }

    if (categoryCache.has(String(categoryId))) {
        return categoryCache.get(String(categoryId))
    }

    const category = await getRessourceItemById('categories', categoryId)
    categoryCache.set(String(categoryId), category)
    return category
}

export async function getAllProducts() {
    try {
        const products = await getRessourceData('products')

        const productsDetails = []
        for (const product of products) {
            if (!product?.id) continue

            const productDetails = await getRessourceItemById('products', product.id)

            if (productDetails?.id_category_default) {
                const categorieDetail = await getCategoryById(productDetails.id_category_default)
                productDetails.categorie = categorieDetail?.name ?? null
            }

            productDetails.tax_rate = await getRateByTaxRulesGroupId(productDetails.id_tax_rules_group)
            productDetails.marque = getMarqueFromAvailabilityDate(productDetails.available_date)

            productsDetails.push(productDetails)
        }

        return productsDetails
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getProductByIdProductWithTax(id_product)
{
    if( !id_product ) throw new Error('id_product required')
    const produit = []
    try {
        const product = await getRessourceItemById('products', id_product)
        product.tax_rate = await getRateByTaxRulesGroupId(product.id_tax_rules_group)
        produit.push(product)
    }
    catch ( error) {
        throw error instanceof Error? error: new Error(String(error))
    }
    return produit
}

export async function getRateByTaxRulesGroupId(id_tax_rules_group) {
    if (!id_tax_rules_group) throw new Error('id_tax_rules_group required2')

    const cacheKey = `group:${id_tax_rules_group}`
    if (taxRateCache.has(cacheKey)) {
        return taxRateCache.get(cacheKey)
    }

    try {
        const taxRule = await getTaxRuleByTaxRulesGroupId(id_tax_rules_group)
        if (!taxRule) {
            console.log('Tax rule not found for group', id_tax_rules_group)
            taxRateCache.set(cacheKey, 0)
            return 0
        }
        const rate = await getRateByTaxRule(taxRule)
        taxRateCache.set(cacheKey, rate)
        return rate
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getTaxRuleByTaxRulesGroupId(id_tax_rules_group, id_country = ID_COUNTRY) {
    if (!id_tax_rules_group) throw new Error('id_tax_rules_group required2')

    const cacheKey = `rule:${id_tax_rules_group}:${id_country}`
    if (taxRuleCache.has(cacheKey)) {
        return taxRuleCache.get(cacheKey)
    }

    try {
        let taxRules = taxRulesListCache.get('tax_rules')
        if (!taxRules) {
            taxRules = await getRessourceData('tax_rules')
            taxRulesListCache.set('tax_rules', taxRules)
        }

        for( const taxRule of taxRules) {
            const taxRuleDetails = await getRessourceItemById('tax_rules', taxRule.id)
            if (String(taxRuleDetails.id_tax_rules_group) === String(id_tax_rules_group) && String(taxRuleDetails.id_country) === String(id_country)) {
                taxRuleCache.set(cacheKey, taxRuleDetails)
                return taxRuleDetails
            }
        }
        taxRuleCache.set(cacheKey, null)
        return null
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getRateByTaxRule( taxRule ){
    if (!taxRule) throw new Error('taxRule required')

    const cacheKey = `tax:${taxRule.id_tax}`
    if (taxRateCache.has(cacheKey)) {
        return taxRateCache.get(cacheKey)
    }

    try {
        const tax = await getRessourceItemById('taxes', taxRule.id_tax)
        if (tax && tax.rate) {
            const rate = Number(tax.rate)
            taxRateCache.set(cacheKey, rate)
            return rate
        }
        taxRateCache.set(cacheKey, 2)
        return 2
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}

export async function getMarqueByProductId(id_product, availableDate = null) 
{
    if (!id_product) throw new Error('id_product required')
    
    try {
        if (availableDate) {
            return getMarqueFromAvailabilityDate(availableDate)
        }

        const product = await getRessourceItemById('products', id_product)
        return getMarqueFromAvailabilityDate(product?.available_date)
    } catch (error) {
        throw error instanceof Error? error: new Error(String(error))
    }
}


export async function FilterProducts(name, categorie, min_price, max_price)
{
    const allProducts = await getAllProducts()
    const searchName = normalizeText(name)
    const searchCategorie = normalizeText(categorie)

    return allProducts.filter((product) => {
        const productName = normalizeText(getMultilingualText(product?.name))
        const productCategorie = normalizeText(getMultilingualText(product?.categorie))
        const priceWithTax = getProductPriceWithTax(product)

        const matchesName = searchName ? productName.includes(searchName) : true
        const matchesCategorie = searchCategorie ? productCategorie.includes(searchCategorie) : true
        const matchesMinPrice = min_price != null ? priceWithTax >= Number(min_price) : true
        const matchesMaxPrice = max_price != null ? priceWithTax <= Number(max_price) : true
        return matchesName && matchesCategorie && matchesMinPrice && matchesMaxPrice
    })
}

export async function getQuantityAvailableByProductId(id_product)
{
    if (!id_product) throw new Error('id_product required')
    try {
        const stocks = await getRessourceData('stock_availables')
        for (const stock of stocks) {
            const stockDetail = await getRessourceItemById('stock_availables', stock.id)
            if( stockDetail.id_product == id_product && stockDetail.id_product_attribute == '0') {
                return Number(stockDetail.quantity ?? 0)
            }
        }
        return 0
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function getQuantityAvailableByProductIdAndAttribute(id_product)
{
    if (!id_product) throw new Error('id_product required')
    const quantity = []
    try{
        const stocks = await getRessourceData('stock_availables')
        for (const stock of stocks) {
            const stockDetail = await getRessourceItemById('stock_availables', stock.id)
            if( stockDetail.id_product == id_product && stockDetail.id_product_attribute != '0') {
                const combinationValues = await getCombinationValues(stockDetail.id_product_attribute)
                const groupeName = combinationValues.map( item=> item.groupe ).join(', ')
                const valueName = combinationValues.map( item=> item.valeur ).join(', ')
                const price = Number(combinationValues[0]?.pricePlus ?? combinationValues[0]?.price ?? 0)
                stockDetail.group = groupeName
                stockDetail.value = valueName
                stockDetail.price = price
                quantity.push(stockDetail)
            }
        }
        return quantity
    }catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}
