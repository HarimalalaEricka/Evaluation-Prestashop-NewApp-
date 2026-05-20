import { getRessourceData, getRessourceItemById } from './ressourcesService.js'
import { getCombinationValues } from '../services/stockService.js'

export async function getMontantVenteHt()
{
    let ventesParCategorie = {} 
    
    try {
        const orders = await getRessourceData('order_details')
        for( const order of orders)
        {
            const ordersDetail = await getRessourceItemById('order_details', order.id)
            const ord =  await getRessourceItemById('orders', ordersDetail.id_order)
            const order_state = await getRessourceItemById('order_states', ord.current_state)
            if(order_state.paid === '0') continue
            const product = await getRessourceItemById('products', ordersDetail.product_id)
            const category = await getRessourceItemById('categories', product.id_category_default)
            let montantVente = 0
            if(ordersDetail.product_attribute_id == '0')
            {
                montantVente = Number(product.price) * Number(ordersDetail.product_quantity)
            }
            else            {
                const combinationValues = await getCombinationValues(ordersDetail.product_attribute_id)
                montantVente = (Number(product.price) + Number(combinationValues[0]?.pricePlus ?? 0)) * Number(ordersDetail.product_quantity)
                console.log('Montant vente HT   :', product.price, combinationValues[0]?.pricePlus ?? 0, ordersDetail.product_quantity, montantVente)
            }
            console.log('Montant vente HT   :', montantVente)
            if (!ventesParCategorie[category.name.language]) {
                ventesParCategorie[category.name.language] = 0
            }
            ventesParCategorie[category.name.language] += montantVente
        }
    }
    catch (error) {
        console.error('Erreur lors du calcul du montant de vente HT :', error)
    }
    
    return Object.entries(ventesParCategorie).map(([categorie, montant]) => ({
        categorie: categorie,
        montantHT: montant
    }))
}

export async function getMontantAchatHt()
{
    let achatsParCategorie = {} 
    
    try {
        const orders = await getRessourceData('order_details')
        for( const order of orders)
        {
            const ordersDetail = await getRessourceItemById('order_details', order.id)
            const ord =  await getRessourceItemById('orders', ordersDetail.id_order)
            const order_state = await getRessourceItemById('order_states', ord.current_state)
            if(order_state.paid === '0') continue
            const product = await getRessourceItemById('products', ordersDetail.product_id)
            const category = await getRessourceItemById('categories', product.id_category_default)
            let montantAchat = 0
            montantAchat = Number(ordersDetail.purchase_supplier_price) * Number(ordersDetail.product_quantity)
            console.log('Montant achat HT   :', ordersDetail.purchase_supplier_price, ordersDetail.product_quantity, montantAchat)
            
            if (!achatsParCategorie[category.name.language]) {
                achatsParCategorie[category.name.language] = 0
            }
            achatsParCategorie[category.name.language] += montantAchat
        }
    }
    catch (error) {
        console.error('Erreur lors du calcul du montant de achat HT :', error)
    }
    
    return Object.entries(achatsParCategorie).map(([categorie, montant]) => ({
        categorie: categorie,
        montantHT: montant
    }))
}

export async function getBeneficeByCategorie()
{
    const ventes = await getMontantVenteHt()
    const achats = await getMontantAchatHt()
    let montantEtBenefice = {}
    for( const vente of ventes)
    {
        for ( const achat of achats) 
        {
            if(achat.categorie === vente.categorie)
            {
                montantEtBenefice[vente.categorie] = {
                    vente: vente.montantHT,
                    achat: achat.montantHT,
                    benefice: vente.montantHT - achat.montantHT
                }
            }
        }
    }
    return montantEtBenefice
}

export async function getQuantityByCategory() {
    const quantityByCategory = {}

    try {
        // 1. Charger produits, stock_availables et stock_movements en parallèle
        const [stockMvtRefs, stockAvRefs, products] = await Promise.all([
            getRessourceData('stock_movements'),
            getRessourceData('stock_availables'),
            getRessourceData('products'),
        ])

        // Index des id produits existants pour filtrage rapide
        const productIds = new Set(
            products.map(p => String(p.id ?? p.id_product ?? '').trim()).filter(Boolean)
        )

        // Cache pour éviter les appels API répétés
        const productCache  = {}
        const categoryCache = {}

        // Helper : résoudre le nom de catégorie
        const getCatName = async (categoryId) => {
            if (!categoryCache[categoryId]) {
                try {
                    categoryCache[categoryId] = await getRessourceItemById('categories', categoryId)
                } catch {
                    categoryCache[categoryId] = null
                }
            }
            const cat = categoryCache[categoryId]
            return cat?.name?.language ?? cat?.name ?? `Catégorie #${categoryId}`
        }

        // Helper : résoudre le produit
        const getProduct = async (productId) => {
            if (!productCache[productId]) {
                try {
                    productCache[productId] = await getRessourceItemById('products', productId)
                } catch {
                    productCache[productId] = null
                }
            }
            return productCache[productId]
        }

        // Helper : agréger dans quantityByCategory
        const aggregate = async (productId, dispo, physique) => {
            const reserved = physique - dispo
            const produit  = await getProduct(productId)
            if (!produit) return

            const categoryId   = String(produit.id_category_default ?? '').trim()
            const categoryName = await getCatName(categoryId)

            if (!quantityByCategory[categoryName]) {
                quantityByCategory[categoryName] = { physique: 0, reserved: 0, dispo: 0 }
            }
            quantityByCategory[categoryName].physique  += physique
            quantityByCategory[categoryName].reserved  += reserved
            quantityByCategory[categoryName].dispo     += dispo
        }

        // ── PASSAGE 1 : stock_movements → stock_availables ────────────────
        const processedStockAvIds = new Set()

        for (const stockRef of stockMvtRefs) {
            const stockIdFromUrl = stockRef?.url && String(stockRef.url).match(/\/([0-9]+)(?:\/?$)/)?.[1]
            const idToUse = stockRef.id ?? stockIdFromUrl ?? stockRef.id_stock_mvt ?? stockRef.id_stock ?? null
            if (!idToUse) {
                console.warn('[getQuantityByCategory] mouvement sans id, ignoré', { stockRef })
                continue
            }

            // Récupérer le détail du mouvement
            let mvt
            try {
                mvt = await getRessourceItemById('stock_movements', idToUse)
            } catch (e) {
                console.warn('[getQuantityByCategory] mouvement introuvable:', idToUse)
                continue
            }

            // Récupérer le stock_available lié
            let stockAv
            try {
                stockAv = await getRessourceItemById('stock_availables', mvt.id_stock)
            } catch (e) {
                console.warn('[getQuantityByCategory] stock_available introuvable pour id_stock:', mvt.id_stock)
                continue
            }

            // Vérifier que le produit existe
            const productId = String(stockAv.id_product ?? '').trim()
            if (!productId || !productIds.has(productId)) continue

            const dispo    = Number(stockAv.quantity ?? stockAv.available_quantity ?? 0)
            const physique = Number(mvt.physical_quantity ?? dispo)
            
            await aggregate(productId, dispo, physique)
            processedStockAvIds.add(String(mvt.id_stock))
        }

        // ── PASSAGE 2 : stock_availables sans mouvement (fallback) ────────
        for (const stockRef of stockAvRefs) {
            const stockIdFromUrl = stockRef?.url && String(stockRef.url).match(/\/([0-9]+)(?:\/?$)/)?.[1]
            const idToUse = stockRef.id ?? stockIdFromUrl ?? null
            if (!idToUse || processedStockAvIds.has(String(idToUse))) continue

            let stockAv
            try {
                stockAv = await getRessourceItemById('stock_availables', idToUse)
            } catch {
                continue
            }

            // Vérifier que le produit existe
            const productId = String(stockAv.id_product ?? '').trim()
            if (!productId || !productIds.has(productId)) continue

            // Fallback : pas de mouvement → physique = dispo
            const dispo    = Number(stockAv.quantity ?? stockAv.available_quantity ?? 0)
            const physique = dispo

            await aggregate(productId, dispo, physique)
        }

    } catch (error) {
        console.error('[getQuantityByCategory] Erreur:', error)
    }

    return quantityByCategory
}