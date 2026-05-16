import { getRessourceData, getRessourceItemById, getRessourceItemXmlShemaBlank, setOrCreateXmlField, insertResourceData } from "./ressourcesService";

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
    if (!stock?.id) throw new Error('stock.id is required')
    if (stock?.newQuantity == null || isNaN(stock.newQuantity)) throw new Error('newQuantity must be a valid number')

    try {
        const templateXml = await getRessourceItemXmlShemaBlank('update_stock')

        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(templateXml, 'application/xml')

        const updateStockNode = xmlDoc.getElementsByTagName('update_stock')[0]
        if (!updateStockNode) {
            throw new Error('update_stock node introuvable dans le schéma retourné')
        }
        setOrCreateXmlField(updateStockNode, 'id_product', String(stock.id_product), xmlDoc)
        setOrCreateXmlField(updateStockNode, 'id_product_attribute', String(stock.id_product_attribute || 0), xmlDoc)
        setOrCreateXmlField(updateStockNode, 'id_shop', String(stock.id_shop || 1), xmlDoc)
        setOrCreateXmlField(updateStockNode, 'delta', String(stock.newQuantity), xmlDoc)
        
        // POST au nouvel endpoint
        const serializer = new XMLSerializer()
        const finalXml = serializer.serializeToString(xmlDoc)
        return await insertResourceData('update_stock', finalXml)
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function getSummaryStockByIdProduct(id_product)
{
    const stocks = await getRessourceData('stock_movements')
    const stockAvailables = await getRessourceData('stock_availables')
    const groupedByDate = {}
    
    try {
        let matchedCount = 0
        for (const stock of stocks) {
            if (!stock?.id) continue
            
            const stockDetails = await getRessourceItemById('stock_movements', stock.id)
            
            // Récupérer le stock_available associé pour trouver l'id_product
            const id_stock = stockDetails.id_stock
            if (!id_stock) continue
            
            const stockAvailable = await getRessourceItemById('stock_availables', id_stock)
            
            // Filtrer par produit
            if (stockAvailable.id_product != id_product) continue
            // if( stockAvailable.id_stock = stockDetails.id_stock) continue
            // console.log('Stock disponible trouvé:', stockAvailable)
            // console.log('Stock details:', stockDetails)
            if( stockAvailable.id == stockDetails.id_stock) console.log('Mouvement de stock correspondant trouvé pour le produit', id_product, 'avec id_stock:', stockAvailable.id)
            
            // matchedCount++
            
            // Extraire la date
            const dateKey = stockDetails.date_add 
                ? new Date(stockDetails.date_add).toISOString().split('T')[0] 
                : null
            
            if (!dateKey) continue
            
            // Initialiser le groupe pour cette date s'il n'existe pas
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    stock_debut: 0,
                    entree: 0,
                    sortie: 0,
                    stock_fin: 0
                }
            }
            
            // Ajouter les mouvements (sign = 1 pour entree, -1 pour sortie)
            const quantity = Number(stockDetails.physical_quantity ?? 0)
            if (stockDetails.sign == 1) {
                groupedByDate[dateKey].entree += quantity
            } else if (stockDetails.sign == -1) {
                groupedByDate[dateKey].sortie += quantity
            }
        }
        
        // Récupérer la quantité actuelle directement depuis stock_available
        let currentQuantity = 0
        for( const stockAvailable of stockAvailables )
        {
            const stockAvailableDetail = await getRessourceItemById('stock_availables', stockAvailable.id)
            if( String(stockAvailableDetail?.id_product) !== String(id_product) ) continue
            if( stockAvailableDetail.id_product_attribute != '0') continue
            currentQuantity = Number(stockAvailableDetail.quantity ?? 0)
            // {
                // console.log('Stock disponible actuel trouvé pour le produit', id_product, ':', stockAvailableDetail)
                // break
            // }
            console.log('stockAvailableDetail:', stockAvailableDetail)
            console.log('currentQuantity:', currentQuantity)
        }

        // if (currentStockAvailable) {
        //     currentQuantity = Number(currentStockAvailable.quantity ?? 0)
        // }
        // console.log('currentStockAvailable:', currentStockAvailable)
        // console.log('currentQuantity:', currentQuantity)
        
        // Trier par date décroissante (du plus récent au plus ancien)
        const result = Object.values(groupedByDate).sort((a, b) => new Date(b.date) - new Date(a.date))

        // La ligne la plus récente porte la quantité actuelle de stock_available.
        // Les lignes précédentes se recalculent à partir du stock_debut de la ligne plus récente.
        if (result.length > 0) {
            result[0].stock_fin = currentQuantity
            result[0].stock_debut = currentQuantity - result[0].entree + result[0].sortie

            for (let index = 1; index < result.length; index++) {
                const previousRecord = result[index - 1]
                const dailyRecord = result[index]

                dailyRecord.stock_fin = previousRecord.stock_debut
                dailyRecord.stock_debut = dailyRecord.stock_fin - dailyRecord.entree + dailyRecord.sortie
            }
        }
        
        return result
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}


export async function FilterSummaryByDate(date_debut, date_fin, id_product)
{
    const stocks = await getSummaryStockByIdProduct(id_product)
    const filtered = stocks.filter(stock => {
        const stockDate = new Date(stock.date)
        return (!date_debut || stockDate >= new Date(date_debut)) && (!date_fin || stockDate <= new Date(date_fin))
    })
    return filtered
}