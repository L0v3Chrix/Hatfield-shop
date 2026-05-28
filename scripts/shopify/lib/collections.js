// Collection create/match + product-membership reconciliation.
// Creates manual (non-smart) collections only. No publication toggles.

const Q_COLLECTION_BY_HANDLE = /* GraphQL */ `
  query CollectionByHandle($handle: String!) {
    collectionByHandle(handle: $handle) {
      id
      handle
      title
      updatedAt
      productsCount { count }
    }
  }
`

const Q_COLLECTION_PRODUCTS = /* GraphQL */ `
  query CollectionProducts($id: ID!, $cursor: String) {
    collection(id: $id) {
      id
      products(first: 250, after: $cursor) {
        edges { cursor node { id handle } }
        pageInfo { hasNextPage }
      }
    }
  }
`

const M_COLLECTION_CREATE = /* GraphQL */ `
  mutation CollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id handle title }
      userErrors { field message }
    }
  }
`

const M_COLLECTION_ADD_PRODUCTS = /* GraphQL */ `
  mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id handle productsCount { count } }
      userErrors { field message }
    }
  }
`

export async function getCollectionByHandle(client, handle) {
  const data = await client.gql(Q_COLLECTION_BY_HANDLE, { handle })
  return data.collectionByHandle
}

async function getExistingMemberHandles(client, collectionId) {
  const handles = new Set()
  let cursor = null
  while (true) {
    const data = await client.gql(Q_COLLECTION_PRODUCTS, { id: collectionId, cursor })
    const edges = data.collection?.products?.edges ?? []
    for (const e of edges) handles.add(e.node.handle)
    if (!data.collection?.products?.pageInfo?.hasNextPage) break
    cursor = edges[edges.length - 1]?.cursor ?? null
    if (!cursor) break
  }
  return handles
}

export async function createCollection(client, collection, { dryRun = false, verbose = false } = {}) {
  if (dryRun) {
    return { action: 'created', dryRun: true, handle: collection.handle, plannedTitle: collection.title }
  }
  const payload = await client.mutate('collectionCreate', M_COLLECTION_CREATE, {
    input: {
      title: collection.title,
      handle: collection.handle,
      ...(collection.description ? { descriptionHtml: collection.description } : {}),
    },
  })
  if (verbose) console.error(`[collections] created ${collection.handle} (${payload.collection.id})`)
  return {
    action: 'created',
    handle: payload.collection.handle,
    collectionId: payload.collection.id,
    title: payload.collection.title,
  }
}

export async function ensureCollectionMembers(client, { collectionId, handle, desiredProductIds, desiredHandles }, { dryRun = false, verbose = false } = {}) {
  // Resolve which are already members so we only call collectionAddProducts with new ones
  const existing = await getExistingMemberHandles(client, collectionId)
  const toAdd = []
  const alreadyMember = []

  for (let i = 0; i < desiredHandles.length; i++) {
    const h = desiredHandles[i]
    const pid = desiredProductIds[i]
    if (!pid) continue
    if (existing.has(h)) alreadyMember.push(h)
    else toAdd.push({ handle: h, productId: pid })
  }

  if (!toAdd.length) {
    return { handle, addedCount: 0, alreadyMember }
  }

  if (dryRun) {
    return { handle, dryRun: true, addedCount: toAdd.length, toAdd: toAdd.map((t) => t.handle), alreadyMember }
  }

  const payload = await client.mutate('collectionAddProducts', M_COLLECTION_ADD_PRODUCTS, {
    id: collectionId,
    productIds: toAdd.map((t) => t.productId),
  })
  if (verbose) {
    console.error(`[collections] ${handle}: added ${toAdd.length} products, total=${payload.collection.productsCount?.count}`)
  }
  return {
    handle,
    addedCount: toAdd.length,
    alreadyMember,
    addedHandles: toAdd.map((t) => t.handle),
  }
}
