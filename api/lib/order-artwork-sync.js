import { extname } from 'node:path'

const ARTWORK_URL_KEYS = new Set([
  'artwork upload url',
  'artwork file url',
])

const ARTWORK_NAME_KEYS = new Set([
  'artwork file',
  'artwork filename',
  'artwork name',
])

export function normalizeAttributeList(entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry) => {
      if (!entry) return null
      if (Array.isArray(entry) && entry.length >= 2) {
        return { key: String(entry[0] || '').trim(), value: String(entry[1] || '').trim() }
      }
      const key = String(entry.name || entry.key || '').trim()
      const value = String(entry.value || '').trim()
      if (!key || !value) return null
      return { key, value }
    })
    .filter(Boolean)
}

export function buildOrderFolderName(order) {
  const orderName = String(order && (order.name || order.order_number || order.orderNumber) || '').trim()
  const orderId = String(order && (order.id || order.admin_graphql_api_id || order.adminGraphqlApiId) || '').trim()
  const bits = ['Hatfield McCoy Order']
  if (orderName) bits.push(orderName.replace(/\s+/g, ' '))
  if (orderId) bits.push(orderId.replace(/[^0-9A-Za-z_-]+/g, '-'))
  return bits.join(' - ')
}

export function inferFileNameFromUrl(url, fallback = 'artwork') {
  try {
    const parsed = new URL(url)
    const segment = decodeURIComponent(parsed.pathname.split('/').pop() || '')
    const safe = segment.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    return safe || fallback
  } catch {
    return fallback
  }
}

export function normalizeFileName(name, fallback = 'artwork') {
  const safe = String(name || '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return safe || fallback
}

export function ensureExtension(name, contentType) {
  if (extname(name)) return name
  const type = String(contentType || '').toLowerCase()
  if (type.includes('png')) return `${name}.png`
  if (type.includes('jpeg') || type.includes('jpg')) return `${name}.jpg`
  if (type.includes('pdf')) return `${name}.pdf`
  if (type.includes('postscript')) return `${name}.eps`
  if (type.includes('illustrator')) return `${name}.ai`
  return name
}

export function collectArtworkEntries(order) {
  const lineItems = Array.isArray(order && order.line_items) ? order.line_items : []
  return lineItems.flatMap((lineItem, lineIndex) => {
    const attributes = normalizeAttributeList(
      lineItem && (lineItem.properties || lineItem.custom_attributes || lineItem.customAttributes || lineItem.attributes)
    )
    const artworkUrlEntry = attributes.find((entry) => ARTWORK_URL_KEYS.has(entry.key.toLowerCase()))
    if (!artworkUrlEntry || !artworkUrlEntry.value) return []
    const artworkNameEntry = attributes.find((entry) => ARTWORK_NAME_KEYS.has(entry.key.toLowerCase()))
    const rawFileName = artworkNameEntry && artworkNameEntry.value
      ? artworkNameEntry.value
      : inferFileNameFromUrl(artworkUrlEntry.value, `artwork-${lineIndex + 1}`)
    const lineTitle = String(lineItem && (lineItem.title || lineItem.name) || `Line ${lineIndex + 1}`).trim()
    const variantTitle = String(lineItem && (lineItem.variant_title || lineItem.variantTitle) || '').trim()
    const sku = String(lineItem && lineItem.sku || '').trim()
    const quantity = Math.max(1, Number(lineItem && lineItem.quantity) || 1)
    return [{
      lineIndex,
      lineTitle,
      variantTitle,
      sku,
      quantity,
      artworkUrl: artworkUrlEntry.value,
      artworkFileName: normalizeFileName(rawFileName, `artwork-${lineIndex + 1}`),
    }]
  })
}

export function buildDriveFileName(entry, index, contentType) {
  const prefixParts = [`line-${entry.lineIndex + 1}`]
  if (entry.sku) prefixParts.push(entry.sku)
  const label = normalizeFileName(entry.artworkFileName, `artwork-${index + 1}`)
  return ensureExtension(`${prefixParts.join('-')}-${label}`, contentType)
}

export function shopifyOrderGid(order) {
  if (!order) return ''
  if (order.admin_graphql_api_id) return String(order.admin_graphql_api_id)
  if (order.adminGraphqlApiId) return String(order.adminGraphqlApiId)
  const numericId = String(order.id || '').trim()
  if (/^\d+$/.test(numericId)) return `gid://shopify/Order/${numericId}`
  return ''
}
