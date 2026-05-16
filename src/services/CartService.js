import { getRessourceData, getRessourceItemById, getRessourceItemXmlShemaBlank, insertResourceData, getRessourceItemXml, updateResourceData, setOrCreateXmlField } from './ressourcesService.js'
const DEFAULT_ID_CURRENCY = 1
const DEFAULT_ID_LANG = 1

export async function addCart(productId, qty, id_customer) 
{
    if (!productId || !qty) {
        throw new Error('productId and qty are required')
    }

    const blankCartXml = await getRessourceItemXmlShemaBlank('carts')

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(blankCartXml, 'application/xml')

    const cartNode = xmlDoc.getElementsByTagName('cart')[0]
    if (!cartNode) {
        throw new Error('Invalid cart XML schema')
    }

    // Champs obligatoires
    setOrCreateXmlField(cartNode, 'id_lang', String(DEFAULT_ID_LANG), xmlDoc)
    setOrCreateXmlField(cartNode, 'id_currency', String(DEFAULT_ID_CURRENCY), xmlDoc)
    setOrCreateXmlField(cartNode, 'id_customer', String(id_customer), xmlDoc)

    // Cart row
    const cartRow = cartNode.getElementsByTagName('cart_row')[0]
    setOrCreateXmlField(cartRow, 'id_product', String(productId), xmlDoc)
    setOrCreateXmlField(cartRow, 'id_product_attribute', '0', xmlDoc)
    setOrCreateXmlField(cartRow, 'id_address_delivery', '0', xmlDoc)
    setOrCreateXmlField(cartRow, 'quantity', String(qty), xmlDoc)

    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)

    return await insertResourceData('carts', finalXml)
}
export async function updateCart(cartId, productId, qty)
{
    if (!cartId) throw new Error('cartId is required')
    if (!productId || !qty) {
        throw new Error('productId and qty are required')
    }

    const CartXml = await getRessourceItemXml('carts', cartId)

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(CartXml, 'application/xml')

    const cartNode = xmlDoc.getElementsByTagName('cart')[0]
    if (!cartNode) {
        throw new Error('Invalid cart XML schema')
    }

    // Champs obligatoires
    setOrCreateXmlField(cartNode, 'id', String(cartId), xmlDoc)

    // Conserver les cart_row existants et en ajouter un nouveau à la fin
    let cartRowsNode = cartNode.getElementsByTagName('cart_rows')[0]
    if (!cartRowsNode) {
        const associationsNode = cartNode.getElementsByTagName('associations')[0] || xmlDoc.createElement('associations')
        if (!associationsNode.parentNode) {
            cartNode.appendChild(associationsNode)
        }

        cartRowsNode = xmlDoc.createElement('cart_rows')
        associationsNode.appendChild(cartRowsNode)
    }

    // Ajouter la nouvelle ligne de panier demandée en 3e position logique
    const cartRow = xmlDoc.createElement('cart_row')
    cartRowsNode.appendChild(cartRow)

    setOrCreateXmlField(cartRow, 'id_product', String(productId), xmlDoc)
    setOrCreateXmlField(cartRow, 'id_product_attribute', '0', xmlDoc)
    setOrCreateXmlField(cartRow, 'id_address_delivery', '0', xmlDoc)
    setOrCreateXmlField(cartRow, 'quantity', String(qty), xmlDoc)

    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)
    // return finalXml
    return await updateResourceData('carts', cartId, finalXml)
}
// export async function updateQuantityCart(cartId, productId, qty)
// {
//     if (!cartId) throw new Error('cartId is required')
//     if (!productId || !qty) {
//         throw new Error('productId and qty are required')
//     }
//     const CartXml = await getRessourceItemXml('carts', cartId)

//     const parser = new DOMParser()
//     const xmlDoc = parser.parseFromString(CartXml, 'application/xml')

//     const cartNode = xmlDoc.getElementsByTagName('cart')[0]
//     if (!cartNode) {
//         throw new Error('Invalid cart XML schema')
//     }
//     setOrCreateXmlField(cartNode, 'id', String(cartId), xmlDoc)
//     const cartRowsNode = cartNode.getElementsByTagName('cart_rows')[0]
//     if (!cartRowsNode) {
//         throw new Error('No cart_rows found in cart XML')
//     }

// }

export async function getCartByCustomerId(id_customer) {
    if (!id_customer) throw new Error('id_customer required')

    try 
    {
        // Load list of carts and then their full details
        const carts = await getRessourceData('carts')
        const cartsDetails = await Promise.all(carts.map((cart) => getRessourceItemById('carts', cart.id)))

        // Filter by customer only
        let candidateCarts = cartsDetails.filter((cart) => String(cart.id_customer) === String(id_customer))

        if (candidateCarts.length === 0) return null

        // Exclude carts that are already linked to orders (orders.id_cart)
        const orders = await getRessourceData('orders')
        const ordersDetails = await Promise.all(orders.map((o) => getRessourceItemById('orders', o.id)))
        const orderCartIds = new Set(ordersDetails.map((o) => String(o.id_cart)))

        candidateCarts = candidateCarts.filter((cart) => !orderCartIds.has(String(cart.id)))

        if (candidateCarts.length === 0) return null

        // Return the cart with the largest id (highest id_cart)
        let maxId = -Infinity
        let selected = null
        for (const c of candidateCarts) {
            const numericId = Number(c.id)
            if (!Number.isNaN(numericId) && numericId > maxId) {
                maxId = numericId
                selected = c
            }
        }

        return selected
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function getCartProductsByCartId(id_cart)
{
    if (!id_cart) throw new Error('id_cart required')
    const cart = await getRessourceItemById('carts', id_cart)
    const cartRowsContainer = cart?.associations?.cart_rows
    if (!cartRowsContainer) {
        return []
    }

    const cartRows = cartRowsContainer.cart_row ?? cartRowsContainer
    const normalizedRows = Array.isArray(cartRows) ? cartRows : [cartRows]

    return normalizedRows
        .filter((row) => row && row.id_product != null)
        .map((row) => ({
        id_product: row.id_product,
        quantity: row.quantity
        }))
}