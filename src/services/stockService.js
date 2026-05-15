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