import { readFile } from 'node:fs/promises'
import { put } from '@vercel/blob'
import { formidable } from 'formidable'
import { uploadArtworkToShopify } from './lib/shopify-files.js'

const MAX_BYTES = Number(process.env.ARTWORK_UPLOAD_MAX_BYTES || 50 * 1024 * 1024)
const ALLOWED_NAME = /\.(png|jpe?g|pdf|ai|eps)$/i

// The storefront posts same-origin; a forged cross-site browser POST carries a
// disallowed Origin and is rejected here. Server-to-server callers can still
// forge the header (see note below) — origin-gating only stops browser abuse.
const DEFAULT_ORIGINS = [
  'https://www.hatfieldmccoydtf.com',
  'https://hatfieldmccoydtf.com',
]
const ALLOWED_ORIGINS = new Set(
  (process.env.ARTWORK_UPLOAD_ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
    .split(',').map((o) => o.trim()).filter(Boolean),
)

function isAllowedOrigin(origin) {
  if (!origin) return true // same-origin requests may omit Origin; don't hard-block
  try {
    const url = new URL(origin)
    if (ALLOWED_ORIGINS.has(origin)) return true
    // Vercel preview/prod deploys of this project.
    if (/(^|\.)vercel\.app$/.test(url.hostname)) return true
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true
    return false
  } catch {
    return false
  }
}

// Magic-byte sniff — an attacker can rename evil.exe to art.png; the extension
// check alone is not enough. Accept only real PNG/JPEG/PDF/PostScript(AI/EPS).
function sniffAllowed(bytes) {
  if (!bytes || bytes.length < 4) return false
  const b = bytes
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true // PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true // JPEG
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return true // %PDF (also .ai)
  if (b[0] === 0x25 && b[1] === 0x21) return true // %! PostScript (EPS / older .ai)
  if (b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6) return true // DOS-EPS binary header
  return false
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return json(response, { error: 'Method not allowed.' }, 405)
  }

  if (!isAllowedOrigin(request.headers.origin)) {
    return json(response, { error: 'Forbidden.' }, 403)
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
    if (!sniffAllowed(bytes)) {
      return json(response, { error: 'That file does not look like a PNG, JPG, PDF, AI, or EPS.' }, 400)
    }
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
    // Generic message — don't leak internal error detail to the client.
    console.error('[upload-artwork] failed:', error && error.message ? error.message : error)
    return json(response, { error: 'Artwork upload failed. Please try again.' }, 500)
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
