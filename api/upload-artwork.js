import { readFile } from 'node:fs/promises'
import { put } from '@vercel/blob'
import { formidable } from 'formidable'
import { uploadArtworkToShopify } from './lib/shopify-files.js'

const MAX_BYTES = Number(process.env.ARTWORK_UPLOAD_MAX_BYTES || 50 * 1024 * 1024)
const ALLOWED_NAME = /\.(png|jpe?g|pdf|ai|eps)$/i

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return json(response, { error: 'Method not allowed.' }, 405)
  }

  let parsed
  try {
    parsed = await parseMultipart(request)
  } catch (error) {
    return json(response, { error: 'Invalid multipart form data.' }, 400)
  }

  const uploaded = firstFile(parsed.files.file)
  if (!uploaded) {
    return json(response, { error: 'No artwork file was provided.' }, 400)
  }

  const originalName = uploaded.originalFilename || 'artwork'
  if (!ALLOWED_NAME.test(originalName)) {
    return json(response, { error: 'Unsupported file type. Use PNG, JPG, PDF, AI, or EPS.' }, 400)
  }

  if (Number(uploaded.size || 0) > MAX_BYTES) {
    return json(response, { error: 'File is too large. Max 50MB.' }, 400)
  }

  const safeName = String(originalName)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'artwork'

  try {
    const bytes = await readFile(uploaded.filepath)
    const file = new File([bytes], safeName, {
      type: uploaded.mimetype || 'application/octet-stream',
    })
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

    return json(response, {
      fileName: safeName,
      url: uploadedUrl,
      storage,
      uploadedAt: new Date().toISOString(),
      size: Number(file.size || 0),
      contentType: file.type || '',
    }, 200)
  } catch (error) {
    return json(response, { error: error && error.message ? error.message : 'Artwork upload failed.' }, 500)
  }
}

function parseMultipart(request) {
  const form = formidable({
    maxFileSize: MAX_BYTES,
    multiples: false,
  })
  return new Promise((resolve, reject) => {
    form.parse(request, (error, fields, files) => {
      if (error) reject(error)
      else resolve({ fields, files })
    })
  })
}

function firstFile(value) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function json(response, payload, status) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(payload))
}
