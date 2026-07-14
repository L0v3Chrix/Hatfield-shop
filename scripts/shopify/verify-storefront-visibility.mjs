#!/usr/bin/env node
// Storefront API visibility + cartCreate verification (B4). Read/ephemeral only:
// the cartCreate test creates an abandoned cart — it never places an order.
// Also scans generated output for misplaced private credentials.
//
// Exit 1 on: an ACTIVE product invisible to the public token, cartCreate failure
// for a normal product, or a private-secret pattern in public output.
// A builder variant being addable at the raw API level is recorded as INFO —
// protection for designless builder orders lives in the headless cart classifier
// and the gang-sheet app's order validation (staging check), not in the API.

import 'dotenv/config'
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const OUT_DIR = join(ROOT, 'output', 'shopify-audit')

const shopDomain = (process.env.SHOPIFY_SHOP_DOMAIN ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')
const token = process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN
if (!shopDomain || !token) {
  console.error('Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_STOREFRONT_PUBLIC_TOKEN — storefront checks blocked.')
  process.exit(1)
}
const endpoint = `https://${shopDomain}/api/2026-07/graphql.json`

async function sf(query, variables = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Shopify-Storefront-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Storefront errors: ${json.errors.map((e) => e.message).join('; ')}`)
  return json.data
}

const failures = []
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

// Intended live handles come from the A1 audit report (ACTIVE set)
const auditPath = join(OUT_DIR, 'state-report.json')
const audit = JSON.parse(readFileSync(auditPath, 'utf8'))
const activeProducts = audit.products.filter((p) => p.status === 'ACTIVE')

// 1. Visibility: every ACTIVE product resolves for the same public token the frontend uses
const visibility = []
for (const p of activeProducts) {
  const data = await sf(
    `query($handle: String!) {
      product(handle: $handle) {
        id title availableForSale
        variants(first: 3) { nodes { id availableForSale price { amount currencyCode } } }
      }
    }`,
    { handle: p.handle }
  )
  const product = data.product
  visibility.push({
    handle: p.handle,
    visible: Boolean(product),
    availableForSale: product?.availableForSale ?? false,
    sampleVariant: product?.variants?.nodes?.[0]?.id ?? null,
  })
}
const invisible = visibility.filter((v) => !v.visible)
check(`all ${activeProducts.length} ACTIVE products visible to the public Storefront token`,
  invisible.length === 0, invisible.map((v) => v.handle).join(', '))

// 2. cartCreate for a NORMAL product (create-and-abandon; no checkout completion)
const normal = visibility.find((v) => v.visible && !/builder/.test(v.handle))
let cartNormal = { ok: false }
if (normal?.sampleVariant) {
  const data = await sf(
    `mutation($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }`,
    { lines: [{ merchandiseId: normal.sampleVariant, quantity: 1 }] }
  )
  const payload = data.cartCreate
  cartNormal = {
    ok: Boolean(payload.cart?.checkoutUrl) && payload.userErrors.length === 0,
    handle: normal.handle,
    checkoutHost: payload.cart?.checkoutUrl ? new URL(payload.cart.checkoutUrl).host : null,
    userErrors: payload.userErrors,
  }
}
check(`cartCreate returns a checkoutUrl for a normal product (${cartNormal.handle ?? 'n/a'})`,
  cartNormal.ok, JSON.stringify(cartNormal.userErrors ?? 'no variant'))

// 3. cartCreate for a BUILDER product — INFO ONLY (documents which layer must protect)
const builder = visibility.find((v) => v.visible && /builder/.test(v.handle))
let cartBuilder = { apiAllows: null }
if (builder?.sampleVariant) {
  const data = await sf(
    `mutation($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { id } userErrors { message }
      }
    }`,
    { lines: [{ merchandiseId: builder.sampleVariant, quantity: 1 }] }
  )
  cartBuilder = {
    apiAllows: Boolean(data.cartCreate.cart?.id) && data.cartCreate.userErrors.length === 0,
    handle: builder.handle,
  }
}
console.log(`ℹ builder variant cartCreate at raw API level: ${cartBuilder.apiAllows ? 'ALLOWED' : 'blocked'} (${cartBuilder.handle ?? 'n/a'}) — designless-order protection must come from the cart classifier + app order validation`)

// 4. Secret-placement scan over generated/public output (text files only)
const SECRET_PATTERNS = [/shpat_[A-Za-z0-9]{8,}/, /client_secret/i, /ADMIN_ACCESS_TOKEN/, /ADMIN_CLIENT_(ID|SECRET)/]
const SCAN_EXT = /\.(html|js|json|css|xml|txt)$/
function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (SCAN_EXT.test(entry)) out.push(full)
  }
  return out
}
const scanRoots = [join(ROOT, 'deliverables', 'production-site'), join(ROOT, 'public')]
const hits = []
for (const root of scanRoots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8')
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) hits.push({ file: file.replace(ROOT, '.'), pattern: String(pattern) })
    }
  }
}
check('no private-credential patterns in production-site/ or public/', hits.length === 0,
  hits.slice(0, 5).map((h) => `${h.file} ~ ${h.pattern}`).join(' | '))

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'storefront-visibility.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  endpointHost: shopDomain,
  visibility,
  cartCreate: { normal: cartNormal, builder: cartBuilder },
  secretScan: { rootsScanned: scanRoots.length, hits },
}, null, 2) + '\n')

console.log(failures.length === 0
  ? `\nSTOREFRONT VERIFY PASS (${visibility.length} products checked)`
  : `\nSTOREFRONT VERIFY FAIL: ${failures.length} check(s) failed`)
process.exit(failures.length === 0 ? 0 : 1)
