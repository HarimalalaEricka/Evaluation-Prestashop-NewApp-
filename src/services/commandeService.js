import { getRessourceData, getRessourceItemById, updateResourceData, getRessourceItemXml } from './ressourcesService.js'

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
                (stateName?.language && String(stateName.language[0]).trim()) ||
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
                (stateName?.language && String(stateName.language[0] ?? stateName.language).trim()) ||
                String(etat.id ?? '').trim()

            states.push({
                id: String(etat.id),
                name: stateLabel,
            })
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

    let currentStateNode = orderNode.getElementsByTagName('current_state')[0]
    if (!currentStateNode) {
        currentStateNode = xmlDoc.createElement('current_state')
        orderNode.appendChild(currentStateNode)
    }

    while (currentStateNode.firstChild) currentStateNode.removeChild(currentStateNode.firstChild)
    currentStateNode.appendChild(xmlDoc.createCDATASection(String(newStateId)))

    const serializer = new XMLSerializer()
    const finalXml = serializer.serializeToString(xmlDoc)

    return await updateResourceData('orders', orderId, finalXml)
}