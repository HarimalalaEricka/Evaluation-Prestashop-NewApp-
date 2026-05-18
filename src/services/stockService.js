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

function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase()
}

async function buildStockDetailsList(stockItems) {
    const stockDetails = []

    for (const stock of stockItems) {
        if (!stock?.id) continue

        const stockDetail = await getRessourceItemById('stock_availables', stock.id)

        if (!stockDetail?.id_product || stockDetail.id_product === 0) continue

        const product = await getRessourceItemById('products', stockDetail.id_product)
        if (stockDetail.id_product_attribute == '0' && product.product_type == 'combinations') continue
        stockDetail.product_name = getMultilingualText(product?.name) || `Produit #${stockDetail.id_product}`

        if (stockDetail.id_product_attribute != '0') {
            try {
                const combinationValues = await getCombinationValues(stockDetail.id_product_attribute)
                const labels = combinationValues.map(item => `${item.groupe}: ${item.valeur}`)

                if (labels.length > 0) {
                    stockDetail.product_name += ` (${labels.join(', ')})`
                }
            } catch (error) {
                console.warn(`Impossible de charger les attributs pour la combinaison ${stockDetail.id_product_attribute}:`, error)
            }
        }
        stockDetails.push(stockDetail)
    }

    return stockDetails
}

function applyStockFilters(stocks, filters = {}) {
    const searchText = normalizeText(filters.search)
    const searchProductId = normalizeText(filters.id_product)

    return stocks.filter((stock) => {
        const productName = normalizeText(stock?.product_name)
        const idProduct = normalizeText(stock?.id_product)

        const matchesSearch = searchText ? productName.includes(searchText) || idProduct.includes(searchText) : true
        const matchesProductId = searchProductId ? idProduct.includes(searchProductId) : true

        return matchesSearch && matchesProductId
    })
}

export async function getStocksPage({ page = 1, perPage = 10, filters = {} } = {}) {
    const rawFilters = {}

    if (filters.id_product) {
        rawFilters.id_product = String(filters.id_product)
    }

    const stocks = await getRessourceData('stock_availables', {
        display: ['id'],
        page,
        perPage: perPage + 1,
        filters: rawFilters,
        sort: 'id_DESC',
    })

    const hasMore = stocks.length > perPage
    const visibleStocks = stocks.slice(0, perPage)
    const stockDetails = await buildStockDetailsList(visibleStocks)

    return {
        items: applyStockFilters(stockDetails, filters),
        hasMore,
    }
}

function paginateRecords(records, page = 1, perPage = 10) {
    const startIndex = Math.max(0, (page - 1) * perPage)
    const items = records.slice(startIndex, startIndex + perPage)
    return {
        items,
        hasMore: records.length > startIndex + perPage,
    }
}

export async function getAllStocks()
{
    try
    {
        const stocks = await getRessourceData('stock_availables')
        
        if (!stocks || stocks.length === 0) {
            return []
        }

        return await buildStockDetailsList(stocks)
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function getCombinationValues(id_product_attribute)
{
    if (!id_product_attribute) {
        throw new Error('id_product_attribute required')
    }

    try {
        const combination = await getRessourceItemById( 'combinations', id_product_attribute)
        const combinationPrice = Number(combination?.price ?? 0)

        const productOptionValues = normalizeWebserviceItems( combination?.associations?.product_option_values?.product_option_value)

        const combinationValues = []

        for (const productOptionValueId of productOptionValues) {
            const optionValue = await getRessourceItemById( 'product_option_values', productOptionValueId)

            if (!optionValue?.id) continue

            const groupId = optionValue.id_attribute_group

            const group = groupId ? await getRessourceItemById('product_options', groupId) : null
            const groupName = getMultilingualText(group?.name) || `Groupe #${groupId ?? '?'}`
            const valueName = getMultilingualText(optionValue?.name) || `Valeur #${productOptionValueId}`

            combinationValues.push({
                groupe: groupName,
                valeur: valueName,
                price: combinationPrice,
                pricePlus: combinationPrice
            })
        }

        return combinationValues

    } catch (error) {
        console.warn(
            `Impossible de charger les attributs pour la combinaison ${id_product_attribute}:`,
            error
        )

        return []
    }
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

export async function getSummaryStockByProductAndAttribute(id_product)
{
    const stocks = await getRessourceData('stock_movements')
    const stockAvailables = await getRessourceData('stock_availables')
    const groupedByDateAndAttribute = {}
    
    try {
        for (const stock of stocks) {
            if (!stock?.id) continue
            
            const stockDetails = await getRessourceItemById('stock_movements', stock.id)
            
            // Récupérer le stock_available associé pour trouver l'id_product
            const id_stock = stockDetails.id_stock
            if (!id_stock) continue
            
            const stockAvailable = await getRessourceItemById('stock_availables', id_stock)
            
            // Filtrer par produit (garder toutes les déclinaisons)
            if (stockAvailable.id_product != id_product) continue
            
            if( stockAvailable.id == stockDetails.id_stock) console.log('Mouvement de stock correspondant trouvé pour le produit', id_product, 'avec id_stock:', stockAvailable.id)
            
            // Extraire la date
            const dateKey = stockDetails.date_add 
                ? new Date(stockDetails.date_add).toISOString().split('T')[0] 
                : null
            
            if (!dateKey) continue
            
            // Créer une clé composite: date + id_product_attribute (pour grouper par déclinaison)
            const id_product_attribute = stockAvailable.id_product_attribute || '0'
            const groupKey = `${dateKey}_${id_product_attribute}`
            
            // Initialiser le groupe pour cette date et attribut s'il n'existe pas
            if (!groupedByDateAndAttribute[groupKey]) {
                groupedByDateAndAttribute[groupKey] = {
                    date: dateKey,
                    id_product_attribute: id_product_attribute,
                    attributeLabel: '',
                    stock_debut: 0,
                    entree: 0,
                    sortie: 0,
                    stock_fin: 0
                }
            }
            
            // Ajouter les mouvements (sign = 1 pour entree, -1 pour sortie)
            const quantity = Number(stockDetails.physical_quantity ?? 0)
            if (stockDetails.sign == 1) {
                groupedByDateAndAttribute[groupKey].entree += quantity
            } else if (stockDetails.sign == -1) {
                groupedByDateAndAttribute[groupKey].sortie += quantity
            }
        }
        
        // Récupérer la quantité actuelle pour chaque déclinaison et charger les labels
        const currentQuantitiesByAttribute = {}
        for( const stockAvailable of stockAvailables )
        {
            const stockAvailableDetail = await getRessourceItemById('stock_availables', stockAvailable.id)
            if( String(stockAvailableDetail?.id_product) !== String(id_product) ) continue
            
            const attr = stockAvailableDetail.id_product_attribute || '0'
            currentQuantitiesByAttribute[attr] = Number(stockAvailableDetail.quantity ?? 0)
            
            console.log('stockAvailableDetail pour attribut', attr, ':', stockAvailableDetail)
            console.log('currentQuantity for attribute', attr, ':', currentQuantitiesByAttribute[attr])
        }
        
        // Charger les labels d'attributs
        for (const attr in currentQuantitiesByAttribute) {
            if (attr !== '0') {
                try {
                    const combinationValues = await getCombinationValues(attr)
                    const labels = combinationValues.map(item => `${item.groupe}: ${item.valeur}`)
                    for (const key in groupedByDateAndAttribute) {
                        if (groupedByDateAndAttribute[key].id_product_attribute === attr) {
                            groupedByDateAndAttribute[key].attributeLabel = labels.join(', ')
                        }
                    }
                } catch (error) {
                    console.warn(`Impossible de charger les attributs pour la combinaison ${attr}:`, error)
                }
            }
        }
        
        // Trier par date décroissante et par attribut
        const result = Object.values(groupedByDateAndAttribute).sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date)
            if (dateCompare !== 0) return dateCompare
            return String(a.id_product_attribute).localeCompare(String(b.id_product_attribute))
        })

        // Recalculer les stocks en début/fin pour chaque attribut indépendamment
        // Grouper par attribut
        const byAttribute = {}
        for (const record of result) {
            const attr = record.id_product_attribute
            if (!byAttribute[attr]) byAttribute[attr] = []
            byAttribute[attr].push(record)
        }

        // Pour chaque attribut, recalculer les stocks
        for (const attr in byAttribute) {
            const records = byAttribute[attr]
            if (records.length > 0) {
                const currentQty = currentQuantitiesByAttribute[attr] || 0
                records[0].stock_fin = currentQty
                records[0].stock_debut = currentQty - records[0].entree + records[0].sortie

                for (let index = 1; index < records.length; index++) {
                    const previousRecord = records[index - 1]
                    const dailyRecord = records[index]

                    dailyRecord.stock_fin = previousRecord.stock_debut
                    dailyRecord.stock_debut = dailyRecord.stock_fin - dailyRecord.entree + dailyRecord.sortie
                }
            }
        }
        
        return result
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function getSummaryStockByIdProductPage(id_product, { page = 1, perPage = 10 } = {}) {
    const records = await getSummaryStockByIdProduct(id_product)
    return paginateRecords(records, page, perPage)
}

export async function getSummaryStockByProductAndAttributePage(id_product, { page = 1, perPage = 10 } = {}) {
    const records = await getSummaryStockByProductAndAttribute(id_product)
    return paginateRecords(records, page, perPage)
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