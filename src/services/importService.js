import { getRessourceData, getAuthHeaders, getHttpErrorMessage, updateResourceData } from './ressourcesService.js'

const BASE_URL = import.meta.env.VITE_API_PROXY_PATH
const ID_COUNTRY = import.meta.env.VITE_ID_COUNTRY
const REQUEST_TIMEOUT_MS = 10000
const DEFAULT_ID_SHOP = String(import.meta.env.VITE_ID_SHOP ?? '').trim()
const DEFAULT_ID_SHOP_GROUP = String(import.meta.env.VITE_ID_SHOP_GROUP ?? '').trim()
const DEFAULT_ID_CURRENCY = String(import.meta.env.VITE_ID_CURRENCY ?? '1').trim() || '1'
const DEFAULT_ID_LANG = String(import.meta.env.VITE_ID_LANG ?? '1').trim() || '1'
const DEFAULT_CUSTOMER_GROUP_ID = String(import.meta.env.VITE_ID_CUSTOMER_GROUP ?? '3').trim() || '3'
const DEFAULT_OUT_OF_STOCK = String(import.meta.env.VITE_OUT_OF_STOCK ?? '2').trim() || '2'
const DEFAULT_DEPENDS_ON_STOCK = String(import.meta.env.VITE_DEPENDS_ON_STOCK ?? '0').trim() || '0'
const DEFAULT_ORDER_PAYMENT = import.meta.env.VITE_ORDER_PAYMENT || 'Import CSV'

function normalizeLookupKey(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '')
}

function normalizeRateKey(value) {
    const normalized = String(value ?? '')
        .trim()
        .replace(/%/g, '')
        .replace(/,/g, '.')
        .replace(/\s+/g, '')

    // Convertir en nombre pour supprimer les zéros inutiles
    const numValue = parseFloat(normalized)
    return isNaN(numValue) ? normalized : String(numValue)
}

function slugify(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function buildMultiLangXml(tagName, value, languageIds = [1]) {
    const xmlValue = String(value ?? '')
    return `<${tagName}>${languageIds.map((languageId) => `\n  <language id="${languageId}"><![CDATA[${xmlValue}]]></language>`).join('')}\n</${tagName}>`
}

function buildCategoryXml(categoryName, languageIds = [1]) {
    const slug = slugify(categoryName)
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<category>\n<id_parent><![CDATA[2]]></id_parent>\n<active><![CDATA[1]]></active>\n<id_shop_default><![CDATA[1]]></id_shop_default>\n<is_root_category><![CDATA[0]]></is_root_category>\n${buildMultiLangXml('name', categoryName, languageIds)}\n${buildMultiLangXml('link_rewrite', slug, languageIds)}\n</category>\n</prestashop>`
}

function buildTaxXml(rateValue, languageIds = [1]) {
    const normalizedRate = normalizeRateKey(rateValue)
    const taxName = `Tax ${normalizedRate}%`
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<tax>\n<rate><![CDATA[${normalizedRate}]]></rate>\n<active><![CDATA[1]]></active>\n<deleted><![CDATA[0]]></deleted>\n${buildMultiLangXml('name', taxName, languageIds)}\n</tax>\n</prestashop>`
}

function buildTaxRuleGroupXml(rateValue, languageIds = [1]) {
    const normalizedRate = normalizeRateKey(rateValue)
    const groupName = `TVA ${normalizedRate}%`
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<tax_rule_group>\n<name><![CDATA[${groupName}]]></name>\n<active><![CDATA[1]]></active>\n<deleted><![CDATA[0]]></deleted>\n</tax_rule_group>\n</prestashop>`
}

function buildTaxRuleXml({ groupId, taxId, countryId }) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<tax_rule>\n<id_tax_rules_group><![CDATA[${groupId}]]></id_tax_rules_group>\n<id_state><![CDATA[1]]></id_state>\n<id_country><![CDATA[${countryId}]]></id_country>\n<zipcode_from><![CDATA[0]]></zipcode_from>\n<zipcode_to><![CDATA[0]]></zipcode_to>\n<id_tax><![CDATA[${taxId}]]></id_tax>\n<behavior><![CDATA[0]]></behavior>\n<description><![CDATA[]]></description>\n</tax_rule>\n</prestashop>`
}

function extractCreatedId(xmlText) {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        return ''
    }

    const idNode = xmlDoc.getElementsByTagName('id')[0]
    return String(idNode?.textContent ?? '').trim()
}

async function getDefaultTaxCountryId() {
    const envCountryId = String(ID_COUNTRY ?? '').trim()

    if (envCountryId) {
        return envCountryId
    }

    try {
        const countries = await getRessourceData('countries')
        return String(countries[0]?.id ?? '0').trim() || '0'
    } catch {
        return '0'
    }
}

async function fetchXmlDocument(resourceName) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res

    try {
        res = await fetch(`${BASE_URL}/${resourceName}`, {
            headers: {
                ...getAuthHeaders(),
            },
            signal: controller.signal,
        })
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw new Error('Erreur réseau API')
    } finally {
        window.clearTimeout(timeoutId)
    }

    if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

    const xmlText = await res.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        throw new Error('Erreur parsing XML')
    }

    return xmlDoc
}

function parseDecimalValue(value) {
    const normalized = String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/%/g, '')
        .replace(/,/g, '.')

    if (!normalized) {
        return null
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

function parseIntegerValue(value) {
    const normalized = String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/,/g, '.')

    if (!normalized) {
        return null
    }

    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) {
        return null
    }

    return Math.trunc(parsed)
}

function normalizeDateString(value) {
    const cleaned = String(value ?? '').trim()

    if (!cleaned) {
        return new Date().toISOString().slice(0, 19).replace('T', ' ')
    }

    const slashMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (slashMatch) {
        const [, day, month, year] = slashMatch
        return `${year}-${month}-${day} 00:00:00`
    }

    const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
        return `${cleaned} 00:00:00`
    }

    const parsed = new Date(cleaned)
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString().slice(0, 19).replace('T', ' ')
    }

    return parsed.toISOString().slice(0, 19).replace('T', ' ')
}

function parsePurchaseList(rawValue) {
    const cleaned = String(rawValue ?? '').trim()

    if (!cleaned) {
        return []
    }

    const normalized = cleaned
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .replace(/\(\("/g, '("')
        .replace(/"\)\s*,\s*\("/g, '"),("')

    const regex = /\("([^"]*)"\s*;\s*([0-9]+)\s*;\s*"([^"]*)"\)/g
    const items = []
    let match

    while ((match = regex.exec(normalized)) !== null) {
        items.push({
            reference: String(match[1] ?? '').trim(),
            quantity: Math.max(0, Math.trunc(Number(match[2]) || 0)),
            variant: String(match[3] ?? '').trim(),
        })
    }

    return items
}

function buildStockAvailableXml({
    id,
    productId,
    productAttributeId = 0,
    quantity,
    idShop,
    idShopGroup,
    outOfStock = DEFAULT_OUT_OF_STOCK,
    dependsOnStock = DEFAULT_DEPENDS_ON_STOCK,
}) {
    const cleanedId = String(id ?? '').trim()
    const cleanedProductId = String(productId ?? '').trim()
    const cleanedProductAttributeId = String(productAttributeId ?? '0').trim() || '0'
    const cleanedQuantity = String(quantity ?? '0').trim() || '0'
    const cleanedIdShop = String(idShop ?? DEFAULT_ID_SHOP ?? '0').trim() || '0'
    const cleanedIdShopGroup = String(idShopGroup ?? DEFAULT_ID_SHOP_GROUP ?? '0').trim() || '0'
    const cleanedOutOfStock = String(outOfStock ?? DEFAULT_OUT_OF_STOCK).trim() || DEFAULT_OUT_OF_STOCK
    const cleanedDependsOnStock = String(dependsOnStock ?? DEFAULT_DEPENDS_ON_STOCK).trim() || DEFAULT_DEPENDS_ON_STOCK

    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<stock_available>\n${cleanedId ? `<id><![CDATA[${cleanedId}]]></id>\n` : ''}<id_product><![CDATA[${cleanedProductId}]]></id_product>\n<id_product_attribute><![CDATA[${cleanedProductAttributeId}]]></id_product_attribute>\n<id_shop><![CDATA[${cleanedIdShop}]]></id_shop>\n<id_shop_group><![CDATA[${cleanedIdShopGroup}]]></id_shop_group>\n<quantity><![CDATA[${cleanedQuantity}]]></quantity>\n<depends_on_stock><![CDATA[${cleanedDependsOnStock}]]></depends_on_stock>\n<out_of_stock><![CDATA[${cleanedOutOfStock}]]></out_of_stock>\n</stock_available>\n</prestashop>`
}

function buildCustomerXml({
    lastname,
    firstname,
    email,
    passwd,
    dateAdd,
    idLang = DEFAULT_ID_LANG,
    idShop = DEFAULT_ID_SHOP || '1',
    idShopGroup = DEFAULT_ID_SHOP_GROUP || '1',
    idDefaultGroup = DEFAULT_CUSTOMER_GROUP_ID,
    secureKey = '',
}) {
    const cleanedLastname = String(lastname ?? '').trim()
    const cleanedFirstname = String(firstname ?? cleanedLastname).trim()
    const cleanedEmail = String(email ?? '').trim()
    const cleanedPasswd = String(passwd ?? '').trim()
    const cleanedDateAdd = String(dateAdd ?? '').trim() || new Date().toISOString().slice(0, 19).replace('T', ' ')
    const cleanedSecureKey = String(secureKey ?? '').trim() || crypto.randomUUID().replace(/-/g, '')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<customer>\n<id_default_group><![CDATA[${idDefaultGroup}]]></id_default_group>\n<id_lang><![CDATA[${idLang}]]></id_lang>\n<secure_key><![CDATA[${cleanedSecureKey}]]></secure_key>\n<passwd><![CDATA[${cleanedPasswd}]]></passwd>\n<lastname><![CDATA[${cleanedLastname}]]></lastname>\n<firstname><![CDATA[${cleanedFirstname}]]></firstname>\n<email><![CDATA[${cleanedEmail}]]></email>\n<active><![CDATA[1]]></active>\n<id_shop><![CDATA[${idShop}]]></id_shop>\n<id_shop_group><![CDATA[${idShopGroup}]]></id_shop_group>\n<date_add><![CDATA[${cleanedDateAdd}]]></date_add>\n<date_upd><![CDATA[${cleanedDateAdd}]]></date_upd>\n<associations>\n<groups>\n<group><id><![CDATA[${idDefaultGroup}]]></id></group>\n</groups>\n</associations>\n</customer>\n</prestashop>`
}

function buildAddressXml({
    idCustomer,
    lastname,
    firstname,
    address1,
    idCountry,
    dateAdd,
    alias = 'Adresse',
    postcode = '00000',
    city = '',
    idShop = DEFAULT_ID_SHOP || '1',
    idShopGroup = DEFAULT_ID_SHOP_GROUP || '1',
}) {
    const cleanedDateAdd = String(dateAdd ?? '').trim() || new Date().toISOString().slice(0, 19).replace('T', ' ')
    const cleanedCity = String(city ?? address1 ?? '').trim() || 'Ville'

    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<address>\n<id_customer><![CDATA[${idCustomer}]]></id_customer>\n<id_country><![CDATA[${idCountry}]]></id_country>\n<alias><![CDATA[${alias}]]></alias>\n<lastname><![CDATA[${lastname ?? ''}]]></lastname>\n<firstname><![CDATA[${firstname ?? lastname ?? ''}]]></firstname>\n<address1><![CDATA[${address1 ?? ''}]]></address1>\n<postcode><![CDATA[${postcode}]]></postcode>\n<city><![CDATA[${cleanedCity}]]></city>\n<active><![CDATA[1]]></active>\n<date_add><![CDATA[${cleanedDateAdd}]]></date_add>\n<date_upd><![CDATA[${cleanedDateAdd}]]></date_upd>\n<id_shop><![CDATA[${idShop}]]></id_shop>\n<id_shop_group><![CDATA[${idShopGroup}]]></id_shop_group>\n</address>\n</prestashop>`
}

function buildCartRowXml({ productId, productAttributeId = 0, quantity }) {
    return `<cart_row>\n<id_product><![CDATA[${productId}]]></id_product>\n<id_product_attribute><![CDATA[${productAttributeId}]]></id_product_attribute>\n<id_address_delivery><![CDATA[0]]></id_address_delivery>\n<id_customization><![CDATA[0]]></id_customization>\n<quantity><![CDATA[${quantity}]]></quantity>\n</cart_row>`
}

function buildOrderRowXml({
    productId,
    productAttributeId = 0,
    quantity,
    productName,
    productReference,
    productPrice,
    unitPriceTaxIncl,
    unitPriceTaxExcl,
}) {
    return `<order_row>\n<product_id><![CDATA[${productId}]]></product_id>\n<product_attribute_id><![CDATA[${productAttributeId}]]></product_attribute_id>\n<product_quantity><![CDATA[${quantity ?? 0}]]></product_quantity>\n<product_name><![CDATA[${productName ?? ''}]]></product_name>\n<product_reference><![CDATA[${productReference ?? ''}]]></product_reference>\n<product_price><![CDATA[${productPrice ?? '0'}]]></product_price>\n<unit_price_tax_incl><![CDATA[${unitPriceTaxIncl ?? '0'}]]></unit_price_tax_incl>\n<unit_price_tax_excl><![CDATA[${unitPriceTaxExcl ?? '0'}]]></unit_price_tax_excl>\n</order_row>`
}

function buildCartXml({
    idCustomer,
    idAddressDelivery,
    idAddressInvoice,
    idCurrency = DEFAULT_ID_CURRENCY,
    idLang = DEFAULT_ID_LANG,
    idCarrier = '0',
    idShop = DEFAULT_ID_SHOP || '1',
    idShopGroup = DEFAULT_ID_SHOP_GROUP || '1',
    secureKey = '',
    rows = [],
}) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const cartRows = rows.map((row) => buildCartRowXml(row)).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<cart>\n<id_customer><![CDATA[${idCustomer}]]></id_customer>\n<id_address_delivery><![CDATA[${idAddressDelivery}]]></id_address_delivery>\n<id_address_invoice><![CDATA[${idAddressInvoice}]]></id_address_invoice>\n<id_currency><![CDATA[${idCurrency}]]></id_currency>\n<id_lang><![CDATA[${idLang}]]></id_lang>\n<id_shop_group><![CDATA[${idShopGroup}]]></id_shop_group>\n<id_shop><![CDATA[${idShop}]]></id_shop>\n<id_carrier><![CDATA[${idCarrier}]]></id_carrier>\n<secure_key><![CDATA[${secureKey}]]></secure_key>\n<date_add><![CDATA[${now}]]></date_add>\n<date_upd><![CDATA[${now}]]></date_upd>\n<associations>\n<cart_rows>\n${cartRows}\n</cart_rows>\n</associations>\n</cart>\n</prestashop>`
}

function buildOrderXml({
    idCustomer,
    idAddressDelivery,
    idAddressInvoice,
    idCart,
    idCurrency = DEFAULT_ID_CURRENCY,
    idLang = DEFAULT_ID_LANG,
    idCarrier = '0',
    idShop = DEFAULT_ID_SHOP || '1',
    idShopGroup = DEFAULT_ID_SHOP_GROUP || '1',
    currentState,
    payment = DEFAULT_ORDER_PAYMENT,
    secureKey = '',
    totals,
    rows = [],
}) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const orderRows = rows.map((row) => buildOrderRowXml(row)).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<order>\n<id_address_delivery><![CDATA[${idAddressDelivery}]]></id_address_delivery>\n<id_address_invoice><![CDATA[${idAddressInvoice}]]></id_address_invoice>\n<id_cart><![CDATA[${idCart}]]></id_cart>\n<id_currency><![CDATA[${idCurrency}]]></id_currency>\n<id_lang><![CDATA[${idLang}]]></id_lang>\n<id_customer><![CDATA[${idCustomer}]]></id_customer>\n<id_carrier><![CDATA[${idCarrier}]]></id_carrier>\n<current_state><![CDATA[${currentState}]]></current_state>\n<module><![CDATA[ps_cashondelivery]></module>\n<valid><![CDATA[1]]></valid>\n<date_add><![CDATA[${now}]]></date_add>\n<date_upd><![CDATA[${now}]]></date_upd>\n<id_shop_group><![CDATA[${idShopGroup}]]></id_shop_group>\n<id_shop><![CDATA[${idShop}]]></id_shop>\n<secure_key><![CDATA[${secureKey}]]></secure_key>\n<payment><![CDATA[${payment}]]></payment>\n<total_discounts><![CDATA[0]]></total_discounts>\n<total_discounts_tax_incl><![CDATA[0]]></total_discounts_tax_incl>\n<total_discounts_tax_excl><![CDATA[0]]></total_discounts_tax_excl>\n<total_paid><![CDATA[${totals.totalPaid}]]></total_paid>\n<total_paid_tax_incl><![CDATA[${totals.totalPaidTaxIncl}]]></total_paid_tax_incl>\n<total_paid_tax_excl><![CDATA[${totals.totalPaidTaxExcl}]]></total_paid_tax_excl>\n<total_paid_real><![CDATA[${totals.totalPaid}]]></total_paid_real>\n<total_products><![CDATA[${totals.totalProducts}]]></total_products>\n<total_products_wt><![CDATA[${totals.totalProductsWt}]]></total_products_wt>\n<total_shipping><![CDATA[0]]></total_shipping>\n<total_shipping_tax_incl><![CDATA[0]]></total_shipping_tax_incl>\n<total_shipping_tax_excl><![CDATA[0]]></total_shipping_tax_excl>\n<conversion_rate><![CDATA[1]]></conversion_rate>\n<associations>\n<order_rows>\n${orderRows}\n</order_rows>\n</associations>\n</order>\n</prestashop>`
}

// --- Order schema / display helpers ---
export async function getOrderSchema() {
    try {
        const xmlDoc = await fetchXmlDocument('orders?schema=blank')
        const itemTag = 'order'
        const items = xmlDoc.getElementsByTagName(itemTag)

        if (!items || items.length === 0) {
            const tryDirect = xmlDoc.getElementsByTagName('orders')
            if (!tryDirect || tryDirect.length === 0) return []
            const firstDirect = tryDirect[0]
            return Array.from(firstDirect.children).map((c) => c.tagName).filter(Boolean)
        }

        const first = items[0]
        const childNames = Array.from(first.children)
            .map((c) => c.tagName)
            .filter((n, i, arr) => n && arr.indexOf(n) === i)

        return childNames
    } catch (err) {
        return []
    }
}

export async function fetchOrdersDisplayFull() {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const res = await fetch(`${BASE_URL}/orders?display=full`, {
            headers: {
                ...getAuthHeaders(),
                Accept: 'application/xml',
            },
            signal: controller.signal,
        })
        window.clearTimeout(timeoutId)
        const text = await res.text()
        return text
    } catch (err) {
        window.clearTimeout(timeoutId)
        throw err
    }
}

export async function buildOrderXmlFromSchema(values = {}, rows = [], totals = {}) {
    const fields = await getOrderSchema()
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    // Build simple field map using known names if present in schema
    const toCamel = (s = '') => String(s).replace(/_([a-z])/g, (_, g) => g.toUpperCase())
    const normalizeKeyVariants = (name) => {
        const camel = toCamel(name)
        const compact = name.replace(/_/g, '')
        return [name, camel, compact]
    }

    const fieldValue = (name, fallback = '') => {
        const variants = normalizeKeyVariants(name)
        for (const k of variants) {
            if (Object.prototype.hasOwnProperty.call(values, k) && values[k] !== undefined && values[k] !== null) {
                return String(values[k])
            }
            // also try lowercase variant
            const lk = String(k).toLowerCase()
            if (Object.prototype.hasOwnProperty.call(values, lk) && values[lk] !== undefined && values[lk] !== null) {
                return String(values[lk])
            }
        }

        // totals map: try totals object keys as well
        for (const k of variants) {
            if (Object.prototype.hasOwnProperty.call(totals, k) && totals[k] !== undefined && totals[k] !== null) {
                return String(totals[k])
            }
            const lk = String(k).toLowerCase()
            if (Object.prototype.hasOwnProperty.call(totals, lk) && totals[lk] !== undefined && totals[lk] !== null) {
                return String(totals[lk])
            }
        }

        return fallback
    }

    const body = []

    // Common single fields
    const common = [
        'id_address_delivery','id_address_invoice','id_cart','id_currency','id_lang','id_customer',
        'id_carrier','current_state','module','valid','date_add','date_upd','id_shop_group','id_shop','secure_key','payment',
        'conversion_rate','total_discounts','total_discounts_tax_incl','total_discounts_tax_excl','total_paid','total_paid_tax_incl','total_paid_tax_excl','total_paid_real','total_products','total_products_wt','total_shipping'
    ]

    for (const name of common) {
        if (fields.includes(name)) {
            let val = ''
            switch (name) {
                case 'module': val = fieldValue(name, 'ps_cashondelivery'); break
                case 'valid': val = fieldValue(name, '1'); break
                case 'date_add': val = fieldValue(name, now); break
                case 'date_upd': val = fieldValue(name, now); break
                case 'conversion_rate': val = fieldValue(name, '1'); break
                case 'total_paid': val = fieldValue(name, totals.totalPaid ?? totals.total_paid ?? totals.total_paid_tax_incl ?? '0'); break
                case 'total_paid_tax_incl': val = fieldValue(name, totals.totalPaidTaxIncl ?? totals.total_paid_tax_incl ?? '0'); break
                case 'total_paid_tax_excl': val = fieldValue(name, totals.totalPaidTaxExcl ?? totals.total_paid_tax_excl ?? '0'); break
                case 'total_paid_real': val = fieldValue(name, totals.totalPaidReal ?? totals.total_paid_real ?? totals.totalPaid ?? ''); break
                case 'total_products': val = fieldValue(name, totals.totalProducts ?? '0'); break
                case 'total_products_wt': val = fieldValue(name, totals.totalProductsWt ?? '0'); break
                case 'total_shipping': val = fieldValue(name, totals.totalShipping ?? totals.total_shipping ?? '0'); break
                default: val = fieldValue(name, '')
            }
            body.push(`<${name}><![CDATA[${val}]]></${name}>`)
        }
    }

    // Associations: order_rows
    const orderRowsXml = (rows || []).map((r) => {
        const pid = r.productId || r.product_id || ''
        const paid = r.productPrice ?? r.unit_price_tax_excl ?? '0'
        const incl = r.unitPriceTaxIncl ?? r.unit_price_tax_incl ?? '0'
        const excl = r.unitPriceTaxExcl ?? r.unit_price_tax_excl ?? paid
        return `<order_row>\n<product_id><![CDATA[${pid}]]></product_id>\n<product_attribute_id><![CDATA[${r.productAttributeId || r.product_attribute_id || 0}]]></product_attribute_id>\n<product_quantity><![CDATA[${r.quantity || r.product_quantity || 0}]]></product_quantity>\n<product_name><![CDATA[${r.productName || r.product_name || ''}]]></product_name>\n<product_reference><![CDATA[${r.productReference || r.product_reference || ''}]]></product_reference>\n<product_price><![CDATA[${paid}]]></product_price>\n<unit_price_tax_incl><![CDATA[${incl}]]></unit_price_tax_incl>\n<unit_price_tax_excl><![CDATA[${excl}]]></unit_price_tax_excl>\n</order_row>`
    }).join('\n')

    const associations = []
    if (fields.includes('associations')) {
        // include order_rows if schema expects it
        associations.push('<associations>')
        associations.push('<order_rows>')
        associations.push(orderRowsXml)
        associations.push('</order_rows>')
        associations.push('</associations>')
    } else {
        // still include for compatibility
        associations.push('<associations>')
        associations.push('<order_rows>')
        associations.push(orderRowsXml)
        associations.push('</order_rows>')
        associations.push('</associations>')
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<order>\n${body.join('\n')}\n${associations.join('\n')}\n</order>\n</prestashop>`
    return xml
}

function buildProductOptionGroupXml(name, languageIds = [1]) {
    const normalizedName = String(name ?? '').trim()
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<product_option>\n<is_color_group><![CDATA[0]]></is_color_group>\n<group_type><![CDATA[select]]></group_type>\n<position><![CDATA[0]]></position>\n${buildMultiLangXml('name', normalizedName, languageIds)}\n${buildMultiLangXml('public_name', normalizedName, languageIds)}\n</product_option>\n</prestashop>`
}

function buildOrderHistoryXml({ idOrder, idOrderState, idEmployee = 0, dateAdd }) {
    const cleanedDateAdd = String(dateAdd ?? '').trim() || new Date().toISOString().slice(0, 19).replace('T', ' ')
    
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<order_history>\n<id_order><![CDATA[${idOrder}]]></id_order>\n<id_order_state><![CDATA[${idOrderState}]]></id_order_state>\n<id_employee><![CDATA[${idEmployee}]]></id_employee>\n<date_add><![CDATA[${cleanedDateAdd}]]></date_add>\n</order_history>\n</prestashop>`
}

function buildCombinationXml({ productId, reference, price, optionValueId, defaultOn = '' }) {
    const cleanedProductId = String(productId ?? '').trim()
    const cleanedReference = String(reference ?? '').trim()
    const cleanedPrice = String(price ?? '0').trim()
    const cleanedOptionValueId = String(optionValueId ?? '').trim()
    const cleanedDefaultOn = String(defaultOn ?? '').trim()

    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<combination>\n<id_product><![CDATA[${cleanedProductId}]]></id_product>\n<minimal_quantity><![CDATA[1]]></minimal_quantity>\n<reference><![CDATA[${cleanedReference}]]></reference>\n<price><![CDATA[${cleanedPrice}]]></price>\n${cleanedDefaultOn ? `<default_on><![CDATA[${cleanedDefaultOn}]]></default_on>\n` : ''}<associations>\n<product_option_values>\n<product_option_value>\n<id><![CDATA[${cleanedOptionValueId}]]></id>\n</product_option_value>\n</product_option_values>\n</associations>\n</combination>\n</prestashop>`
}

function buildProductUpdateXml({ id, reference, price }) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<product>\n<id><![CDATA[${id}]]></id>\n<reference><![CDATA[${reference ?? ''}]]></reference>\n<price><![CDATA[${price ?? '0'}]]></price>\n</product>\n</prestashop>`
}

async function getProductReferenceLookup() {
    const xmlDoc = await fetchXmlDocument('products?display=[id,reference,price,id_tax_rules_group]')
    const lookup = {}

    Array.from(xmlDoc.getElementsByTagName('product')).forEach((productNode) => {
        const idNode = productNode.getElementsByTagName('id')[0]
        const referenceNode = productNode.getElementsByTagName('reference')[0]
        const priceNode = productNode.getElementsByTagName('price')[0]
        const taxRulesGroupNode = productNode.getElementsByTagName('id_tax_rules_group')[0]

        const id = String(idNode?.textContent ?? '').trim()
        const reference = normalizeLookupKey(referenceNode?.textContent ?? '')
        const price = String(priceNode?.textContent ?? '').trim()
        const taxRulesGroupId = String(taxRulesGroupNode?.textContent ?? '').trim()

        if (id && reference && !lookup[reference]) {
            lookup[reference] = {
                id,
                reference: String(referenceNode?.textContent ?? '').trim(),
                price,
                taxRulesGroupId,
            }
        }
    })

    return lookup
}

async function getProductByReference(reference) {
    const cleanedReference = String(reference ?? '').trim()

    if (!cleanedReference) {
        return null
    }

    const xmlDoc = await fetchXmlDocument(`products?display=[id,reference,name,price,id_tax_rules_group]&filter[reference]=[${encodeURIComponent(cleanedReference)}]`)
    const productNode = xmlDoc.getElementsByTagName('product')[0]

    if (!productNode) {
        return null
    }

    const idNode = productNode.getElementsByTagName('id')[0]
    const referenceNode = productNode.getElementsByTagName('reference')[0]
    const nameNode = productNode.getElementsByTagName('name')[0]
    const priceNode = productNode.getElementsByTagName('price')[0]
    const taxRulesGroupNode = productNode.getElementsByTagName('id_tax_rules_group')[0]

    const id = String(idNode?.textContent ?? '').trim()
    const lookupReference = normalizeLookupKey(referenceNode?.textContent ?? '')

    if (!id || !lookupReference) {
        return null
    }

    return {
        id,
        reference: String(referenceNode?.textContent ?? '').trim(),
        name: String(nameNode?.textContent ?? '').trim(),
        price: String(priceNode?.textContent ?? '').trim(),
        taxRulesGroupId: String(taxRulesGroupNode?.textContent ?? '').trim(),
    }
}

async function getProductOptionGroupLookup() {
    const xmlDoc = await fetchXmlDocument('product_options')
    const lookup = {}

    Array.from(xmlDoc.getElementsByTagName('product_option')).forEach((groupNode) => {
        const idNode = groupNode.getElementsByTagName('id')[0]
        const nameNode = groupNode.getElementsByTagName('name')[0]
        const id = String(idNode?.textContent ?? '').trim()
        if (!id || !nameNode) {
            return
        }

        Array.from(nameNode.getElementsByTagName('language')).forEach((languageNode) => {
            const name = normalizeLookupKey(languageNode.textContent ?? '')
            if (name && !lookup[name]) {
                lookup[name] = id
            }
        })
    })

    return lookup
}

async function getProductOptionValueLookup() {
    const xmlDoc = await fetchXmlDocument('product_option_values')
    const lookup = {}

    Array.from(xmlDoc.getElementsByTagName('product_option_value')).forEach((valueNode) => {
        const idNode = valueNode.getElementsByTagName('id')[0]
        const groupNode = valueNode.getElementsByTagName('id_attribute_group')[0]
        const nameNode = valueNode.getElementsByTagName('name')[0]
        const id = String(idNode?.textContent ?? '').trim()
        const groupId = String(groupNode?.textContent ?? '').trim()
        if (!id || !groupId || !nameNode) {
            return
        }

        Array.from(nameNode.getElementsByTagName('language')).forEach((languageNode) => {
            const name = normalizeLookupKey(languageNode.textContent ?? '')
            if (name) {
                const key = `${groupId}:${name}`
                if (!lookup[key]) {
                    lookup[key] = id
                }
            }
        })
    })

    return lookup
}

async function getProductOptionValueLabelsById() {
    const xmlDoc = await fetchXmlDocument('product_option_values?display=[id,name,id_attribute_group]')
    const lookup = {}

    Array.from(xmlDoc.getElementsByTagName('product_option_value')).forEach((valueNode) => {
        const idNode = valueNode.getElementsByTagName('id')[0]
        const nameNode = valueNode.getElementsByTagName('name')[0]
        const id = String(idNode?.textContent ?? '').trim()

        if (!id || !nameNode) {
            return
        }

        const labels = Array.from(nameNode.getElementsByTagName('language'))
            .map((languageNode) => String(languageNode.textContent ?? '').trim())
            .filter(Boolean)

        if (labels.length > 0 && !lookup[id]) {
            lookup[id] = labels
        }
    })

    return lookup
}

async function getCustomerByEmail(email) {
    const cleanedEmail = String(email ?? '').trim()

    if (!cleanedEmail) {
        return null
    }

    const xmlDoc = await fetchXmlDocument(`customers?display=[id,email,firstname,lastname,secure_key]&filter[email]=[${encodeURIComponent(cleanedEmail)}]`)
    const customerNode = xmlDoc.getElementsByTagName('customer')[0]

    if (!customerNode) {
        return null
    }

    return {
        id: String(customerNode.getElementsByTagName('id')[0]?.textContent ?? '').trim(),
        email: String(customerNode.getElementsByTagName('email')[0]?.textContent ?? '').trim(),
        firstname: String(customerNode.getElementsByTagName('firstname')[0]?.textContent ?? '').trim(),
        lastname: String(customerNode.getElementsByTagName('lastname')[0]?.textContent ?? '').trim(),
        secureKey: String(customerNode.getElementsByTagName('secure_key')[0]?.textContent ?? '').trim(),
    }
}

async function getAddressByCustomerIdAndAddress(customerId, address1) {
    const cleanedCustomerId = String(customerId ?? '').trim()
    const cleanedAddress1 = String(address1 ?? '').trim()

    if (!cleanedCustomerId || !cleanedAddress1) {
        return null
    }

    const xmlDoc = await fetchXmlDocument(`addresses?display=[id,id_customer,address1,city]&filter[id_customer]=[${encodeURIComponent(cleanedCustomerId)}]`)
    const addressNodes = Array.from(xmlDoc.getElementsByTagName('address'))

    for (const addressNode of addressNodes) {
        const nodeAddress1 = String(addressNode.getElementsByTagName('address1')[0]?.textContent ?? '').trim()

        if (normalizeLookupKey(nodeAddress1) === normalizeLookupKey(cleanedAddress1)) {
            return {
                id: String(addressNode.getElementsByTagName('id')[0]?.textContent ?? '').trim(),
                address1: nodeAddress1,
                city: String(addressNode.getElementsByTagName('city')[0]?.textContent ?? '').trim(),
            }
        }
    }

    return null
}

async function getDefaultCurrencyId() {
    try {
        const xmlDoc = await fetchXmlDocument('currencies?display=[id,active]')
        const currencyNode = xmlDoc.getElementsByTagName('currency')[0]
        return String(currencyNode?.getElementsByTagName('id')[0]?.textContent ?? '').trim() || DEFAULT_ID_CURRENCY
    } catch {
        return DEFAULT_ID_CURRENCY
    }
}

async function getDefaultCarrierId() {
    try {
        const xmlDoc = await fetchXmlDocument('carriers?display=[id,active]')
        const carrierNodes = Array.from(xmlDoc.getElementsByTagName('carrier'))
        const activeCarrier = carrierNodes.find((carrierNode) => String(carrierNode.getElementsByTagName('active')[0]?.textContent ?? '').trim() === '1')
        return String((activeCarrier || carrierNodes[0])?.getElementsByTagName('id')[0]?.textContent ?? '').trim() || '1'
    } catch {
        return '1'
    }
}

async function getOrderStateIdByName(stateName) {
    const cleanedStateName = String(stateName ?? '').trim()

    if (!cleanedStateName) {
        return ''
    }

    const normalizedStateName = normalizeLookupKey(cleanedStateName)
    const orderStateAliases = {
        paiementaccepte: ['paymentaccepted', 'paiementaccepte', 'paid'],
        paiementenattente: ['waitingforpayment', 'enattentedevirement', 'awaitingpayment', 'pendingpayment'],
        erreurdepaiement: ['paymenterror', 'paymentfailed', 'paiementerreur', 'paymentfailederror'],
        preparationencours: ['preparationinprogress', 'preparationencours', 'processing'],
        shipped: ['expedie', 'livre', 'shipped'],
        delivered: ['delivered', 'livre'],
        canceled: ['canceled', 'cancelled', 'annule'],
        annule: ['canceled', 'cancelled', 'annulled'],
    }

    const aliasMatches = (orderStateAliases[normalizedStateName] || []).map((alias) => normalizeLookupKey(alias))

    try {
        const xmlDoc = await fetchXmlDocument('order_states?display=[id,name]')
        const stateNodes = Array.from(xmlDoc.getElementsByTagName('order_state'))

        for (const stateNode of stateNodes) {
            const id = String(stateNode.getElementsByTagName('id')[0]?.textContent ?? '').trim()
            const nameNode = stateNode.getElementsByTagName('name')[0]
            if (!id || !nameNode) {
                continue
            }

            const candidateNames = Array.from(nameNode.getElementsByTagName('language'))
                .map((languageNode) => String(languageNode.textContent ?? '').trim())
                .filter(Boolean)

            const normalizedCandidates = candidateNames.map((candidateName) => normalizeLookupKey(candidateName))

            if (
                normalizedCandidates.includes(normalizedStateName)
                || normalizedCandidates.some((candidateName) => candidateName.includes(normalizedStateName) || normalizedStateName.includes(candidateName))
                || normalizedCandidates.some((candidateName) => aliasMatches.includes(candidateName))
                || aliasMatches.some((alias) => normalizedCandidates.includes(alias))
            ) {
                return id
            }
        }

        return String(stateNodes[0]?.getElementsByTagName('id')[0]?.textContent ?? '').trim()
    } catch {
        return '1'
    }
}

async function getStockAvailableEntry(productId, productAttributeId) {
    const cleanedProductId = String(productId ?? '').trim()
    const cleanedProductAttributeId = String(productAttributeId ?? '0').trim() || '0'

    if (!cleanedProductId) {
        return null
    }

    try {
        // Fetch ALL stock_availables (API filter doesn't work reliably)
        const xmlDoc = await fetchXmlDocument(`stock_availables?display=[id,id_product,id_product_attribute,quantity,id_shop,id_shop_group,out_of_stock,depends_on_stock]`)
        const allStockNodes = Array.from(xmlDoc.getElementsByTagName('stock_available'))

        // Filter client-side for the matching product/attribute
        for (const stockNode of allStockNodes) {
            const nodeProductId = String(stockNode.getElementsByTagName('id_product')[0]?.textContent ?? '').trim()
            const nodeAttrId = String(stockNode.getElementsByTagName('id_product_attribute')[0]?.textContent ?? '0').trim() || '0'

            if (nodeProductId === cleanedProductId && nodeAttrId === cleanedProductAttributeId) {
                return {
                    id: String(stockNode.getElementsByTagName('id')[0]?.textContent ?? '').trim(),
                    quantity: String(stockNode.getElementsByTagName('quantity')[0]?.textContent ?? '0').trim(),
                    idShop: String(stockNode.getElementsByTagName('id_shop')[0]?.textContent ?? DEFAULT_ID_SHOP).trim(),
                    idShopGroup: String(stockNode.getElementsByTagName('id_shop_group')[0]?.textContent ?? DEFAULT_ID_SHOP_GROUP).trim(),
                    outOfStock: String(stockNode.getElementsByTagName('out_of_stock')[0]?.textContent ?? DEFAULT_OUT_OF_STOCK).trim(),
                    dependsOnStock: String(stockNode.getElementsByTagName('depends_on_stock')[0]?.textContent ?? DEFAULT_DEPENDS_ON_STOCK).trim(),
                }
            }
        }

        return null
    } catch (err) {
        console.error(`[STOCK] Error fetching stock_available for product ${cleanedProductId} attr ${cleanedProductAttributeId}:`, err)
        return null
    }
}

export async function upsertStockAvailable({ productId, productAttributeId = '0', quantity, idShop, idShopGroup, outOfStock, dependsOnStock }) {
    const cleanedProductId = String(productId ?? '').trim()
    const cleanedProductAttributeId = String(productAttributeId ?? '0').trim() || '0'
    const cleanedQuantity = String(quantity ?? '0').trim()
    const cleanedOutOfStock = String(outOfStock ?? DEFAULT_OUT_OF_STOCK).trim()
    const cleanedDependsOnStock = String(dependsOnStock ?? DEFAULT_DEPENDS_ON_STOCK).trim()

    if (!cleanedProductId) {
        throw new Error('Product ID is required for stock update')
    }

    try {
        let stock = await getStockAvailableEntry(cleanedProductId, cleanedProductAttributeId)

        // If stock entry not found, wait and retry (PrestaShop creates it automatically after product/combination creation)
        if (!stock?.id) {
            await new Promise((resolve) => setTimeout(resolve, 800))
            stock = await getStockAvailableEntry(cleanedProductId, cleanedProductAttributeId)
        }

        if (!stock?.id) {
            // Stock entry still doesn't exist - log and skip
            console.warn(`[STOCK] Warning: stock_available entry not found for product ${cleanedProductId} attr ${cleanedProductAttributeId}. Will not be updated.`)
            return undefined
        }

        // Use existing shop/shop_group values from DB to preserve them
        const finalIdShop = String(idShop ?? stock.idShop ?? DEFAULT_ID_SHOP).trim()
        const finalIdShopGroup = String(idShopGroup ?? stock.idShopGroup ?? DEFAULT_ID_SHOP_GROUP).trim()

        // UPDATE existing - use buildStockAvailableXml to ensure all required fields
        const xml = buildStockAvailableXml({
            id: stock.id,
            productId: cleanedProductId,
            productAttributeId: cleanedProductAttributeId,
            quantity: cleanedQuantity,
            idShop: finalIdShop,
            idShopGroup: finalIdShopGroup,
            outOfStock: cleanedOutOfStock,
            dependsOnStock: cleanedDependsOnStock,
        })
        console.log(`[STOCK] Updating id_stock_available=${stock.id} to quantity=${cleanedQuantity}`)
        return await updateResourceData('stock_availables', stock.id, xml)
    } catch (err) {
        throw new Error(`Stock upsert failed for product ${cleanedProductId}: ${err instanceof Error ? err.message : String(err)}`)
    }
}

export async function ensureSimpleProductStock(reference, quantity) {
    const cleanedReference = String(reference ?? '').trim()
    if (!cleanedReference) {
        throw new Error('Product reference is required for stock update')
    }

    const product = await getProductByReference(cleanedReference)
    if (!product?.id) {
        throw new Error(`Product not found: ${cleanedReference}`)
    }

    return upsertStockAvailable({
        productId: product.id,
        productAttributeId: '0',
        quantity,
    })
}

async function getCombinationDetailsByProductId(productId) {
    const cleanedProductId = String(productId ?? '').trim()

    if (!cleanedProductId) {
        return []
    }

    const xmlDoc = await fetchXmlDocument(`combinations?display=[id,id_product,reference,price]&filter[id_product]=[${encodeURIComponent(cleanedProductId)}]`)
    const combinationNodes = Array.from(xmlDoc.getElementsByTagName('combination'))
    const entries = []

    for (const combinationNode of combinationNodes) {
        const combinationId = String(combinationNode.getElementsByTagName('id')[0]?.textContent ?? '').trim()
        if (!combinationId) {
            continue
        }

        try {
            const detailDoc = await fetchXmlDocument(`combinations/${combinationId}`)
            const detailNode = detailDoc.getElementsByTagName('combination')[0]
            if (!detailNode) {
                continue
            }

            const optionValueIds = Array.from(detailNode.getElementsByTagName('product_option_value'))
                .map((optionValueNode) => String(optionValueNode.getElementsByTagName('id')[0]?.textContent ?? '').trim())
                .filter(Boolean)

            const defaultOn = String(detailNode.getElementsByTagName('default_on')[0]?.textContent ?? '').trim() === '1'
            const reference = String(detailNode.getElementsByTagName('reference')[0]?.textContent ?? '').trim()
            const price = String(detailNode.getElementsByTagName('price')[0]?.textContent ?? '').trim()

            // attempt to fetch stock for this combination (may be null)
            let stockQty = 0
            try {
                const stockEntry = await getStockAvailableEntry(productId, combinationId)
                stockQty = parseIntegerValue(stockEntry?.quantity ?? '0') || 0
            } catch {
                stockQty = 0
            }

            entries.push({
                id: combinationId,
                reference,
                price,
                optionValueIds,
                defaultOn,
                stock: stockQty,
            })
        } catch {
            continue
        }
    }

    return entries
}

async function resolveCombinationIdByProductAndVariant(productId, variantName) {
    const cleanedVariantName = String(variantName ?? '').trim()

    if (!cleanedVariantName) {
        return '0'
    }

    const normalizedInput = normalizeLookupKey(cleanedVariantName)

    // Tokenize input: allow separators like / , + | - ;
    const tokens = cleanedVariantName
        .split(/[\/,+|;\-]+/)
        .map((t) => normalizeLookupKey(t))
        .filter(Boolean)

    const combinations = await getCombinationDetailsByProductId(productId)

    // Helper: choose best among candidates (prefer defaultOn, then stock>0)
    const chooseBest = (candidates) => {
        if (!Array.isArray(candidates) || candidates.length === 0) return null
        const byDefault = candidates.filter((c) => c.defaultOn)
        if (byDefault.length === 1) return byDefault[0]
        if (byDefault.length > 1) candidates = byDefault

        const withStock = candidates.filter((c) => (Number(c.stock) || 0) > 0)
        if (withStock.length === 1) return withStock[0]
        if (withStock.length > 1) return withStock[0]

        return candidates[0]
    }

    // 1) Try exact match on combination reference
    const refMatch = combinations.find((c) => {
        const cref = normalizeLookupKey(c.reference)
        return cref && (cref === normalizedInput || cref.includes(normalizedInput) || normalizedInput.includes(cref))
    })
    if (refMatch?.id) return String(refMatch.id).trim()

    // 2) If tokens look like attribute IDs (all numeric), try matching by optionValueIds
    const allNumeric = tokens.length > 0 && tokens.every((t) => /^\d+$/.test(t))
    if (allNumeric) {
        const idTokens = tokens.map((t) => String(Number(t)))
        const matchByIds = combinations.filter((c) => idTokens.every((tok) => c.optionValueIds.includes(tok)))
        const chosen = chooseBest(matchByIds)
        if (chosen?.id) return String(chosen.id).trim()
    }

    // 3) Try matching on attribute value labels (ps_attribute_lang.name)
    const labelsById = await getProductOptionValueLabelsById()
    const labelMatches = combinations.filter((combination) => {
        if (!Array.isArray(combination.optionValueIds) || combination.optionValueIds.length === 0) return false

        const combinationLabels = combination.optionValueIds
            .flatMap((optionValueId) => labelsById[String(optionValueId).trim()] || [])
            .map((label) => normalizeLookupKey(label))

        // If multiple tokens provided, require all tokens to be matched
        if (tokens.length > 1) {
            return tokens.every((t) => combinationLabels.some((cl) => cl === t || cl.includes(t) || t.includes(cl)))
        }

        // Single token: any label matches
        return combinationLabels.some((cl) => cl === normalizedInput || cl.includes(normalizedInput) || normalizedInput.includes(cl))
    })

    const chosenLabel = chooseBest(labelMatches)
    if (chosenLabel?.id) return String(chosenLabel.id).trim()

    // 4) If only one combination exists for the product, return it as fallback
    if (combinations.length === 1 && combinations[0]?.id) {
        return String(combinations[0].id).trim()
    }

    // Log diagnostics for debugging
    try {
        console.warn(`[ORDERS] Combination resolution failed for product ${productId} / input: "${cleanedVariantName}"`)
        const summary = combinations.map((c) => ({ id: c.id, reference: c.reference, optionValueIds: c.optionValueIds, defaultOn: !!c.defaultOn, stock: c.stock }))
        console.warn('[ORDERS] Available combinations:', JSON.stringify(summary, null, 2))
    } catch {
        // ignore
    }

    return ''
}

async function ensureProductOptionValueIdByName(groupId, value, lookup = {}, cache = {}, languageIds = [1]) {
    const cleanedGroupId = String(groupId ?? '').trim()
    const cleanedValue = String(value ?? '').trim()

    if (!cleanedGroupId || !cleanedValue) {
        return ''
    }

    const cacheKey = `${cleanedGroupId}:${normalizeLookupKey(cleanedValue)}`
    const cachedId = cache[cacheKey] || lookup[cacheKey] || ''

    if (cachedId) {
        cache[cacheKey] = cachedId
        lookup[cacheKey] = cachedId
        return cachedId
    }

    const createdResponse = await insertResourceData('product_option_values', buildProductOptionValueXml(cleanedGroupId, cleanedValue, languageIds))
    const createdId = extractCreatedId(createdResponse)

    if (createdId) {
        cache[cacheKey] = createdId
        lookup[cacheKey] = createdId
        return createdId
    }

    const refreshedLookup = await getProductOptionValueLookup()
    const refreshedId = refreshedLookup[cacheKey] || ''
    if (refreshedId) {
        cache[cacheKey] = refreshedId
        lookup[cacheKey] = refreshedId
    }

    return refreshedId
}

export async function importCustomerOrders(rows, languageIds = [1]) {
    if (!Array.isArray(rows) || rows.length === 0) {
        console.log('[ORDERS] Invalid or empty rows')
        return { success: 0, errors: [], skippedRows: [] }
    }

    console.log(`[ORDERS] Starting import of ${rows.length} rows`)

    const results = { success: 0, errors: [], skippedRows: [] }

    // Charger les données communes une seule fois
    const taxRulesGroupRateLookup = await getTaxRulesGroupRateLookup()
    const defaultCurrencyId = await getDefaultCurrencyId()
    const defaultCarrierId = await getDefaultCarrierId()
    const defaultCountryId = String(ID_COUNTRY ?? '').trim() || '0'
    const defaultLangId = String(languageIds?.[0] ?? DEFAULT_ID_LANG).trim() || DEFAULT_ID_LANG

    const customerCache = {}
    const addressCache = {}
    const combinationCache = {}

    // Traiter chaque ligne
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        console.log(`\n[ORDERS] === Row ${rowIndex + 1}/${rows.length} ===`)

        try {
            // Normaliser les clés de la ligne
            const rowLookup = Object.entries(row || {}).reduce((acc, [key, value]) => {
                acc[normalizeLookupKey(key)] = value
                return acc
            }, {})

            // Extraire les champs
            const orderDate = normalizeDateString(rowLookup.date ?? rowLookup.date_add)
            const lastname = String(rowLookup.nom ?? rowLookup.lastname ?? '').trim()
            const firstname = String(rowLookup.prenom ?? rowLookup.firstname ?? lastname).trim()
            const email = String(rowLookup.email ?? '').trim()
            const passwd = String(rowLookup.pwd ?? rowLookup.passwd ?? '').trim()
            const address1 = String(rowLookup.adresse ?? rowLookup.address ?? rowLookup.address1 ?? '').trim()
            const city = String(rowLookup.ville ?? rowLookup.city ?? address1 ?? 'Ville').trim()
            const postcode = String(rowLookup.codepostal ?? rowLookup.postcode ?? '00000').trim()
            const stateName = String(rowLookup.etat ?? rowLookup.status ?? rowLookup.current_state ?? '').trim()
            const purchases = parsePurchaseList(rowLookup.achat ?? rowLookup.orders ?? rowLookup.order)

            // Validations rapides
            if (!email || !stateName || purchases.length === 0) {
                const reason = !email ? 'Email manquant' : !stateName ? 'État manquant' : 'Aucun produit'
                console.warn(`[ORDERS] Skipped: ${reason}`)
                results.skippedRows.push({ row, reason })
                continue
            }

            console.log(`[ORDERS] Email: ${email}, ${purchases.length} item(s), state: ${stateName}`)

            // === 1. ÉTAPE 1 : Créer ou retrouver le client ===
            // === 1. ÉTAPE 1 : Créer ou retrouver le client ===
            let customerId, customerSecureKey
            {
                let customer = customerCache[email] || (await getCustomerByEmail(email))
                if (customer?.id) {
                    customerId = String(customer.id).trim()
                    // ✔ utiliser le secure_key réel de PrestaShop
                    customerSecureKey = String(customer.secureKey ?? '').trim()
                    if (!customerSecureKey) {
                        throw new Error(`Secure key manquant pour customer ${customerId}`)
                    }
                    customerCache[email] = {
                        id: customerId,
                        secureKey: customerSecureKey
                    }
                    console.log(`[ORDERS] 1. Customer found: ${customerId}`)
                } else {
                    // ❌ NE PAS générer secureKey manuellement
                    const xml = buildCustomerXml({
                        lastname: lastname || firstname || email,
                        firstname: firstname || lastname || email,
                        email,
                        passwd,
                        dateAdd: orderDate,
                        idLang: defaultLangId,
                    })
                    const resp = await insertResourceData('customers', xml)
                    customerId = extractCreatedId(resp)
                    if (!customerId) throw new Error('Failed to create customer')
                    // récupérer le customer créé avec son secure_key réel
                    const createdCustomer = await getCustomerByEmail(email)
                    customerSecureKey = String(createdCustomer?.secureKey ?? '').trim()
                    if (!customerSecureKey) {
                        throw new Error(`Impossible de récupérer secure_key pour customer ${customerId}`)
                    }
                    customerCache[email] = {
                        id: customerId,
                        secureKey: customerSecureKey
                    }
                    console.log(`[ORDERS] 1. Customer created: ${customerId}`)
                }
            }

            // === 2. ÉTAPE 2 : Créer ou retrouver l'adresse ===
            let addressId
            {
                const addressKey = `${customerId}:${address1}`
                let address = addressCache[addressKey] || (await getAddressByCustomerIdAndAddress(customerId, address1))

                if (address?.id) {
                    addressId = String(address.id).trim()
                    console.log(`[ORDERS] 2. Address found: ${addressId}`)
                } else {
                    const xml = buildAddressXml({
                        idCustomer: customerId,
                        lastname: lastname || firstname || email,
                        firstname: firstname || lastname || email,
                        address1: address1 || 'Adresse',
                        city: city || 'Ville',
                        postcode: postcode || '00000',
                        idCountry: defaultCountryId,
                        dateAdd: orderDate,
                    })
                    const resp = await insertResourceData('addresses', xml)
                    addressId = extractCreatedId(resp)
                    if (!addressId) throw new Error('Failed to create address')
                    addressCache[addressKey] = { id: addressId }
                    console.log(`[ORDERS] 2. Address created: ${addressId}`)
                }
            }

            // === 3. ÉTAPE 3 : Résoudre l'état de commande ===
            const currentStateId = await getOrderStateIdByName(stateName)
            if (!currentStateId) throw new Error(`Order state not found: ${stateName}`)
            console.log(`[ORDERS] 3. Order state: ${currentStateId}`)

            // === 4. ÉTAPE 4 : Traiter les produits ===
            const cartRows = []
            const orderRows = []
            let totalProducts = 0, totalProductsWt = 0

            for (const item of purchases) {
                const productEntry = await getProductByReference(item.reference)
                if (!productEntry?.id) throw new Error(`Product not found: ${item.reference}`)

                const productId = String(productEntry.id).trim()
                const productName = String(productEntry.name || productEntry.reference || item.reference).trim()
                const basePrice = parseDecimalValue(productEntry.price) ?? 0
                const productTaxRate = parseDecimalValue(taxRulesGroupRateLookup[productEntry.taxRulesGroupId]) ?? 0
                // No per-item TTC price available for orders import; use base price as HT target
                const targetHt = basePrice

                let productAttributeId = '0', combinationPriceImpact = 0, lineLabel = productName

                // Gérer les variantes
                if (item.variant) {
                    const cacheKey = `${productId}:${normalizeLookupKey(item.variant)}`
                    let combinationEntry = combinationCache[cacheKey]

                    if (!combinationEntry) {
                        const combinationId = await resolveCombinationIdByProductAndVariant(productId, item.variant)
                        if (!combinationId) throw new Error(`Combination not found: ${item.reference}/${item.variant}`)

                        const details = await getCombinationDetailsByProductId(productId)
                        combinationEntry = details.find(e => String(e.id).trim() === combinationId)
                        combinationCache[cacheKey] = combinationEntry
                    }

                    productAttributeId = String(combinationEntry?.id ?? '0').trim() || '0'
                    combinationPriceImpact = parseDecimalValue(combinationEntry?.price) ?? 0
                    lineLabel = `${productName} - ${item.variant}`
                }

                const unitPriceExcl = basePrice + combinationPriceImpact
                const unitPriceIncl = unitPriceExcl * (1 + productTaxRate / 100)
                const lineTotalExcl = unitPriceExcl * item.quantity
                const lineTotalIncl = unitPriceIncl * item.quantity

                totalProducts += lineTotalExcl
                totalProductsWt += lineTotalIncl

                cartRows.push({ productId, productAttributeId, quantity: item.quantity })
                orderRows.push({
                    productId,
                    productAttributeId,
                    quantity: item.quantity,
                    productName: lineLabel,
                    productReference: item.reference,
                    productPrice: String(unitPriceExcl),
                    unitPriceTaxIncl: String(unitPriceIncl),
                    unitPriceTaxExcl: String(unitPriceExcl),
                    totalPriceTaxExcl: String(lineTotalExcl),
                    totalPriceTaxIncl: String(lineTotalIncl),
                })
            }

            if (cartRows.length === 0) throw new Error('No items to order')
            console.log(`[ORDERS] 4. Items processed: ${cartRows.length}, total: ${totalProductsWt.toFixed(2)}`)

            // === 5. ÉTAPE 5 : Créer le panier ===
            const secureKey = customerSecureKey
            const cartXml = buildCartXml({
                idCustomer: customerId,
                idAddressDelivery: addressId,
                idAddressInvoice: addressId,
                idCurrency: defaultCurrencyId,
                idLang: defaultLangId,
                idCarrier: defaultCarrierId,
                secureKey,
                rows: cartRows,
            })
            const cartResp = await insertResourceData('carts', cartXml)
            const cartId = extractCreatedId(cartResp)
            if (!cartId) {
                throw new Error('Failed to create cart')
            }
            console.log(`[ORDERS] 5. Cart created: ${cartId}`)

            // === 6. ÉTAPE 6 : Créer la commande ===
            const orderXml = await buildOrderXmlFromSchema(
                {
                    idCustomer: customerId,
                    idAddressDelivery: addressId,
                    idAddressInvoice: addressId,
                    idCart: cartId,
                    idCurrency: defaultCurrencyId,
                    idLang: defaultLangId,
                    idCarrier: defaultCarrierId,
                    idShop: DEFAULT_ID_SHOP || '1',
                    idShopGroup: DEFAULT_ID_SHOP_GROUP || '1',
                    currentState: currentStateId,
                    payment: stateName || DEFAULT_ORDER_PAYMENT,
                    secureKey: secureKey,
                },
                orderRows,
                {
                    totalPaid: String(totalProductsWt),
                    totalPaidTaxIncl: String(totalProductsWt),
                    totalPaidTaxExcl: String(totalProducts),
                    totalProducts: String(totalProducts),
                    totalProductsWt: String(totalProductsWt),
                }
            )
            const orderResp = await insertResourceData('orders', orderXml)
            const orderId = extractCreatedId(orderResp)
            if (!orderId) {
                throw new Error('Failed to create order')
            }
            console.log(`[ORDERS] 6. Order created: ${orderId}`)
            
            // === 7. ÉTAPE 7 : Créer l'historique de statut ===
            try {
                const histXml = buildOrderHistoryXml({
                    idOrder: orderId,
                    idOrderState: currentStateId,
                    dateAdd: orderDate,
                })
                await insertResourceData('order_histories', histXml)
                console.log(`[ORDERS] 7. Order history created`)
            } catch (e) {
                console.warn(`[ORDERS] 7. Order history skipped:`, e.message)
            }

            // === 8. ÉTAPE 8 : Décrémenter le stock ===
            for (const orderRow of orderRows) {
                try {
                    const stock = await getStockAvailableEntry(orderRow.productId, orderRow.productAttributeId)
                    if (stock?.id) {
                        const newQty = Math.max(0, (parseIntegerValue(stock.quantity) || 0) - orderRow.quantity)
                        await upsertStockAvailable({
                            productId: orderRow.productId,
                            productAttributeId: orderRow.productAttributeId,
                            quantity: newQty,
                            idShop: stock.idShop,
                            idShopGroup: stock.idShopGroup,
                            outOfStock: stock.outOfStock,
                            dependsOnStock: stock.dependsOnStock,
                        })
                    }
                } catch (e) {
                    console.warn(`[ORDERS] 8. Stock decrement skipped for product ${orderRow.productId}:`, e.message)
                }
            }

            results.success++
            console.log(`[ORDERS] ✅ Row ${rowIndex + 1} SUCCESS - Order ${orderId}`)

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[ORDERS] ❌ Row ${rowIndex + 1} ERROR: ${msg}`)
            results.errors.push({ row, reason: msg })
        }
    }

    console.log(`\n[ORDERS] ===== FINAL SUMMARY =====`)
    console.log(`[ORDERS] Success: ${results.success}`)
    console.log(`[ORDERS] Errors: ${results.errors.length}`)
    console.log(`[ORDERS] Skipped: ${results.skippedRows.length}`)

    return results
}

export async function prepareVariantImportOperations(rows, languageIds = [1]) {
    if (!Array.isArray(rows)) {
        return { operations: [], skippedRows: [] }
    }

    const productReferenceLookup = await getProductReferenceLookup()
    const productOptionGroupLookup = await getProductOptionGroupLookup()
    const productOptionValueLookup = await getProductOptionValueLookup()
    const taxRulesGroupRateLookup = await getTaxRulesGroupRateLookup()

    const productOptionGroupCache = {}
    const productOptionValueCache = {}
    const defaultCombinationAssigned = {}
    const operations = []
    const skippedRows = []

    for (const row of rows) {
        const rowLookup = Object.entries(row).reduce((accumulator, [key, value]) => {
            accumulator[normalizeLookupKey(key)] = value
            return accumulator
        }, {})

        const reference = String(rowLookup.reference ?? '').trim()
        const specificite = String(rowLookup.specificite ?? rowLookup.specificités ?? rowLookup.specifite ?? '').trim()
        const karazany = String(rowLookup.karazany ?? rowLookup.value ?? '').trim()
        const priceTtc = parseDecimalValue(rowLookup.prixventettc ?? rowLookup.prix_vente_ttc ?? rowLookup.price ?? rowLookup.prix_ttc)
        const stockInitial = parseIntegerValue(rowLookup.stockinitial ?? rowLookup.stock_initial ?? rowLookup.quantity ?? rowLookup.stock)
        const productEntry = await getProductByReference(reference) || productReferenceLookup[normalizeLookupKey(reference)]

        if (!reference || !productEntry) {
            skippedRows.push({ row, reason: 'Produit introuvable par référence' })
            continue
        }

        const productId = String(productEntry.id ?? productEntry.id_product ?? '').trim()
        if (!productId) {
            skippedRows.push({ row, reason: 'ID produit introuvable pour cette référence' })
            continue
        }

        const basePrice = parseDecimalValue(productEntry.price) ?? 0
        const productTaxRate = parseDecimalValue(taxRulesGroupRateLookup[productEntry.taxRulesGroupId]) ?? 0
        const targetHt = priceTtc !== null ? (priceTtc / (1 + (productTaxRate / 100))) : basePrice

        if (!specificite && !karazany) {
            if (stockInitial === null) {
                skippedRows.push({ row, reason: 'Pas de variante et stock_initial absent' })
                continue
            }

            operations.push({
                resource: 'stock_availables',
                method: 'UPSERT',
                productId,
                productAttributeId: 0,
                quantity: stockInitial,
            })
            continue
        }

        const groupId = await ensureProductOptionGroupIdByName(specificite, productOptionGroupLookup, productOptionGroupCache, languageIds)
        if (!groupId) {
            skippedRows.push({ row, reason: 'Groupe de déclinaison introuvable' })
            continue
        }

        const valueId = await ensureProductOptionValueIdByName(groupId, karazany, productOptionValueLookup, productOptionValueCache, languageIds)
        if (!valueId) {
            skippedRows.push({ row, reason: 'Valeur de déclinaison introuvable' })
            continue
        }

        const priceImpact = String(Math.round(((targetHt - basePrice) + Number.EPSILON) * 1000000) / 1000000)
        const isDefaultForProduct = !defaultCombinationAssigned[productId]

        if (isDefaultForProduct) {
            defaultCombinationAssigned[productId] = true
        }

        operations.push({
            resource: 'combinations',
            method: 'POST',
            productId,
            stockQuantity: stockInitial,
            xml: buildCombinationXml({
                    productId,
                reference,
                price: priceImpact,
                optionValueId: valueId,
                defaultOn: isDefaultForProduct ? '1' : '',
            }),
        })
    }

    return {
        operations,
        skippedRows,
    }
}

async function ensureProductOptionGroupIdByName(name, lookup = {}, cache = {}, languageIds = [1]) {
    const cleanedName = String(name ?? '').trim()

    if (!cleanedName) {
        return ''
    }

    const normalizedName = normalizeLookupKey(cleanedName)

    // 1. Cherche dans le cache local
    if (cache[normalizedName]) return cache[normalizedName]

    // 2. Cherche dans le lookup préchargé
    if (lookup[normalizedName]) {
        cache[normalizedName] = lookup[normalizedName]
        return lookup[normalizedName]
    }

    // 3. Crée le groupe si inexistant
    try {
        const createdResponse = await insertResourceData('product_options', buildProductOptionGroupXml(cleanedName, languageIds))
        const createdId = extractCreatedId(createdResponse)

        if (createdId) {
            cache[normalizedName] = createdId
            lookup[normalizedName] = createdId
            return createdId
        }
    } catch { /* ignore, on tente un refresh */ }

    // 4. Refresh du lookup au cas où il aurait été créé entre temps
    try {
        const refreshedLookup = await getProductOptionGroupLookup()
        const refreshedId = refreshedLookup[normalizedName] || ''
        if (refreshedId) {
            cache[normalizedName] = refreshedId
            lookup[normalizedName] = refreshedId
        }
        return refreshedId
    } catch {
        return ''
    }
}

function buildProductOptionValueXml(groupId, value, languageIds = [1]) {
    const cleanedGroupId = String(groupId ?? '').trim()
    const cleanedValue = String(value ?? '').trim()
    const slug = slugify(cleanedValue)

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<product_option_value>
<id_attribute_group><![CDATA[${cleanedGroupId}]]></id_attribute_group>
<color><![CDATA[]]></color>
<position><![CDATA[0]]></position>
${buildMultiLangXml('name', cleanedValue, languageIds)}
</product_option_value>
</prestashop>`
}

export async function getCategoryNameLookup() {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res

    try {
        res = await fetch(`${BASE_URL}/categories?display=[id,name]`, {
            headers: {
                ...getAuthHeaders(),
            },
            signal: controller.signal,
        })
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw new Error('Erreur réseau API')
    } finally {
        window.clearTimeout(timeoutId)
    }

    if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

    const xmlText = await res.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        throw new Error('Erreur parsing XML')
    }

    const lookup = {}
    const categories = Array.from(xmlDoc.getElementsByTagName('category'))

    categories.forEach((categoryNode) => {
        const idNode = categoryNode.getElementsByTagName('id')[0]
        const nameNode = categoryNode.getElementsByTagName('name')[0]
        const id = String(idNode?.textContent ?? '').trim()

        if (!id || !nameNode) {
            return
        }

        Array.from(nameNode.getElementsByTagName('language')).forEach((languageNode) => {
            const categoryName = String(languageNode.textContent ?? '').trim()
            const normalizedName = normalizeLookupKey(categoryName)

            if (normalizedName && !lookup[normalizedName]) {
                lookup[normalizedName] = id
            }
        })
    })

    return lookup
}

export async function getTaxRateLookup() {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res

    try {
        res = await fetch(`${BASE_URL}/taxes?display=[id,rate,name]`, {
            headers: {
                ...getAuthHeaders(),
            },
            signal: controller.signal,
        })
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw new Error('Erreur réseau API')
    } finally {
        window.clearTimeout(timeoutId)
    }

    if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

    const xmlText = await res.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        throw new Error('Erreur parsing XML')
    }

    const lookup = {}
    Array.from(xmlDoc.getElementsByTagName('tax')).forEach((taxNode) => {
        const idNode = taxNode.getElementsByTagName('id')[0]
        const rateNode = taxNode.getElementsByTagName('rate')[0]
        const id = String(idNode?.textContent ?? '').trim()
        const rate = normalizeRateKey(rateNode?.textContent ?? '')

        if (id && rate && !lookup[rate]) {
            lookup[rate] = id
        }
    })

    return lookup
}

export async function getTaxRulesGroupRateLookup() {
    const lookup = {}

    const fetchXmlDocument = async (resourceName) => {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

        let res

        try {
            res = await fetch(`${BASE_URL}/${resourceName}`, {
                headers: {
                    ...getAuthHeaders(),
                },
                signal: controller.signal,
            })
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Timeout API')
            }

            throw new Error('Erreur réseau API')
        } finally {
            window.clearTimeout(timeoutId)
        }

        if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

        const xmlText = await res.text()
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

        if (xmlDoc.documentElement.nodeName === 'parsererror') {
            throw new Error('Erreur parsing XML')
        }

        return xmlDoc
    }

    let taxRulesDoc
    let taxesDoc

    try {
        ;[taxRulesDoc, taxesDoc] = await Promise.all([
            fetchXmlDocument('tax_rules'),
            fetchXmlDocument('taxes'),
        ])
    } catch {
        return lookup
    }

    const taxRateById = {}
    Array.from(taxesDoc.getElementsByTagName('tax')).forEach((taxNode) => {
        const idNode = taxNode.getElementsByTagName('id')[0]
        const rateNode = taxNode.getElementsByTagName('rate')[0]
        const taxId = String(idNode?.textContent ?? '').trim()
        const rate = normalizeRateKey(rateNode?.textContent ?? '')

        if (taxId && rate && !taxRateById[taxId]) {
            taxRateById[taxId] = rate
        }
    })

    Array.from(taxRulesDoc.getElementsByTagName('tax_rule')).forEach((taxRuleNode) => {
        const groupIdNode = taxRuleNode.getElementsByTagName('id_tax_rules_group')[0]
        const taxIdNode = taxRuleNode.getElementsByTagName('id_tax')[0]
        const groupId = String(groupIdNode?.textContent ?? '').trim()
        const taxId = String(taxIdNode?.textContent ?? '').trim()
        const rate = taxRateById[taxId]

        if (groupId && rate && !lookup[groupId]) {
            lookup[groupId] = rate
        }
    })

    return lookup
}

export async function getTaxRuleGroupsByRateLookup() {
    const rateLookup = await getTaxRulesGroupRateLookup()
    const lookup = {}
    
    // Inverser le lookup: {groupId: rate} → {rate: groupId}
    Object.entries(rateLookup).forEach(([groupId, rate]) => {
        const normalizedRate = normalizeRateKey(rate)
        if (normalizedRate && !lookup[normalizedRate]) {
            lookup[normalizedRate] = groupId
        }
    })
    
    return lookup
}

export async function ensureCategoryIdByName(categoryName, lookup = {}, cache = {}, languageIds = [1]) {
    const cleanedValue = String(categoryName ?? '').trim()

    if (!cleanedValue) {
        return ''
    }

    if (/^\d+$/.test(cleanedValue)) {
        return cleanedValue
    }

    const normalizedName = normalizeLookupKey(cleanedValue)
    if (!normalizedName) {
        return ''
    }

    if (cache[normalizedName]) {
        return cache[normalizedName]
    }

    if (lookup[normalizedName]) {
        cache[normalizedName] = lookup[normalizedName]
        return lookup[normalizedName]
    }

    const createdResponse = await insertResourceData('categories', buildCategoryXml(cleanedValue, languageIds))
    const createdId = extractCreatedId(createdResponse)

    if (createdId) {
        cache[normalizedName] = createdId
        lookup[normalizedName] = createdId
        return createdId
    }

    const refreshedLookup = await getCategoryNameLookup()
    const refreshedId = refreshedLookup[normalizedName] || ''
    if (refreshedId) {
        cache[normalizedName] = refreshedId
        lookup[normalizedName] = refreshedId
    }

    return refreshedId
}

export async function ensureTaxRuleGroupIdByRate(rateValue, lookup = {}, cache = {}, languageIds = [1]) {
    const normalizedRate = normalizeRateKey(rateValue)

    if (!normalizedRate) {
        return ''
    }

    // Vérifier le cache d'abord
    if (cache[normalizedRate]) {
        return cache[normalizedRate]
    }

    // Chercher dans le lookup (rate → groupId)
    if (lookup[normalizedRate]) {
        cache[normalizedRate] = lookup[normalizedRate]
        return lookup[normalizedRate]
    }

    // Le groupe n'existe pas, créer un nouveau
    const taxRateLookup = await getTaxRateLookup()
    let taxId = taxRateLookup[normalizedRate] || ''

    if (!taxId) {
        const createdTaxResponse = await insertResourceData('taxes', buildTaxXml(normalizedRate, languageIds))
        taxId = extractCreatedId(createdTaxResponse)

        if (!taxId) {
            const refreshedTaxLookup = await getTaxRateLookup()
            taxId = refreshedTaxLookup[normalizedRate] || ''
        }
    }

    if (!taxId) {
        return ''
    }

    const createdGroupResponse = await insertResourceData('tax_rule_groups', buildTaxRuleGroupXml(normalizedRate, languageIds))
    let groupId = extractCreatedId(createdGroupResponse)

    if (!groupId) {
        const refreshedGroupLookup = await getTaxRuleGroupsByRateLookup()
        groupId = refreshedGroupLookup[normalizedRate] || ''
    }

    if (!groupId) {
        return ''
    }

    const countryId = await getDefaultTaxCountryId()
    await insertResourceData('tax_rules', buildTaxRuleXml({ groupId, taxId, countryId }))

    cache[normalizedRate] = groupId
    lookup[normalizedRate] = groupId

    return groupId
}

async function getTaxRuleGroupNameLookup() {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res

    try {
        res = await fetch(`${BASE_URL}/tax_rule_groups?display=[id,name]`, {
            headers: {
                ...getAuthHeaders(),
            },
            signal: controller.signal,
        })
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw new Error('Erreur réseau API')
    } finally {
        window.clearTimeout(timeoutId)
    }

    if (!res.ok) throw new Error(getHttpErrorMessage(res.status))

    const xmlText = await res.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    if (xmlDoc.documentElement.nodeName === 'parsererror') {
        throw new Error('Erreur parsing XML')
    }

    const lookup = {}
    Array.from(xmlDoc.getElementsByTagName('tax_rule_group')).forEach((groupNode) => {
        const idNode = groupNode.getElementsByTagName('id')[0]
        const nameNode = groupNode.getElementsByTagName('name')[0]
        const id = String(idNode?.textContent ?? '').trim()
        const name = normalizeLookupKey(nameNode?.textContent ?? '')

        if (id && name && !lookup[name]) {
            lookup[name] = id
        }
    })

    return lookup
}

export async function prepareRowsForProductImport(
    rows,
    columnMappings = [],
    languageIds = [1],
    providedLookups = {}
) {
    if (!Array.isArray(rows)) {
        return { rows: [], taxRuleGroupsByRateLookup: {}, taxRateToGroupIdLookup: {} }
    }

    const categoryNameLookup = providedLookups.categoryNameLookup || (await getCategoryNameLookup())
    const taxRuleGroupsByRateLookup = providedLookups.taxRuleGroupsByRateLookup || (await getTaxRuleGroupsByRateLookup())
    const taxRulesGroupRateLookup = providedLookups.taxRulesGroupRateLookup || (await getTaxRulesGroupRateLookup())
    const taxRateToGroupIdLookup = {}

    const categoryCache = {}
    const taxGroupCache = {}

    const mappingLookup = Array.isArray(columnMappings)
        ? columnMappings.reduce((accumulator, mapping) => {
            if (!mapping || !mapping.csvColumn) {
                return accumulator
            }

            const apiField = String(mapping.apiField ?? '').trim()
            if (!apiField || apiField === 'no') {
                return accumulator
            }

            accumulator[mapping.csvColumn] = apiField
            return accumulator
        }, {})
        : {}

    const preparedRows = []

    for (const row of rows) {
        const preparedRow = { ...row }

        for (const [csvColumn, csvValue] of Object.entries(row)) {
            const apiField = mappingLookup[csvColumn]
            if (!apiField) {
                continue
            }

            if (apiField === 'categories' || apiField === 'category' || apiField === 'id_category_default') {
                const categoryValues = String(csvValue ?? '')
                    .split(/[,;|]/g)
                    .map((item) => item.trim())
                    .filter(Boolean)

                const resolvedCategoryIds = []
                for (const categoryValue of categoryValues) {
                    const categoryId = await ensureCategoryIdByName(categoryValue, categoryNameLookup, categoryCache, languageIds)
                    if (categoryId) {
                        resolvedCategoryIds.push(categoryId)
                    }
                }

                if (apiField === 'id_category_default') {
                    preparedRow[csvColumn] = resolvedCategoryIds[0] || String(csvValue ?? '').trim()
                } else {
                    preparedRow[csvColumn] = resolvedCategoryIds.join(',')
                }
                continue
            }

            if (apiField === 'tax_rate') {
                const groupId = await ensureTaxRuleGroupIdByRate(csvValue, taxRuleGroupsByRateLookup, taxGroupCache, languageIds)

                if (groupId) {
                    const normalizedRate = normalizeRateKey(csvValue)
                    taxRateToGroupIdLookup[normalizedRate] = groupId
                    // keep groupId -> rate mapping updated
                    taxRulesGroupRateLookup[groupId] = normalizedRate
                }
                continue
            }

            if (apiField === 'id_tax_rules_group') {
                const cleanedValue = String(csvValue ?? '').trim()
                if (!cleanedValue) {
                    continue
                }

                if (/^\d+$/.test(cleanedValue)) {
                    continue
                }

                const groupId = await ensureTaxRuleGroupIdByRate(cleanedValue, taxRuleGroupsByRateLookup, taxGroupCache, languageIds)

                if (groupId) {
                    preparedRow[csvColumn] = groupId
                    const normalizedRate = normalizeRateKey(cleanedValue)
                    taxRateToGroupIdLookup[normalizedRate] = groupId
                    taxRulesGroupRateLookup[groupId] = normalizedRate
                }
            }
        }

        preparedRows.push(preparedRow)
    }

    return {
        rows: preparedRows,
        categoryNameLookup,
        taxRulesGroupRateLookup,
        taxRuleGroupsByRateLookup,
        taxRateToGroupIdLookup,
    }
}


export async function insertResourceData(resourceName, xmlData)
{
    if (!resourceName) {
        throw new Error('resourceName required')
    }

    if (!xmlData) {
        throw new Error('xml data required')
    }

    const controller = new AbortController()

    const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    )

    try {

        const base = BASE_URL.replace(/\/$/, '')
        const url = `${base}/${resourceName}`

        const res = await fetch(url, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/xml',
                ...getAuthHeaders(),
            },

            body: xmlData,

            signal: controller.signal,
        })

        if (!res.ok) {
            const statusText = `${res.status} ${res.statusText}`
            const errorText = await res.text()
            try {
                console.error(`[API] POST ${url} failed: ${statusText}`)
                console.error('[API] Response body:', errorText)
                console.error('[API] Payload (truncated):', String(xmlData ?? '').slice(0, 2000))
                // If this is an order payload, also print full payload and response headers
                if ((resourceName && resourceName.toString().includes('orders')) || String(xmlData ?? '').includes('<order>')) {
                    try {
                        console.error('[API] Full Payload:', String(xmlData ?? ''))
                    } catch (e) {
                        // ignore
                    }

                    try {
                        const headers = {}
                        res.headers.forEach((v, k) => { headers[k] = v })
                        console.error('[API] Response headers:', JSON.stringify(headers, null, 2))
                    } catch (e) {
                        // ignore
                    }
                }
            } catch (e) {
                // ignore logging errors
            }
            throw new Error(`API POST ${statusText}: ${String(errorText).slice(0, 2000)}`)
        }

        return await res.text()
    }
    catch(error) {

        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error instanceof Error
            ? error
            : new Error(String(error))
    }
    finally {
        window.clearTimeout(timeoutId)
    }
}



export async function patchResourceData(resourceName, resourceId, xmlData)
{
    if (!resourceName) {
        throw new Error('resourceName required')
    }

    if (!resourceId) {
        throw new Error('resourceId required')
    }

    if (!xmlData) {
        throw new Error('xml data required')
    }

    const controller = new AbortController()

    const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    )

    try {
        const base = BASE_URL.replace(/\/$/, '')
        const url = `${base}/${resourceName}/${resourceId}`

        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/xml',
                ...getAuthHeaders(),
            },
            body: xmlData,
            signal: controller.signal,
        })

        if (!res.ok) {
            const statusText = `${res.status} ${res.statusText}`
            const errorText = await res.text()
            try {
                console.error(`[API] PATCH ${url} failed: ${statusText}`)
                console.error('[API] Response body:', errorText)
                console.error('[API] Payload (truncated):', String(xmlData ?? '').slice(0, 2000))
            } catch (e) {
                // ignore logging errors
            }
            throw new Error(`API PATCH ${statusText}: ${String(errorText).slice(0, 2000)}`)
        }

        return await res.text()
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout API')
        }

        throw error instanceof Error
            ? error
            : new Error(String(error))
    } finally {
        window.clearTimeout(timeoutId)
    }
}

export async function forceProductCombinationMode(productId, defaultCombinationId = '') {
    const cleanedProductId = String(productId ?? '').trim()

    if (!cleanedProductId) {
        return ''
    }

    const cleanedDefaultCombinationId = String(defaultCombinationId ?? '').trim()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<product>\n<id><![CDATA[${cleanedProductId}]]></id>\n<product_type><![CDATA[combinations]]></product_type>\n${cleanedDefaultCombinationId ? `<id_default_combination><![CDATA[${cleanedDefaultCombinationId}]]></id_default_combination>\n` : ''}</product>\n</prestashop>`

    try {
        return await patchResourceData('products', cleanedProductId, xml)
    } catch {
        return ''
    }
}

