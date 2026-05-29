const SITE_URL = 'https://www.hatfieldmccoydtf.com'
const BRAND = 'Hatfield McCoy DTF'
const LOCATION = 'Logan, West Virginia'
const SHORT_LOCATION = 'Logan, WV'

export function rewriteProductCopy(product, { sourceText = '' } = {}) {
  const family = customerProductType(product.productType)
  const lowPrice = (product.variants ?? []).some((variant) => variant.flags?.includes('low_price_floor_0_98'))
  const fulfillmentReview = product.tags?.includes('needs-fulfillment-review')
  const heldBack = fulfillmentReview || product.tags?.includes('source-tag-kixxl-proxy-product')
  const displayTitle = String(product.title ?? '').trim()
  const safeTitle = escapeHtml(displayTitle)
  const shortDescription = `${displayTitle} from ${BRAND}, produced in ${LOCATION} with nationwide shipping, direct checkout, and artwork upload attached to the order.`
  const bodyHtml = [
    `<p>${safeTitle} is part of the ${BRAND} expanded catalog for shops, creators, teams, and local businesses that need reliable custom print work without guesswork.</p>`,
    `<p>This ${family.toLowerCase()} option keeps pricing, production notes, and ordering steps easy to compare before you commit.</p>`,
    `<p>Choose a size or product option, add it to the cart, upload artwork, and move straight into Shopify checkout.</p>`,
  ].join('\n')

  return {
    status: heldBack ? 'launch-hold' : 'launch-ready',
    shortDescription,
    bodyHtml,
    sourceTextReferenceLength: String(sourceText ?? '').length,
    approvalTags: [
      ...(fulfillmentReview ? ['fulfillment-needs-review'] : []),
      ...(lowPrice ? ['pricing-needs-review'] : []),
    ],
  }
}

export function rewriteCollectionCopy(collection) {
  const title = escapeHtml(collection.title)
  return {
    status: 'launch-ready',
    shortDescription: `${title} from ${BRAND}, organized so customers can compare product families, materials, prices, and direct-order paths quickly.`,
    bodyHtml: [
      `<p>${title} brings related Hatfield McCoy DTF catalog options into one browseable lane for customers comparing sizes, materials, price points, and production fit.</p>`,
      `<p>Browse this collection to find the best fit, add the right option to the cart, and upload artwork before checkout.</p>`,
    ].join('\n'),
    approvalTags: [],
  }
}

export function rewriteServicePageCopy(page) {
  const sourceHandle = page.handle.replace(/^dtfva-/, '')
  const isVirginiaLocation = /-va$|virginia|richmond|norfolk|chesapeake|hampton|portsmouth|suffolk|arlington|danville|martinsville|williamsburg|petersburg|hopewell|emporia|franklin|south-boston|newport-news|virginia-beach/i.test(sourceHandle)
  const handle = isVirginiaLocation ? 'dtf-transfers-shipped-nationwide' : page.handle.replace(/^dtfva-/, '')
  const title = isVirginiaLocation ? 'DTF Transfers Shipped Nationwide from West Virginia' : titleize(handle)
  const bodyHtml = [
    `<p>${BRAND} prints from ${SHORT_LOCATION} and ships nationwide, giving brands, teams, shops, and creators a direct path to custom DTF, UV DTF, sublimation, and specialty print products.</p>`,
    `<p>Use this page to understand ordering steps, artwork prep expectations, and the fastest checkout path for each product family.</p>`,
  ].join('\n')

  return {
    handle,
    title,
    status: 'launch-ready',
    bodyHtml,
    sourceUrl: page.sourceUrl,
    approvalTags: [],
  }
}

export function buildSeoRecord({ kind, handle, title, description, urlPath, price, availability = 'PreOrder', indexable = false }) {
  const canonicalUrl = `${SITE_URL}${urlPath}`
  const seoTitle = clamp(`${title} | Hatfield McCoy DTF`, 62)
  const seoDescription = clamp(description, 158)
  const schema = buildSchema({ kind, title, description: seoDescription, canonicalUrl, price, availability })

  return {
    title: seoTitle,
    description: seoDescription,
    canonicalUrl,
    robots: indexable ? 'index, follow' : 'noindex, nofollow',
    openGraph: {
      type: kind === 'product' ? 'product' : 'website',
      title: seoTitle,
      description: seoDescription,
      url: canonicalUrl,
      siteName: BRAND,
    },
    schema,
  }
}

export function buildApprovalState(item) {
  const tags = item.tags ?? []
  const variants = item.variants ?? []
  const blockers = []
  if (tags.includes('needs-fulfillment-review') || tags.includes('fulfillment-needs-review')) blockers.push('fulfillment')
  if (tags.includes('source-tag-kixxl-proxy-product')) blockers.push('proxy')
  if (String(item.productType || '').toLowerCase().includes('kixxl_rolling_canvas_product_hidden')) blockers.push('proxy')
  const publishable = blockers.length === 0 && variants.length > 0
  return {
    blockers,
    publishable,
    indexable: false,
  }
}

export function createProductSeoDescription(product, copy) {
  return `${product.title} from ${BRAND} in ${LOCATION}. ${copy.shortDescription.replace(/\.$/, '')}. Ships nationwide with direct checkout and artwork upload.`
}

export function stripSourceCopy(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSchema({ kind, title, description, canonicalUrl, price, availability }) {
  if (kind === 'product') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description,
      brand: { '@type': 'Brand', name: BRAND },
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        priceCurrency: 'USD',
        price: price ?? '0.00',
        availability: `https://schema.org/${availability}`,
        itemCondition: 'https://schema.org/NewCondition',
      },
    }
  }
  if (kind === 'collection') {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonicalUrl,
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
  }
}

function titleize(value) {
  return String(value ?? '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function clamp(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function customerProductType(productType) {
  const raw = String(productType ?? '').trim()
  if (!raw || /kixxl|hidden|competitor parity/i.test(raw)) return 'custom print product'
  return raw
}
