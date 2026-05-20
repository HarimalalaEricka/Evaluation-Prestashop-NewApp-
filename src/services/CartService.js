import { getRessourceData, getRessourceItemById, getRessourceItemXmlShemaBlank, insertResourceData, getRessourceItemXml, updateResourceData, setOrCreateXmlField } from './ressourcesService.js'
import { getAddressIdByCustomerId } from './customerService.js'
const DEFAULT_ID_CURRENCY = 1
const DEFAULT_ID_LANG = 1
const DEFAULT_ID_CARRIER = 1

export async function addCart(productId, qty, id_customer, id_product_attribute, isGuest = false) 
{
    if (!productId || !qty) {
        throw new Error('productId and qty are required')
    }

    console.log('[CartService:addCart] start', { productId, qty, id_customer, id_product_attribute, isGuest })

    const blankCartXml = await getRessourceItemXmlShemaBlank('carts')

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(blankCartXml, 'application/xml')

    const cartNode = xmlDoc.getElementsByTagName('cart')[0]
    if (!cartNode) {
        throw new Error('Invalid cart XML schema')
    }

    
    const id_address = await getAddressIdByCustomerId(id_customer)
    console.log('[CartService:addCart] retrieved address id', { id_address })

    // Champs obligatoires
    setOrCreateXmlField(cartNode, 'id_lang', String(DEFAULT_ID_LANG), xmlDoc)
    setOrCreateXmlField(cartNode, 'id_currency', String(DEFAULT_ID_CURRENCY), xmlDoc)
    // setOrCreateXmlField(cartNode, 'id_carrier', String(DEFAULT_ID_CARRIER), xmlDoc)
    if (isGuest) {
        setOrCreateXmlField(cartNode, 'id_customer', '0', xmlDoc)
        setOrCreateXmlField(cartNode, 'id_guest', String(id_customer), xmlDoc)
    } else {
        setOrCreateXmlField(cartNode, 'id_guest', '0', xmlDoc)
        setOrCreateXmlField(cartNode, 'id_customer', String(id_customer), xmlDoc)
        setOrCreateXmlField(cartNode, 'id_address_delivery', String(id_address), xmlDoc)
        setOrCreateXmlField(cartNode, 'id_address_invoice', String(id_address), xmlDoc)
    }

    // Cart row
    let cartRowsNode = cartNode.getElementsByTagName('cart_rows')[0]
    if (!cartRowsNode) {
        const associationsNode = cartNode.getElementsByTagName('associations')[0] || xmlDoc.createElement('associations')
        if (!associationsNode.parentNode) {
            cartNode.appendChild(associationsNode)
        }

        cartRowsNode = xmlDoc.createElement('cart_rows')
        associationsNode.appendChild(cartRowsNode)
    }

    let cartRow = cartRowsNode.getElementsByTagName('cart_row')[0]
    if (!cartRow) {
        cartRow = xmlDoc.createElement('cart_row')
        cartRowsNode.appendChild(cartRow)
    }


    setOrCreateXmlField(cartRow, 'id_product', String(productId), xmlDoc)
    setOrCreateXmlField(cartRow, 'id_product_attribute', String(id_product_attribute), xmlDoc)
    setOrCreateXmlField(cartRow, 'quantity', String(qty), xmlDoc)
    setOrCreateXmlField(cartRow, 'id_address_delivery', String(id_address), xmlDoc)


    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)

    console.log('[CartService:addCart] payload ready')

    const response = await insertResourceData('carts', finalXml)
    console.log('[CartService:addCart] created cart response', response)
    return response
}
export async function updateCart(cartId, productId, qty, id_product_attribute)
{
    if (!cartId) throw new Error('cartId is required')
    if (!productId || !qty) {
        throw new Error('productId and qty are required')
    }

    console.log('[CartService:updateCart] start', { cartId, productId, qty, id_product_attribute })

    const CartXml = await getRessourceItemXml('carts', cartId)

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(CartXml, 'application/xml')

    const cartNode = xmlDoc.getElementsByTagName('cart')[0]
    if (!cartNode) {
        throw new Error('Invalid cart XML schema')
    }

    // Champs obligatoires
    setOrCreateXmlField(cartNode, 'id', String(cartId), xmlDoc)
    // setOrCreateXmlField(cartNode, 'id_carrier', String(DEFAULT_ID_CARRIER), xmlDoc)

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

    const idCustomerNode = cartNode.getElementsByTagName('id_customer')[0]
    const idGuestNode = cartNode.getElementsByTagName('id_guest')[0]
    const customerId = String(idCustomerNode?.textContent ?? idGuestNode?.textContent ?? '').trim()
    if (!customerId || customerId === '0') {
        throw new Error('Unable to resolve customer id from cart')
    }

    const id_address = await getAddressIdByCustomerId(customerId)
    console.log('[CartService:updateCart] retrieved address id', { id_address })

    setOrCreateXmlField(cartRow, 'id_product', String(productId), xmlDoc)
    setOrCreateXmlField(cartRow, 'id_product_attribute', String(id_product_attribute), xmlDoc)
    setOrCreateXmlField(cartRow, 'id_address_delivery', String(id_address), xmlDoc)
    setOrCreateXmlField(cartRow, 'quantity', String(qty), xmlDoc)

    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)
    // return finalXml
    const response = await updateResourceData('carts', cartId, finalXml)
    console.log('[CartService:updateCart] updated cart response', response)
    return response
}
export async function updateQuantityCart(cartId, productId, qty)
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
    setOrCreateXmlField(cartNode, 'id', String(cartId), xmlDoc)
    // setOrCreateXmlField(cartNode, 'id_carrier', String(DEFAULT_ID_CARRIER), xmlDoc)
    const cartRowsNode = cartNode.getElementsByTagName('cart_rows')[0]
    if (!cartRowsNode) {
        throw new Error('No cart_rows found in cart XML')
    }
    const cartRowNodes = cartRowsNode.getElementsByTagName('cart_row')
    let found = false
    for (let i = 0; i < cartRowNodes.length; i++) {
        const cartRowNode = cartRowNodes[i]
        const idProductNode = cartRowNode.getElementsByTagName('id_product')[0]
        if (idProductNode && idProductNode.textContent === String(productId)) {
            const quantityNode = cartRowNode.getElementsByTagName('quantity')[0]
            if (quantityNode) {
                quantityNode.textContent = String(qty)
                found = true
                break
            }
        }
    }
    if (!found) {
        throw new Error('Product not found in cart')
    }

    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)
    // return finalXml
    const response = await updateResourceData('carts', cartId, finalXml)
    console.log('[CartService:updateQuantityCart] updated cart response', response)
    return response
}

export async function getCartByCustomerId(id_customer) {
    if (!id_customer) throw new Error('id_customer required')

    console.log('[CartService:getCartByCustomerId] start', { id_customer })

    try 
    {
        // Load list of carts and then their full details
        const carts = await getRessourceData('carts')
        const cartsDetails = await Promise.all(carts.map((cart) => getRessourceItemById('carts', cart.id)))

        // Filter by customer only
        const candidateCarts = cartsDetails
            .filter((cart) => String(cart.id_customer) === String(id_customer))
            .sort((a, b) => Number(b.id) - Number(a.id))

        console.log('[CartService:getCartByCustomerId] candidate carts', candidateCarts.map((cart) => cart.id))

        if (candidateCarts.length === 0) return null

        // Only the most recent cart can be active.
        // If it is already linked to an order, the customer has no active cart,
        // even if older carts are still unassigned.
        const orders = await getRessourceData('orders')
        const ordersDetails = await Promise.all(orders.map((o) => getRessourceItemById('orders', o.id)))
        const orderCartIds = new Set(ordersDetails.map((o) => String(o.id_cart)))

        const latestCart = candidateCarts[0]
        const latestCartId = String(latestCart?.id ?? '')
        const latestCartHasOrder = orderCartIds.has(latestCartId)

        console.log('[CartService:getCartByCustomerId] latest cart', latestCart?.id ?? null)
        console.log('[CartService:getCartByCustomerId] latest cart linked to order', latestCartHasOrder)

        if (latestCartHasOrder) return null

        const selected = latestCart

        console.log('[CartService:getCartByCustomerId] selected cart', selected?.id ?? null)

        return selected
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
    }
}

export async function getCartByGuestId(id_guest) {
    if (!id_guest) throw new Error('id_guest required')

    console.log('[CartService:getCartByGuestId] start', { id_guest })

    try 
    {
        // Load list of carts and then their full details
        const carts = await getRessourceData('carts')
        const cartsDetails = await Promise.all(carts.map((cart) => getRessourceItemById('carts', cart.id)))

        // Filter by customer only
        const candidateCarts = cartsDetails
            .filter((cart) => String(cart.id_guest) === String(id_guest))
            .sort((a, b) => Number(b.id) - Number(a.id))

        console.log('[CartService:getCartByGuestId] candidate carts', candidateCarts.map((cart) => cart.id))

        if (candidateCarts.length === 0) return null

        // Only the most recent cart can be active.
        // If it is already linked to an order, the guest has no active cart,
        // even if older carts are still unassigned.
        const orders = await getRessourceData('orders')
        const ordersDetails = await Promise.all(orders.map((o) => getRessourceItemById('orders', o.id)))
        const orderCartIds = new Set(ordersDetails.map((o) => String(o.id_cart)))

        const latestCart = candidateCarts[0]
        const latestCartId = String(latestCart?.id ?? '')
        const latestCartHasOrder = orderCartIds.has(latestCartId)

        console.log('[CartService:getCartByGuestId] latest cart', latestCart?.id ?? null)
        console.log('[CartService:getCartByGuestId] latest cart linked to order', latestCartHasOrder)

        if (latestCartHasOrder) return null

        const selected = latestCart

        console.log('[CartService:getCartByCustomerId] selected cart', selected?.id ?? null)

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
        quantity: row.quantity,
        id_product_attribute: row.id_product_attribute,
        }))
}

export async function deleteCartRow(cartId, productId, id_product_attribute) {
    if (!cartId) throw new Error('cartId is required')
    if (!productId) throw new Error('productId is required')
    if (id_product_attribute == null) throw new Error('id_product_attribute is required')

    console.log('[CartService:deleteCartRow] start', { cartId, productId, id_product_attribute })

    const cartXml = await getRessourceItemXml('carts', cartId)
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(cartXml, 'application/xml')

    const cartNode = xmlDoc.getElementsByTagName('cart')[0]
    if (!cartNode) {
        throw new Error('Invalid cart XML schema')
    }

    const cartRowsNode = cartNode.getElementsByTagName('cart_rows')[0]
    if (!cartRowsNode) {
        throw new Error('No cart_rows found in cart XML')
    }

    const cartRowNodes = Array.from(cartRowsNode.getElementsByTagName('cart_row'))
    const rowsToRemove = cartRowNodes.filter((row) => {
        const idProductNode = row.getElementsByTagName('id_product')[0]
        const idProductAttributeNode = row.getElementsByTagName('id_product_attribute')[0]
        const rowProductId = String(idProductNode?.textContent ?? '').trim()
        const rowProductAttributeId = String(idProductAttributeNode?.textContent ?? '').trim()
        return rowProductId === String(productId).trim() && rowProductAttributeId === String(id_product_attribute).trim()
    })

    if (rowsToRemove.length === 0) {
        throw new Error('Product row not found in cart for provided id_product and id_product_attribute')
    }

    for (const row of rowsToRemove) {
        cartRowsNode.removeChild(row)
    }

    const remainingRows = cartRowsNode.getElementsByTagName('cart_row').length
    console.log('[CartService:deleteCartRow] removed rows', {
        removedCount: rowsToRemove.length,
        remainingRows,
    })

    setOrCreateXmlField(cartNode, 'id', String(cartId), xmlDoc)
    // setOrCreateXmlField(cartNode, 'id_carrier', String(DEFAULT_ID_CARRIER), xmlDoc)
    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)
    await updateResourceData('carts', cartId, finalXml)

    console.log('[CartService:deleteCartRow] cart updated after row deletion', { cartId, remainingRows })
    return {
        deletedCart: false,
        cartId: String(cartId),
        removedRows: rowsToRemove.length,
        remainingRows,
    }
}
