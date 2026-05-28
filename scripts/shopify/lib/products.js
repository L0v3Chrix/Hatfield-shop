// Product create/update logic for the Shopify catalog seeder.
// Idempotency pattern: query by handle first, then create missing or update existing (only when --update is set).

const PRODUCT_FIELDS = `
  id
  handle
  title
  status
  productType
  vendor
  options { id name position values }
  variants(first: 250) {
    edges {
      node {
        id
        sku
        price
        selectedOptions { name value }
      }
    }
  }
`

const Q_PRODUCT_BY_HANDLE = /* GraphQL */ `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) { ${PRODUCT_FIELDS} }
  }
`

const M_PRODUCT_CREATE = /* GraphQL */ `
  mutation ProductCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product { ${PRODUCT_FIELDS} }
      userErrors { field message }
    }
  }
`

const M_VARIANTS_BULK_CREATE = /* GraphQL */ `
  mutation VariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
    productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
      product { id }
      productVariants { id sku price selectedOptions { name value } }
      userErrors { field message }
    }
  }
`

const M_VARIANTS_BULK_UPDATE = /* GraphQL */ `
  mutation VariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product { id }
      productVariants { id sku price selectedOptions { name value } }
      userErrors { field message }
    }
  }
`

const M_PRODUCT_UPDATE = /* GraphQL */ `
  mutation ProductUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { ${PRODUCT_FIELDS} }
      userErrors { field message }
    }
  }
`

function toVariantBulkInput(variant, optionOrder) {
  // optionOrder defines the declared option names from the product config, in order
  const optionValues = optionOrder.map((name) => ({
    optionName: name,
    name: String(variant.options[name]),
  }))
  return {
    optionValues,
    price: variant.price,
    inventoryItem: { sku: variant.sku, tracked: false },
  }
}

function flattenVariants(node) {
  return (node?.variants?.edges ?? []).map((e) => e.node)
}

function buildDiff(product, existing) {
  const existingBySku = new Map(flattenVariants(existing).map((v) => [v.sku, v]))
  const configBySku = new Map(product.variants.map((v) => [v.sku, v]))

  const toCreate = []
  const toUpdate = []
  const unchanged = []
  const extras = [] // existing variants with SKUs not in our spec

  for (const cfgVariant of product.variants) {
    const live = existingBySku.get(cfgVariant.sku)
    if (!live) {
      toCreate.push(cfgVariant)
      continue
    }
    if (Number(live.price) !== Number(cfgVariant.price)) {
      toUpdate.push({ cfgVariant, live })
    } else {
      unchanged.push({ cfgVariant, live })
    }
  }

  for (const [sku, live] of existingBySku) {
    if (!configBySku.has(sku)) extras.push(live)
  }

  return { toCreate, toUpdate, unchanged, extras }
}

export async function getProductByHandle(client, handle) {
  const data = await client.gql(Q_PRODUCT_BY_HANDLE, { handle })
  return data.productByHandle
}

export async function createProductWithVariants(client, product, { dryRun = false, verbose = false } = {}) {
  const optionOrder = product.options.map((o) => o.name)
  const productInput = {
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.description,
    productType: product.productType,
    vendor: product.vendor,
    status: product.status,
    ...(product.tags?.length ? { tags: product.tags } : {}),
    ...(product.metafields?.length ? { metafields: product.metafields } : {}),
    productOptions: product.options.map((o) => ({
      name: o.name,
      values: o.values.map((v) => ({ name: String(v) })),
    })),
  }

  if (dryRun) {
    return {
      action: 'created',
      dryRun: true,
      handle: product.handle,
      plan: {
        productInput: { handle: productInput.handle, title: productInput.title, options: product.options.map((o) => o.name) },
        variantCount: product.variants.length,
      },
    }
  }

  const createPayload = await client.mutate('productCreate', M_PRODUCT_CREATE, { product: productInput })
  const created = createPayload.product
  if (!created?.id) throw new Error(`productCreate succeeded but returned no id for ${product.handle}`)

  const variants = product.variants.map((v) => toVariantBulkInput(v, optionOrder))
  const bulk = await client.mutate('productVariantsBulkCreate', M_VARIANTS_BULK_CREATE, {
    productId: created.id,
    variants,
    strategy: 'REMOVE_STANDALONE_VARIANT',
  })

  if (verbose) {
    console.error(`[products] created ${product.handle} with ${bulk.productVariants.length} variants`)
  }

  return {
    action: 'created',
    handle: product.handle,
    productId: created.id,
    variantIds: bulk.productVariants.map((v) => ({ id: v.id, sku: v.sku })),
  }
}

export async function reconcileProduct(client, product, existing, { dryRun = false, allowUpdate = false, verbose = false } = {}) {
  const diff = buildDiff(product, existing)
  const optionOrder = product.options.map((o) => o.name)

  // Existing options coverage — if live options differ in names/values from our config, flag and skip
  const liveOptionNames = (existing.options ?? []).map((o) => o.name)
  const configOptionNames = product.options.map((o) => o.name)
  const optionMismatch = !arraysEqual(liveOptionNames, configOptionNames)

  if (optionMismatch) {
    return {
      action: 'skipped',
      handle: product.handle,
      productId: existing.id,
      reason: `Live product options [${liveOptionNames.join(', ')}] differ from config [${configOptionNames.join(', ')}] — manual review required`,
      diff: summarizeDiff(diff),
    }
  }

  // Nothing to do
  if (diff.toCreate.length === 0 && diff.toUpdate.length === 0) {
    return {
      action: 'skipped',
      handle: product.handle,
      productId: existing.id,
      reason: 'No variant differences detected',
      diff: summarizeDiff(diff),
    }
  }

  if (!allowUpdate) {
    return {
      action: 'skipped',
      handle: product.handle,
      productId: existing.id,
      reason: `Differences exist but --update flag not set (${diff.toCreate.length} to create, ${diff.toUpdate.length} to update)`,
      diff: summarizeDiff(diff),
    }
  }

  if (dryRun) {
    return {
      action: 'updated',
      dryRun: true,
      handle: product.handle,
      productId: existing.id,
      diff: summarizeDiff(diff),
    }
  }

  // Real update path
  const updatedIds = []
  if (diff.toUpdate.length) {
    const updates = diff.toUpdate.map(({ cfgVariant, live }) => ({
      id: live.id,
      price: cfgVariant.price,
    }))
    const bulk = await client.mutate('productVariantsBulkUpdate', M_VARIANTS_BULK_UPDATE, {
      productId: existing.id,
      variants: updates,
    })
    updatedIds.push(...bulk.productVariants.map((v) => ({ id: v.id, sku: v.sku })))
  }

  const createdIds = []
  if (diff.toCreate.length) {
    const inputs = diff.toCreate.map((v) => toVariantBulkInput(v, optionOrder))
    const bulk = await client.mutate('productVariantsBulkCreate', M_VARIANTS_BULK_CREATE, {
      productId: existing.id,
      variants: inputs,
      strategy: 'DEFAULT',
    })
    createdIds.push(...bulk.productVariants.map((v) => ({ id: v.id, sku: v.sku })))
  }

  if (verbose) {
    console.error(`[products] updated ${product.handle}: +${createdIds.length} variants, ~${updatedIds.length} variants`)
  }

  return {
    action: 'updated',
    handle: product.handle,
    productId: existing.id,
    variantIds: [...createdIds, ...updatedIds],
    diff: summarizeDiff(diff),
  }
}

export async function updateProductMetadata(client, product, existing, { dryRun = false, verbose = false } = {}) {
  const productInput = {
    id: existing.id,
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.description,
    productType: product.productType,
    vendor: product.vendor,
    status: product.status,
    ...(product.tags?.length ? { tags: product.tags } : {}),
    ...(product.metafields?.length ? { metafields: product.metafields } : {}),
  }

  if (dryRun) {
    return {
      action: 'updated',
      dryRun: true,
      handle: product.handle,
      productId: existing.id,
      reason: 'Metadata sync planned',
    }
  }

  const payload = await client.mutate('productUpdate', M_PRODUCT_UPDATE, { product: productInput })
  if (verbose) console.error(`[products] metadata synced ${product.handle}`)
  return {
    action: 'updated',
    handle: product.handle,
    productId: payload.product.id,
    reason: 'Metadata synced',
  }
}

function summarizeDiff(diff) {
  return {
    toCreate: diff.toCreate.map((v) => v.sku),
    toUpdate: diff.toUpdate.map((u) => ({ sku: u.cfgVariant.sku, from: u.live.price, to: u.cfgVariant.price })),
    unchangedCount: diff.unchanged.length,
    extras: diff.extras.map((v) => v.sku), // existing SKUs not in our config
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}
