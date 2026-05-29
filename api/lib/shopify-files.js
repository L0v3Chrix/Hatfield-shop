import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '../../scripts/shopify/lib/shopify-client.js'

function isImageMimeType(mimeType) {
  return /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(String(mimeType || ''))
}

function fileContentTypeForMime(mimeType) {
  return isImageMimeType(mimeType) ? 'IMAGE' : 'FILE'
}

async function createAdminClientFromEnv() {
  if (!process.env.SHOPIFY_SHOP_DOMAIN) {
    throw new Error('SHOPIFY_SHOP_DOMAIN is required for Shopify file uploads.')
  }
  if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN && !process.env.SHOPIFY_ADMIN_CLIENT_ID) {
    throw new Error('Shopify Admin credentials are required for Shopify file uploads.')
  }
  return createClient({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
  })
}

async function stagedUpload(client, file, safeName) {
  const mutation = `mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }`

  const response = await client.mutate('stagedUploadsCreate', mutation, {
    input: [{
      filename: safeName,
      mimeType: file.type || 'application/octet-stream',
      resource: 'FILE',
      httpMethod: 'POST',
    }],
  })

  const target = response.stagedTargets && response.stagedTargets[0]
  if (!target || !target.url || !target.resourceUrl) {
    throw new Error('Shopify did not return a staged upload target.')
  }

  const form = new FormData()
  for (const parameter of target.parameters || []) {
    form.append(parameter.name, parameter.value)
  }
  form.append('file', file, safeName)

  const uploadResponse = await fetch(target.url, {
    method: 'POST',
    body: form,
  })

  if (!uploadResponse.ok) {
    throw new Error(`Shopify staged upload failed (${uploadResponse.status}).`)
  }

  return target.resourceUrl
}

async function createShopifyFile(client, resourceUrl, safeName, mimeType) {
  const mutation = `mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        __typename
        ... on MediaImage {
          id
          fileStatus
          image { url }
        }
        ... on GenericFile {
          id
          fileStatus
          url
        }
      }
      userErrors { field message code }
    }
  }`

  const response = await client.mutate('fileCreate', mutation, {
    files: [{
      originalSource: resourceUrl,
      filename: safeName,
      contentType: fileContentTypeForMime(mimeType),
      duplicateResolutionMode: 'APPEND_UUID',
    }],
  })

  const created = response.files && response.files[0]
  if (!created || !created.id) {
    throw new Error('Shopify did not create a file record.')
  }
  return created
}

async function waitForShopifyFileUrl(client, id, { attempts = 8, waitMs = 1500 } = {}) {
  const query = `query FileNode($id: ID!) {
    node(id: $id) {
      __typename
      ... on MediaImage {
        id
        fileStatus
        image { url }
      }
      ... on GenericFile {
        id
        fileStatus
        url
      }
    }
  }`

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const data = await client.gql(query, { id })
    const node = data && data.node
    const url = node && node.__typename === 'MediaImage'
      ? node.image && node.image.url
      : node && node.url
    if (url) {
      return { url, status: node.fileStatus || 'READY' }
    }
    const status = node && node.fileStatus
    if (status && status !== 'UPLOADED' && status !== 'PROCESSING' && status !== 'READY') {
      throw new Error(`Shopify file processing failed with status ${status}.`)
    }
    await delay(waitMs)
  }

  throw new Error('Shopify file upload is still processing. Try again in a moment.')
}

export async function uploadArtworkToShopify(file, safeName) {
  const client = await createAdminClientFromEnv()
  const resourceUrl = await stagedUpload(client, file, safeName)
  const created = await createShopifyFile(client, resourceUrl, safeName, file.type || '')
  const settled = await waitForShopifyFileUrl(client, created.id)
  return {
    url: settled.url,
    fileId: created.id,
    status: settled.status,
  }
}
