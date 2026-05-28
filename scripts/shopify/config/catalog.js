// Catalog source of truth — originally derived from `Shopify product developer prompt.md`.
// Updated during production-readiness pass: fixed/upload products are live, builder products
// are now live in their collection lanes, and Glow 22x300 is corrected to $225.

const DTF_22_LENGTHS = [
  { length: '24',  price: '12.00' },
  { length: '36',  price: '18.00' },
  { length: '48',  price: '24.00' },
  { length: '60',  price: '30.00' },
  { length: '72',  price: '36.00' },
  { length: '84',  price: '42.00' },
  { length: '96',  price: '48.00' },
  { length: '108', price: '54.00' },
  { length: '120', price: '60.00' },
  { length: '132', price: '66.00' },
  { length: '144', price: '72.00' },
  { length: '156', price: '78.00' },
  { length: '168', price: '84.00' },
  { length: '180', price: '90.00' },
  { length: '192', price: '96.00' },
  { length: '300', price: '150.00' },
]

const DTF_46_LENGTHS = [
  { length: '12',  price: '12.00' },
  { length: '24',  price: '24.00' },
  { length: '36',  price: '36.00' },
  { length: '48',  price: '48.00' },
  { length: '60',  price: '60.00' },
  { length: '72',  price: '72.00' },
  { length: '80',  price: '80.00' },
  { length: '84',  price: '84.00' },
  { length: '96',  price: '96.00' },
  { length: '108', price: '108.00' },
  { length: '120', price: '120.00' },
  { length: '132', price: '132.00' },
  { length: '144', price: '144.00' },
  { length: '156', price: '156.00' },
  { length: '168', price: '168.00' },
  { length: '180', price: '180.00' },
  { length: '192', price: '192.00' },
  { length: '204', price: '204.00' },
  { length: '216', price: '216.00' },
  { length: '228', price: '228.00' },
  { length: '240', price: '240.00' },
]

const GLOW_22_LENGTHS = [
  { length: '24',  price: '18.00' },
  { length: '36',  price: '27.00' },
  { length: '48',  price: '36.00' },
  { length: '60',  price: '45.00' },
  { length: '72',  price: '54.00' },
  { length: '84',  price: '63.00' },
  { length: '96',  price: '72.00' },
  { length: '108', price: '81.00' },
  { length: '120', price: '90.00' },
  { length: '132', price: '99.00' },
  { length: '144', price: '108.00' },
  { length: '156', price: '117.00' },
  { length: '168', price: '126.00' },
  { length: '180', price: '135.00' },
  { length: '192', price: '144.00' },
  { length: '300', price: '225.00' },
]

const SUBLIMATION_24_LENGTHS = [
  { length: '24', price: '8.50' },
  { length: '36', price: '12.75' },
  { length: '48', price: '17.00' },
  { length: '60', price: '21.25' },
  { length: '72', price: '26.00' },
  { length: '84', price: '31.00' },
  { length: '96', price: '34.00' },
]

const GLITTER_COLORS = [
  { color: 'Silver', code: 'SIL' },
  { color: 'Gold',   code: 'GLD' },
  { color: 'Multi',  code: 'MLT' },
]

// Build helpers
function singleOptionVariants(prefix, lengths) {
  return lengths.map(({ length, price, flags }) => ({
    sku: `${prefix}-${length}`,
    options: { Length: length },
    price,
    flags,
  }))
}

function twoOptionVariants(prefix, lengths, colors) {
  const variants = []
  for (const { length, price, flags } of lengths) {
    for (const { color, code } of colors) {
      variants.push({
        sku: `${prefix}-${length}-${code}`,
        options: { Length: length, Color: color },
        price,
        flags,
      })
    }
  }
  return variants
}

export const COLLECTIONS = [
  { handle: 'dtf-transfers', title: 'DTF Transfers', members: ['dtf-22-sheet', 'dtf-46-sheet', 'dtf-22-gang-sheet-builder', 'dtf-46-gang-sheet-builder'] },
  { handle: 'glitter-dtf',   title: 'Glitter DTF',   members: ['glitter-dtf-22-sheet', 'glitter-dtf-22-gang-sheet-builder'] },
  { handle: 'glow-dtf',      title: 'Glow DTF',      members: ['glow-dtf-22-sheet', 'glow-dtf-22-gang-sheet-builder'] },
  { handle: 'sublimation',   title: 'Sublimation',   members: ['sublimation-24', 'sublimation-24-gang-sheet-builder'] },
  { handle: 'gang-sheets',   title: 'Gang Sheets',   members: ['custom-gang-sheet'] },
]

export const PRODUCTS = [
  {
    handle: 'dtf-22-sheet',
    title: 'DTF 22" Sheet',
    description: 'Custom 22-inch wide DTF transfers printed to order. Works on cotton, polyester, blends, nylon, and more. No pretreatment required.',
    productType: 'DTF Transfer',
    vendor: 'Hatfield McCoy DTF',
    status: 'ACTIVE',
    options: [{ name: 'Length', values: DTF_22_LENGTHS.map((l) => l.length) }],
    variants: singleOptionVariants('DTF-22', DTF_22_LENGTHS),
  },
  {
    handle: 'dtf-46-sheet',
    title: 'DTF 46" Sheet',
    description: 'Large-format 46-inch wide DTF transfers for oversized designs and bigger runs. Printed to order with durable color and clean detail.',
    productType: 'DTF Transfer',
    vendor: 'Hatfield McCoy DTF',
    status: 'ACTIVE',
    options: [{ name: 'Length', values: DTF_46_LENGTHS.map((l) => l.length) }],
    variants: singleOptionVariants('DTF-46', DTF_46_LENGTHS),
  },
  {
    handle: 'glitter-dtf-22-sheet',
    title: 'Glitter DTF 22" Sheet',
    description: '22-inch glitter DTF transfers available in Silver, Gold, and Multi. Designed for bold prints that need extra shine.',
    productType: 'Glitter DTF Transfer',
    vendor: 'Hatfield McCoy DTF',
    status: 'ACTIVE',
    options: [
      { name: 'Length', values: DTF_22_LENGTHS.map((l) => l.length) },
      { name: 'Color',  values: GLITTER_COLORS.map((c) => c.color) },
    ],
    variants: twoOptionVariants('GLT-22', DTF_22_LENGTHS, GLITTER_COLORS),
  },
  {
    handle: 'glow-dtf-22-sheet',
    title: 'Glow DTF 22" Sheet',
    description: 'Glow-in-the-dark 22-inch DTF transfers printed to order. Ideal for specialty designs, events, and high-visibility apparel.',
    productType: 'Glow DTF Transfer',
    vendor: 'Hatfield McCoy DTF',
    status: 'ACTIVE',
    options: [{ name: 'Length', values: GLOW_22_LENGTHS.map((l) => l.length) }],
    variants: singleOptionVariants('GID-22', GLOW_22_LENGTHS),
  },
  {
    handle: 'sublimation-24',
    title: 'Sublimation 24"',
    description: '24-inch sublimation transfers for hard goods and polyester applications. Produced for clean color and reliable press results.',
    productType: 'Sublimation Transfer',
    vendor: 'Hatfield McCoy DTF',
    status: 'ACTIVE',
    options: [{ name: 'Length', values: SUBLIMATION_24_LENGTHS.map((l) => l.length) }],
    variants: singleOptionVariants('SUB-24', SUBLIMATION_24_LENGTHS),
  },
  {
    handle: 'custom-gang-sheet',
    title: 'Custom Gang Sheet',
    description: 'Build your own custom gang sheet and submit artwork for production. Final configuration and workflow handled through the Kixxl builder.',
    productType: 'Gang Sheet',
    vendor: 'Hatfield McCoy DTF',
    status: 'DRAFT',
    keystone: true, // reporter highlights this ID for Kixxl mapping
    options: [{ name: 'Size', values: ['22" Wide Custom'] }],
    variants: [
      {
        sku: 'GS-22-CUSTOM',
        options: { Size: '22" Wide Custom' },
        price: '0.00',
        flags: ['placeholder_price_pending_kixxl_decision'],
      },
    ],
  },
]

// Derived helpers

export function totalVariantCount() {
  return PRODUCTS.reduce((sum, p) => sum + p.variants.length, 0)
}

export function allSkus() {
  const skus = []
  for (const p of PRODUCTS) {
    for (const v of p.variants) skus.push({ handle: p.handle, sku: v.sku })
  }
  return skus
}

export function validateCatalog() {
  const errors = []
  const seenSkus = new Map()
  const priceRegex = /^\d+\.\d{2}$/

  for (const product of PRODUCTS) {
    if (!product.handle) errors.push(`Product missing handle: ${product.title}`)
    if (!product.title) errors.push(`Product missing title: ${product.handle}`)
    if (!product.variants?.length) errors.push(`Product ${product.handle} has no variants`)

    // Option-value cardinality
    const optionValueCounts = (product.options ?? []).map((o) => o.values.length)
    const expectedVariants = optionValueCounts.reduce((a, b) => a * b, 1)
    if (product.variants.length !== expectedVariants) {
      errors.push(
        `Product ${product.handle}: variants (${product.variants.length}) != option cartesian product (${expectedVariants})`
      )
    }

    // SKU uniqueness + price format + option-value coverage
    for (const v of product.variants) {
      if (!v.sku) errors.push(`Product ${product.handle} has variant with no SKU`)
      else if (seenSkus.has(v.sku)) {
        errors.push(`Duplicate SKU ${v.sku} in products ${seenSkus.get(v.sku)} and ${product.handle}`)
      } else {
        seenSkus.set(v.sku, product.handle)
      }

      if (!priceRegex.test(v.price ?? '')) {
        errors.push(`Product ${product.handle} SKU ${v.sku} has invalid price format: ${v.price}`)
      }

      for (const option of product.options ?? []) {
        const actual = v.options?.[option.name]
        if (!option.values.includes(actual)) {
          errors.push(
            `Product ${product.handle} SKU ${v.sku} option "${option.name}" value "${actual}" not in declared values [${option.values.join(', ')}]`
          )
        }
      }
    }
  }

  // Collection membership sanity
  const knownHandles = new Set(PRODUCTS.map((p) => p.handle))
  for (const c of COLLECTIONS) {
    for (const m of c.members) {
      if (!knownHandles.has(m)) errors.push(`Collection ${c.handle} references unknown product handle: ${m}`)
    }
  }

  return errors
}
