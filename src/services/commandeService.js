import { getRessourceData, getRessourceItemById, updateResourceData, getRessourceItemXml, setOrCreateXmlField, getRessourceItemXmlShemaBlank, insertResourceData } from './ressourcesService.js'
import { getCartProductsByCartId } from './CartService.js'
import { getRateByTaxRulesGroupId } from './productService.js'
import { getCombinationValues } from './stockService.js'
const DEFAULT_ID_CURRENCY = 1
const DEFAULT_ID_LANG = 1
const DEFAULT_MODULE = 'ps_cashondelivery'
const DEFAULT_ID_CARRIER = 2 // id 2 = livraison gratuite
const DEFAULT_STATE = 2 // id = 2 => paiement accepté

export async function getAllCommandes()
{
    const commandesDetails = []
    try
    {
        const commandes = await getRessourceData('orders')
        for( const commande of commandes )
        {
            if(!commande?.id)
            {
                continue
            }
            const commandeDetails = await getRessourceItemById('orders', commande.id)
            const stateDetails = await getRessourceItemById('order_states', commandeDetails.current_state)
            const stateName = stateDetails?.name
            commandeDetails.current_state_label =
                (typeof stateName === 'string' && stateName.trim()) ||
                (Array.isArray(stateName) && stateName.find((item) => typeof item === 'string' && item.trim())) ||
                (stateName?.language && String(stateName.language).trim()) ||
                String(commandeDetails.current_state ?? '').trim()

            const customerDetails = await getRessourceItemById('customers', commandeDetails.id_customer)
            commandeDetails.customer_name = customerDetails?.lastname 

            const deliveryDetails = await getRessourceItemById('addresses', commandeDetails.id_address_delivery)
            commandeDetails.city = deliveryDetails?.city 

            commandesDetails.push(commandeDetails)
        }
        return commandesDetails
    }catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}
export async function getOrderState()
{
    const states = []
    try
    {
        const etats = await getRessourceData('order_states')
        for( const etat of etats )
        {
            if (!etat?.id) {
                continue
            }

            const stateDetails = await getRessourceItemById('order_states', etat.id)
            const stateName = stateDetails?.name
            const stateLabel =
                (typeof stateName === 'string' && stateName.trim()) ||
                (Array.isArray(stateName) && stateName.find((item) => typeof item === 'string' && item.trim())) ||
                (stateName?.language && String(stateName.language ?? stateName.language).trim()) ||
                String(etat.id ?? '').trim()

            if (stateLabel === 'Paiement accepté' || stateLabel === 'Annulé') {
                states.push({
                    id: String(etat.id),
                    name: stateLabel,
                })
            }
        }
        return states
    } catch(error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function changeOrderState(orderId, newStateId) {
    if (!orderId) throw new Error('orderId required')
    if (!newStateId) throw new Error('newStateId required')

    // récupérer l'XML complet de la commande et remplacer uniquement current_state
    const xmlText = await getRessourceItemXml('orders', orderId)
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    const orderNode = xmlDoc.getElementsByTagName('order')[0]
    if (!orderNode) {
        throw new Error("order node introuvable dans l'XML récupéré")
    }

    setOrCreateXmlField(orderNode, 'current_state', String(newStateId), xmlDoc)

    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)

    return await updateResourceData('orders', orderId, finalXml)
}

export async function insertOrder(id_cart)
{
    if (!id_cart) {
        throw new Error('id_cart is required')
    }

    const blankOrderXml = await getRessourceItemXmlShemaBlank('orders')
    const cart = await getRessourceItemById('carts', id_cart)
    const cartProducts = await getCartProductsByCartId(id_cart)
    let total_paid = 0  //ttc avec ou sans remise
    let total_products = 0 // ht avec ou sans remise

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(blankOrderXml, 'application/xml')

    const orderNode = xmlDoc.getElementsByTagName('order')[0]
    if (!orderNode) {
        throw new Error('Invalid order XML schema')
    }

    // Champs obligatoires
    setOrCreateXmlField(orderNode, 'id_lang', String(DEFAULT_ID_LANG), xmlDoc)
    setOrCreateXmlField(orderNode, 'id_currency', String(DEFAULT_ID_CURRENCY), xmlDoc)
    setOrCreateXmlField(orderNode, 'id_customer', String(cart.id_customer), xmlDoc)
    setOrCreateXmlField(orderNode, 'id_address_delivery', String(cart.id_address_delivery), xmlDoc)
    setOrCreateXmlField(orderNode, 'id_address_invoice', String(cart.id_address_invoice), xmlDoc)
    setOrCreateXmlField(orderNode, 'id_cart', String(id_cart), xmlDoc)
    setOrCreateXmlField(orderNode, 'id_carrier', DEFAULT_ID_CARRIER, xmlDoc)
    setOrCreateXmlField(orderNode, 'current_state', DEFAULT_STATE, xmlDoc)
    setOrCreateXmlField(orderNode, 'secure_key', cart.secure_key, xmlDoc)

    setOrCreateXmlField(orderNode, 'module', DEFAULT_MODULE, xmlDoc)
    setOrCreateXmlField(orderNode, 'payment', 'Paiement comptant à la livraison (Cash on delivery)', xmlDoc)

    // Order rows - créer une ligne par produit
    const firstOrderRow = orderNode.getElementsByTagName('order_row')[0]
    const orderRowsContainer = firstOrderRow?.parentNode
    
    for (let i = 0; i < cartProducts.length; i++) {
        const product = cartProducts[i]
        const produit = await getRessourceItemById('products', product.id_product)
            let priceTTC = parseFloat(produit.price) // Base product price
        
            // Pour les produits avec combinaison, ajouter le prix de l'attribut
            if (String(product.id_product_attribute) !== '0' && product.id_product_attribute) {
                try {
                    const combinationValues = await getCombinationValues(product.id_product_attribute)
                    const pricePlus = Number(combinationValues[0]?.pricePlus ?? 0)
                    priceTTC += pricePlus
                } catch (combError) {
                    console.warn('Impossible de charger le prix de la combinaison:', combError)
                }
            }
        
            let ht = priceTTC * product.quantity // ht 
        const rate = await getRateByTaxRulesGroupId(produit.id_tax_rules_group)
        let ttc = ht * (1 + rate / 100); 
        
        // Cloner la première row pour les produits suivants
        let orderRow = firstOrderRow
        if (i > 0 && orderRowsContainer) {
            orderRow = firstOrderRow.cloneNode(true)
            orderRowsContainer.appendChild(orderRow)
        }
        
        setOrCreateXmlField(orderRow, 'product_id', String(product.id_product), xmlDoc)
        setOrCreateXmlField(orderRow, 'product_attribute_id', String(product.id_product_attribute), xmlDoc)
        setOrCreateXmlField(orderRow, 'product_quantity', String(product.quantity), xmlDoc)
        setOrCreateXmlField(orderRow, 'product_name', String(produit.name), xmlDoc)
        setOrCreateXmlField(orderRow, 'product_reference', String(produit.reference), xmlDoc)
        total_paid += ttc
        total_products += ht
    }

    setOrCreateXmlField(orderNode, 'total_paid', String(total_paid), xmlDoc) 
    setOrCreateXmlField(orderNode, 'total_paid_real', String(total_paid), xmlDoc) // mitovy amle total_paid ihany satria efa paiement accepté par defaut

    setOrCreateXmlField(orderNode, 'total_products', String(total_products), xmlDoc) 
    setOrCreateXmlField(orderNode, 'total_products_wt', String(total_paid), xmlDoc) // mitovy amle total_paid ihany satria ity ilay prix total avec taxe

    setOrCreateXmlField(orderNode, 'conversion_rate', '1', xmlDoc)

    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)
    
    console.log('XML envoyé pour création de commande:', finalXml.substring(0, 1000))
    const result = await insertResourceData('orders', finalXml)
    // console.log('Commande créée:', result)
    
    return result
    // return await insertResourceData('orders', finalXml)
}

export async function SumOrdersGroupByDate()
{
    const commandes = await getRessourceData('orders')
    const groupedByDate = {}
    
    try {
        for (const commande of commandes) {
            if (!commande?.id) {
                continue
            }
            
            const commandeDetails = await getRessourceItemById('orders', commande.id)
            // Extraire la date de création de la commande
            const dateKey = commandeDetails.date_add ? new Date(commandeDetails.date_add).toISOString().split('T')[0] : null
            
            if (!dateKey) {
                continue
            }
            
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    total_orders: 0,
                    total_amount: 0
                }
            }

            groupedByDate[dateKey].total_orders += 1
            groupedByDate[dateKey].total_amount += Number(commandeDetails.total_paid ?? 0)
        }
        
        // Retourner un tableau trié par date
        return Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date))
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function SumOrders()
{
    const commandes = await SumOrdersGroupByDate()
    let total_orders = 0
    let total_amount = 0
    for( const commande of commandes)
    {
        total_orders += commande.total_orders
        total_amount += commande.total_amount
    }
    return {
        total_orders,
        total_amount
    }
}

export async function FilterSumByDate(date_debut, date_fin)
{
    const commandes = await SumOrdersGroupByDate()
    const filtered = commandes.filter(commande => {
        const commandeDate = new Date(commande.date)
        return (!date_debut || commandeDate >= new Date(date_debut)) && (!date_fin || commandeDate <= new Date(date_fin))
    })
    return filtered
}

export async function getOrdersByCustomerId(id_customer)
{
    if (!id_customer) {
        throw new Error('id_customer is required')
    }

    const commandesDetails = []
    try {
        const commandes = await getRessourceData('orders')
        for (const commande of commandes) {
            const commandeDetails = await getRessourceItemById('orders', commande.id)
            if( commandeDetails?.id_customer != id_customer) continue
            const stateDetails = await getRessourceItemById('order_states', commandeDetails.current_state)
            const stateName = stateDetails?.name
            commandeDetails.current_state_label =
                (typeof stateName === 'string' && stateName.trim()) ||
                (Array.isArray(stateName) && stateName.find((item) => typeof item === 'string' && item.trim())) ||
                (stateName?.language && String(stateName.language).trim()) ||
                String(commandeDetails.current_state ?? '').trim()

            const deliveryDetails = await getRessourceItemById('addresses', commandeDetails.id_address_delivery)
            commandeDetails.city = deliveryDetails?.city

            commandesDetails.push(commandeDetails)
        }
        return commandesDetails
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function GetCartsGroupByDate()
{
    const carts = await getRessourceData('carts')
    const groupedByDate = {}

    try {
        for (const cart of carts) {
            if (!cart?.id) {
                continue
            }

            const cartDetails = await getRessourceItemById('carts', cart.id)
            const cartProducts = await getCartProductsByCartId(cart.id)
            console.log(`Cart ${cart.id} has products:`, cartProducts)

            // Extraire la date de création du panier sans convertir en UTC (éviter décalage de fuseau)
            const rawDate = cartDetails?.date_add
            const dateKey = rawDate ? String(rawDate).split('T')[0].split(' ')[0] : null

            if (!dateKey) {
                continue
            }

            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    total_carts: 0,
                    total_amount: 0,
                    type: 'panier'
                }
            }

            // Compter le panier une seule fois (même s'il contient plusieurs produits)
            groupedByDate[dateKey].total_carts += 1

            // Calculer le montant total du panier (somme des lignes)
            let cartTotal = 0
            for (const product of cartProducts) {
                const produit = await getRessourceItemById('products', product.id_product)
                console.log(produit.associations.stock_availables.stock_available)
                let combinationValue = []
                let extra = 0
                if( product.id_product_attribute != '0' )
                {
                    combinationValue = await getCombinationValues(product.id_product_attribute)
                    console.log('Combination ', product.id_product_attribute, ' has values: ', combinationValue)
                    extra = Number(combinationValue?.[0]?.pricePlus ?? 0)
                }
                console.log(`Product ${product.id_product} with attribute ${product.id_product_attribute} has base price ${produit.price} and extra ${extra}`)
                const basePrice = Number(produit?.price ?? 0)
                const price = basePrice + extra
                const qty = Number(product?.quantity ?? 0)
                const ht = price * qty
                const rate = Number(await getRateByTaxRulesGroupId(produit?.id_tax_rules_group) ?? 0)
                const ttc = ht * (1 + (rate || 0) / 100)
                cartTotal += Number.isFinite(ttc) ? ttc : 0
            }

            groupedByDate[dateKey].total_amount += cartTotal
        }

        // Retourner un tableau trié par date
        return Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date))
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function SumOrdersGroupByDateWithStatus(orderStatus = 'all')
{
    const commandes = await getRessourceData('orders')
    const groupedByDate = {}
    
    try {
        for (const commande of commandes) {
            if (!commande?.id) {
                continue
            }
            
            const commandeDetails = await getRessourceItemById('orders', commande.id)
            const stateDetails = await getRessourceItemById('order_states', commandeDetails.current_state)
            const stateName = stateDetails?.name
            const stateLabel =
                (typeof stateName === 'string' && stateName.trim()) ||
                (Array.isArray(stateName) && stateName.find((item) => typeof item === 'string' && item.trim())) ||
                (stateName?.language && String(stateName.language).trim()) ||
                String(commandeDetails.current_state ?? '').trim()

            // Filtrer par statut si spécifié
            if (orderStatus !== 'all' && stateLabel !== orderStatus) {
                continue
            }

            // Extraire la date de création de la commande
            const dateKey = commandeDetails.date_add ? new Date(commandeDetails.date_add).toISOString().split('T')[0] : null
            
            if (!dateKey) {
                continue
            }
            
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    total_orders: 0,
                    total_amount: 0,
                    type: 'commande',
                    status: orderStatus
                }
            }

            groupedByDate[dateKey].total_orders += 1
            groupedByDate[dateKey].total_amount += Number(commandeDetails.total_paid ?? 0)
        }
        
        // Retourner un tableau trié par date
        return Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date))
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function SumDashboardWithFilters(filterType = 'all')
{
    try {
        let result = []

        if (filterType === 'all' || filterType === 'orders') {
            const orders = await SumOrdersGroupByDate()
            result = result.concat(orders.map(o => ({...o, type: 'commande'})))
        }

        if (filterType === 'all' || filterType === 'carts') {
            const carts = await GetCartsGroupByDate()
            result = result.concat(carts.map(c => ({...c, type: 'panier'})))
        }

        if (filterType === 'paiement_effectue') {
            const orders = await SumOrdersGroupByDateWithStatus('Paiement accepté')
            result = result.concat(orders.map(o => ({...o, type: 'commande', status: 'Paiement accepté'})))
        }

        if (filterType === 'annule') {
            const orders = await SumOrdersGroupByDateWithStatus('Annulé')
            result = result.concat(orders.map(o => ({...o, type: 'commande', status: 'Annulé'})))
        }

        // Fusionner par date si nécessaire
        const merged = {}
        for (const item of result) {
            if (!merged[item.date]) {
                merged[item.date] = {
                    date: item.date,
                    total_orders: 0,
                    total_carts: 0,
                    total_orders_amount: 0,
                    total_carts_amount: 0,
                    total_amount: 0
                }
            }
            if (item.type === 'commande') {
                merged[item.date].total_orders += item.total_orders ?? 0
                merged[item.date].total_orders_amount += item.total_amount ?? 0
            } else if (item.type === 'panier') {
                merged[item.date].total_carts += item.total_carts ?? 0
                merged[item.date].total_carts_amount += item.total_amount ?? 0
            }

            merged[item.date].total_amount = merged[item.date].total_orders_amount + merged[item.date].total_carts_amount
        }

        return Object.values(merged).sort((a, b) => new Date(a.date) - new Date(b.date))
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}