import { getRessourceData, getRessourceItemById, updateResourceData, getRessourceItemXml, setOrCreateXmlField } from "./ressourcesService";

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

function normalizeWebserviceItems(value) {
    if (!value) return []

    const items = Array.isArray(value) ? value : [value]

    return items
        .map((item) => {
            if (item == null) return null

            if (typeof item === 'object') {
                return item.id ?? item.attrs?.id ?? item['@attributes']?.id ?? null
            }

            return item
        })
        .filter((item) => item !== null && item !== undefined && item !== '')
}

export async function getAllStocks()
{
    const stockDetails = []
    try
    {
        const stocks = await getRessourceData('stock_availables')
        
        if (!stocks || stocks.length === 0) {
            return []
        }

        for( const stock of stocks )
        {
            if(!stock?.id) continue
            
            const stockDetail = await getRessourceItemById('stock_availables', stock.id)
            
            if(!stockDetail?.id_product || stockDetail.id_product === 0) continue

            const product = await getRessourceItemById('products', stockDetail.id_product)
            if( stockDetail.id_product_attribute == '0' && product.product_type == 'combinations' ) continue
            stockDetail.product_name = getMultilingualText(product?.name) || `Produit #${stockDetail.id_product}`

            if (stockDetail.id_product_attribute != '0') {
                try {
                    const combination = await getRessourceItemById('combinations', stockDetail.id_product_attribute)
                    const productOptionValues = normalizeWebserviceItems(
                        combination?.associations?.product_option_values?.product_option_value
                    )

                    if (productOptionValues.length > 0) {
                        const labels = []

                        for (const productOptionValueId of productOptionValues) {
                            const optionValue = await getRessourceItemById('product_option_values', productOptionValueId)
                            if (!optionValue?.id) continue

                            const groupId = optionValue.id_attribute_group
                            const group = groupId ? await getRessourceItemById('product_options', groupId) : null

                            const groupName = getMultilingualText(group?.name) || `Groupe #${groupId ?? '?'}`
                            const valueName = getMultilingualText(optionValue?.name) || `Valeur #${productOptionValueId}`
                            labels.push(`${groupName}: ${valueName}`)
                        }

                        if (labels.length > 0) {
                            stockDetail.product_name += ` (${labels.join(', ')})`
                        }
                    }
                } catch (error) {
                    console.warn(`Impossible de charger les attributs pour la combinaison ${stockDetail.id_product_attribute}:`, error)
                }
            }
            stockDetails.push(stockDetail)
        }
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
    return stockDetails
}

export async function updateStock(stock)
{
    if( !stock?.id ) throw new Error('stock.id is required')
    
    const newQuantity = stock?.newQuantity
    if( newQuantity == null || isNaN(newQuantity) ) throw new Error('newQuantity must be a valid number')

    try {
        const StockXml = await getRessourceItemXml('stock_availables', stock.id)

        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(StockXml, 'application/xml')

        const stockNode = xmlDoc.getElementsByTagName('stock_available')[0]
        if (!stockNode) {
            throw new Error("stock_available node introuvable dans l'XML récupéré")
        }

        const oldQuantityNode = stockNode.getElementsByTagName('quantity')[0]
        setOrCreateXmlField(stockNode, 'quantity', String((oldQuantityNode ? parseInt(oldQuantityNode.textContent) : 0) + newQuantity), xmlDoc)

        const serializer = new XMLSerializer()
        const finalXml = serializer.serializeToString(xmlDoc)
        return await updateResourceData('stock_availables', stock.id, finalXml)
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}