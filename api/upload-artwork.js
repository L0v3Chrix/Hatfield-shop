import { put } from '@vercel/blob'
import { uploadArtworkToShopify } from './lib/shopify-files.js'

const MAX_BYTES = Number(process.env.ARTWORK_UPLOAD_MAX_BYTES || 50 * 1024 * 1024)
const ALLOWED_NAME = /\.(png|jpe?g|pdf|ai|eps)$/i

export const config = {
  runtime: 'nodejs',
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  let form
  try {
    form = await request.formData()
  } catch (error) {
    return json({ error: 'Invalid multipart form data.' }, 400)
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return json({ error: 'No artwork file was provided.' }, 400)
  }

  if (!ALLOWED_NAME.test(file.name || '')) {
    return json({ error: 'Unsupported file type. Use PNG, JPG, PDF, AI, or EPS.' }, 400)
  }

  if (Number(file.size || 0) > MAX_BYTES) {
    return json({ error: 'File is too large. Max 50MB.' }, 400)
  }

  const safeName = String(file.name || 'artwork')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'artwork'

  try {
    let uploadedUrl = ''
    let storage = 'shopify-files'

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const path = `artwork/${Date.now()}-${safeName}`
      const blob = await put(path, file, {
        access: 'public',
        addRandomSuffix: true,
        contentType: file.type || undefined,
      })
      uploadedUrl = blob.url
      storage = 'vercel-blob'
    } else {
      const uploaded = await uploadArtworkToShopify(file, safeName)
      uploadedUrl = uploaded.url
      storage = 'shopify-files'
    }

    return json({
      fileName: safeName,
      url: uploadedUrl,
      storage,
      uploadedAt: new Date().toISOString(),
      size: Number(file.size || 0),
      contentType: file.type || '',
    }, 200)
  } catch (error) {
    return json({ error: error && error.message ? error.message : 'Artwork upload failed.' }, 500)
  }
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
