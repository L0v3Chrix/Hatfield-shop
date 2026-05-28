const TARGET_VENDOR = 'Hatfield McCoy DTF'
const IMPORT_PREFIX = 'dtfva'
const LOW_PRICE_FLOOR = '0.98'

const FULFILLMENT_REVIEW_PATTERNS = [
  /cadlink/i,
  /software/i,
  /branding/i,
  /brand .*pack/i,
  /vector/i,
  /design/i,
  /service/i,
  /sports/i,
  /balls?/i,
  /pucks?/i,
  /magnets?/i,
  /banners?/i,
  /t-?shirts?/i,
  /patch/i,
  /coins?/i,
  /personalized/i,
]

const COMMERCE_PAGE_PATTERNS = [
  /contact/i,
  /faq|frequently-asked/i,
  /pressing-instructions|application-instructions|printing-guidelines/i,
  /guide|create-custom-gang-sheet|prepare-gang-sheet/i,
  /wholesale|reseller/i,
  /our-story/i,
  /dtf-printing|dtf-transfer/i,
]

const EXCLUDED_PAGE_PATTERNS = [
  /privacy/i,
  /policy/i,
  /terms/i,
  /mobile-app/i,
]

export function normalizeCatalog(scrape) {
  const canonicalUrlsByHandle = new Map(
    (scrape.sitemaps?.products ?? [])
      .map((url) => [url.split('/products/')[1]?.split(/[?#]/)[0], url])
      .filter(([handle]) => !!handle)
  )
  const scrapedAt = scrape.scrapedAt ?? new Date().toISOString()
  const products = (scrape.products ?? []).map((product) => normalizeProduct(product, { canonicalUrlsByHandle, scrapedAt }))
  const collections = normalizeCollections(scrape.collections ?? [])
  const pages = normalizePages(scrape.sitemaps?.pages ?? [])
  const errors = validateNormalizedCatalog({ products, collections, pages })

  return {
    meta: {
      source: 'dtfvirginia.com',
      scraped_at: scrapedAt,
      source_product_count: scrape.products?.length ?? 0,
      source_collection_count: scrape.collections?.length ?? 0,
      source_page_url_count: scrape.sitemaps?.pages?.length ?? 0,
      source_blog_url_count: scrape.sitemaps?.blogs?.length ?? 0,
      normalized_product_count: products.length,
      normalized_collection_count: collections.length,
      normalized_page_count: pages.length,
    },
    products,
    collections,
    pages,
    validationErrors: errors,
  }
}

export function normalizeProduct(sourceProduct, { canonicalUrlsByHandle = new Map(), scrapedAt = new Date().toISOString() } = {}) {
  const sourceUrl = canonicalUrlsByHandle.get(sourceProduct.handle) ?? `https://dtfvirginia.com/products/${sourceProduct.handle}`
  const options = inferOptions(sourceProduct)
  const riskFlags = inferProductRiskFlags(sourceProduct)
  const tags = [
    'competitor-parity',
    'source-dtf-virginia',
    ...riskFlags,
    ...(sourceProduct.tags ?? []).map((tag) => `source-tag-${slugify(tag)}`).filter((tag) => tag !== 'source-tag-'),
  ]

  return {
    handle: importHandle(sourceProduct.handle),
    sourceHandle: sourceProduct.handle,
    title: sourceProduct.title,
    description: buildSafeDescription(sourceProduct),
    productType: sourceProduct.product_type || 'Competitor Parity',
    vendor: TARGET_VENDOR,
    status: 'DRAFT',
    options,
    variants: (sourceProduct.variants ?? []).map((variant, index) => normalizeVariant(variant, sourceProduct, options, index)),
    tags: unique(tags),
    metafields: {
      source_domain: 'dtfvirginia.com',
      source_url: sourceUrl,
      source_product_id: String(sourceProduct.id ?? ''),
      source_handle: sourceProduct.handle,
      source_vendor: sourceProduct.vendor ?? '',
      scraped_at: scrapedAt,
      competitor_image_urls: (sourceProduct.images ?? []).map((image) => image.src).filter(Boolean),
      competitor_copy_reference_length: stripHtml(sourceProduct.body_html ?? '').length,
      publish_note: 'Draft import only. Rewrite copy and replace imagery before publishing.',
    },
  }
}

export function normalizeCollections(sourceCollections) {
  return sourceCollections.map((collection) => ({
    handle: importHandle(collection.handle),
    title: collection.title,
    description: 'Hatfield McCoy DTF collection inspired by competitive catalog coverage. Review copy and imagery before publishing.',
    sourceHandle: collection.handle,
    sourceProductsCount: collection.products_count ?? 0,
    imageReferenceUrl: collection.image?.src ?? '',
  }))
}

export function normalizePages(pageUrls) {
  return pageUrls.filter(isCommercePageUrl).map((url) => {
    const slug = url.split('/pages/')[1]?.split(/[?#]/)[0] ?? ''
    return {
      handle: importHandle(slug),
      sourceUrl: url,
      title: titleFromHandle(slug),
      status: 'DRAFT',
      rewriteBrief: 'Rewrite this commerce/support page in Hatfield McCoy DTF voice. Do not copy DTF Virginia wording.',
    }
  })
}

export function isCommercePageUrl(url) {
  if (!url.includes('/pages/')) return false
  if (EXCLUDED_PAGE_PATTERNS.some((pattern) => pattern.test(url))) return false
  return COMMERCE_PAGE_PATTERNS.some((pattern) => pattern.test(url))
}

export function validateNormalizedCatalog({ products, collections, pages }) {
  const errors = []
  const productHandles = new Set()
  const skus = new Set()

  for (const product of products) {
    if (!product.handle) errors.push(`Product "${product.title}" missing handle`)
    if (productHandles.has(product.handle)) errors.push(`Duplicate product handle: ${product.handle}`)
    productHandles.add(product.handle)
    if (product.vendor !== TARGET_VENDOR) errors.push(`Product ${product.handle} has wrong vendor: ${product.vendor}`)
    if (product.status !== 'DRAFT') errors.push(`Product ${product.handle} is not DRAFT`)
    if (!product.metafields?.source_url) errors.push(`Product ${product.handle} missing source_url`)
    if (/<[a-z][\s\S]*>/i.test(product.description)) errors.push(`Product ${product.handle} description still contains HTML`)

    for (const variant of product.variants ?? []) {
      if (!variant.sku) errors.push(`Product ${product.handle} has variant missing SKU`)
      if (skus.has(variant.sku)) errors.push(`Duplicate SKU: ${variant.sku}`)
      skus.add(variant.sku)
      if (!/^\d+\.\d{2}$/.test(variant.price)) errors.push(`Variant ${variant.sku} has invalid price: ${variant.price}`)
      const sourcePrice = Number(variant.sourcePrice)
      const expected = sourcePrice > 1 ? (sourcePrice - 1).toFixed(2) : LOW_PRICE_FLOOR
      if (variant.price !== expected) errors.push(`Variant ${variant.sku} price ${variant.price} should be ${expected}`)
    }
  }

  const collectionHandles = new Set()
  for (const collection of collections) {
    if (collectionHandles.has(collection.handle)) errors.push(`Duplicate collection handle: ${collection.handle}`)
    collectionHandles.add(collection.handle)
  }

  const pageHandles = new Set()
  for (const page of pages) {
    if (pageHandles.has(page.handle)) errors.push(`Duplicate page handle: ${page.handle}`)
    pageHandles.add(page.handle)
  }

  return errors
}

function normalizeVariant(variant, sourceProduct, options, index) {
  const sourcePrice = Number(variant.price ?? 0)
  const price = sourcePrice > 1 ? (sourcePrice - 1).toFixed(2) : LOW_PRICE_FLOOR
  const optionValues = {}
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const optionName = options[optionIndex].name
    optionValues[optionName] = variant[`option${optionIndex + 1}`] || variant.title || 'Default Title'
  }
  const flags = []
  if (sourcePrice <= 1) flags.push('low_price_floor_0_98')

  return {
    sku: variant.sku || fallbackSku(sourceProduct.handle, variant, index),
    sourceVariantId: String(variant.id ?? ''),
    title: variant.title ?? '',
    options: optionValues,
    price,
    sourcePrice: sourcePrice.toFixed(2),
    flags,
  }
}

function inferOptions(product) {
  const sourceOptions = product.options ?? []
  if (sourceOptions.length) {
    return sourceOptions.map((option, index) => ({
      name: option.name || `Option ${index + 1}`,
      values: unique(option.values ?? []),
    }))
  }

  const variants = product.variants ?? []
  const names = ['Title', 'Option 2', 'Option 3']
  const usedOptionIndexes = [1, 2, 3].filter((index) => variants.some((variant) => {
    const value = variant[`option${index}`]
    return value && value !== 'Default Title'
  }))
  const indexes = usedOptionIndexes.length ? usedOptionIndexes : [1]

  return indexes.map((index) => ({
    name: names[index - 1],
    values: unique(variants.map((variant) => variant[`option${index}`] || variant.title || 'Default Title')),
  }))
}

function inferProductRiskFlags(product) {
  const text = [product.title, product.handle, product.product_type, ...(product.tags ?? [])].filter(Boolean).join(' ')
  return FULFILLMENT_REVIEW_PATTERNS.some((pattern) => pattern.test(text)) ? ['needs-fulfillment-review'] : []
}

function buildSafeDescription(sourceProduct) {
  const productType = sourceProduct.product_type || 'catalog item'
  return [
    `${TARGET_VENDOR} catalog listing for ${sourceProduct.title}.`,
    `Imported as a draft competitive-parity ${productType} product for internal review.`,
    'Rewrite product copy, confirm fulfillment, and replace any reference imagery before publishing.',
  ].join(' ')
}

function importHandle(handle) {
  return `${IMPORT_PREFIX}-${slugify(handle)}`
}

function fallbackSku(handle, variant, index) {
  const suffix = slugify(variant.title || variant.option1 || String(index + 1)).toUpperCase().replace(/-/g, '_')
  return `${IMPORT_PREFIX.toUpperCase()}-${slugify(handle).toUpperCase().replace(/-/g, '_')}-${suffix}`
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleFromHandle(handle) {
  return slugify(handle)
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && String(value).length > 0))]
}

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
