#!/usr/bin/env node
// End-to-end live verification. Runs in two modes:
//   - `--pre-deploy`  (default): checks Shopify admin state + local prototype state
//   - `--post-deploy`: checks deployed futrbusiness.com + Shopify public URL
//
// Exit 0 = all green, exit 1 = any check failed. Prints a Markdown-ish table.
//
// Checks run:
//   [A] Shopify Admin API auth probes
//   [B] custom-gang-sheet product exists, ACTIVE, published to Online Store
//   [C] HMDTF-INTERNAL discount code exists, 100% off, ACTIVE
//   [D] Public URL https://<shop>/products/custom-gang-sheet returns 200 (not 302→/password)
//       → indicates storefront password is OFF
//   [E] Public URL body contains Kixxl signals (scripts, app block)
//       → indicates Kixxl theme block is placed on the product template
//   [F] Deployed futrbusiness.com/data/config.json has redirect_url set to the shop URL
//       (--post-deploy only)
//   [G] Deployed content.js contains the click delegate + multi-file upload markers
//       (--post-deploy only)

import 'dotenv/config'
import { createClient } from './lib/shopify-client.js'

const DEFAULT_HANDLE = 'custom-gang-sheet'
const DEFAULT_DISCOUNT_CODE = 'HMDTF-INTERNAL'
const DEFAULT_PUBLIC_SITE = 'https://hatfield-mccoy-dtf.futrbusiness.com'

function parseFlags(argv) {
  const f = {
    mode: 'pre-deploy',
    handle: DEFAULT_HANDLE,
    code: DEFAULT_DISCOUNT_CODE,
    publicSite: DEFAULT_PUBLIC_SITE,
    verbose: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--pre-deploy') f.mode = 'pre-deploy'
    else if (a === '--post-deploy') f.mode = 'post-deploy'
    else if (a === '--handle') f.handle = argv[++i]
    else if (a === '--code') f.code = argv[++i]
    else if (a === '--public-site') f.publicSite = argv[++i]
    else if (a === '--verbose' || a === '-v') f.verbose = true
    else if (a === '--help' || a === '-h') {
      console.log(`
Usage:
  node verify-kixxl-live.js [--pre-deploy|--post-deploy] [flags]

Flags:
  --handle <h>        Shopify product handle (default: ${DEFAULT_HANDLE})
  --code <code>       Discount code to verify (default: ${DEFAULT_DISCOUNT_CODE})
  --public-site <url> Deployed futrbusiness URL (default: ${DEFAULT_PUBLIC_SITE})
  --verbose, -v       Raw HTTP / GQL logs
`)
      process.exit(0)
    } else { console.error('Unknown flag: ' + a); process.exit(2) }
  }
  return f
}

const checks = []
function record(name, ok, detail) { checks.push({ name, ok, detail }); return ok }

async function safeFetchText(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    return { ok: true, status: res.status, finalUrl: res.url, text: await res.text() }
  } catch (err) { return { ok: false, error: err.message } }
}
async function safeFetchHead(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' })
    return { ok: true, status: res.status, location: res.headers.get('location') }
  } catch (err) { return { ok: false, error: err.message } }
}

async function main() {
  const flags = parseFlags(process.argv)
  const errors = []

  // [A] Shopify Admin auth
  let client, shop
  try {
    client = await createClient({
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
      clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
      clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
      accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      verbose: flags.verbose,
    })
    shop = await client.probe()
    record('[A] Shopify Admin auth', true, `${shop.myshopifyDomain} — plan ${shop.plan?.displayName}`)
  } catch (err) {
    record('[A] Shopify Admin auth', false, err.message)
    errors.push(err.message)
    return printReport(flags, errors, shop)
  }

  const primaryHost = shop.primaryDomain?.url
    ? new URL(shop.primaryDomain.url).host
    : shop.myshopifyDomain
  const publicProductUrl = `https://${primaryHost}/products/${flags.handle}`

  // [B] custom-gang-sheet product state
  try {
    const data = await client.gql(
      `query ($h: String!) {
        productByHandle(handle: $h) {
          id handle title status
          resourcePublicationsV2(first: 10) { edges { node { publication { name } isPublished } } }
        }
      }`,
      { h: flags.handle }
    )
    const p = data.productByHandle
    if (!p) {
      record('[B] Product exists', false, `handle "${flags.handle}" not found`)
      errors.push('product missing')
    } else {
      const pubs = p.resourcePublicationsV2.edges.filter((e) => e.node.isPublished).map((e) => e.node.publication.name)
      const isActive = p.status === 'ACTIVE'
      const pubOnline = pubs.includes('Online Store')
      record('[B.1] Product status ACTIVE', isActive, `status=${p.status}`)
      record('[B.2] Published to Online Store', pubOnline, `publications=[${pubs.join(', ')}]`)
      if (!isActive || !pubOnline) errors.push('product not publicly reachable')
    }
  } catch (err) {
    record('[B] Product query', false, err.message); errors.push(err.message)
  }

  // [C] HMDTF-INTERNAL discount
  try {
    const data = await client.gql(
      `query ($q: String!) {
        codeDiscountNodes(first: 5, query: $q) {
          edges { node {
            id
            codeDiscount { __typename ... on DiscountCodeBasic {
              title status codes(first: 1) { nodes { code } }
              customerGets { value { __typename ... on DiscountPercentage { percentage } } }
            } }
          } }
        }
      }`,
      { q: `code:${flags.code}` }
    )
    const found = data.codeDiscountNodes.edges.find((e) => (e.node.codeDiscount?.codes?.nodes || []).some((c) => c.code === flags.code))
    if (!found) {
      record('[C] Discount code exists', false, `${flags.code} not found`); errors.push('discount missing')
    } else {
      const d = found.node.codeDiscount
      const pct = d.customerGets?.value?.percentage
      const isActive = d.status === 'ACTIVE'
      const is100 = Number(pct) === 1
      record('[C.1] Discount ACTIVE', isActive, `status=${d.status}`)
      record('[C.2] Discount is 100% off', is100, `percentage=${pct}`)
      if (!isActive || !is100) errors.push('discount misconfigured')
    }
  } catch (err) {
    record('[C] Discount query', false, err.message); errors.push(err.message)
  }

  // [D] Public URL reachable (password off)
  const head = await safeFetchHead(publicProductUrl)
  if (!head.ok) {
    record('[D] Public product URL reachable', false, head.error); errors.push('HEAD failed')
  } else if (head.status === 302 && head.location && head.location.includes('/password')) {
    record('[D] Public product URL reachable', false, `302 → ${head.location} (storefront password still ON)`)
    errors.push('storefront password still on')
  } else if (head.status >= 400) {
    record('[D] Public product URL reachable', false, `HEAD status ${head.status}`); errors.push('HEAD error')
  } else {
    record('[D] Public product URL reachable', true, `HEAD ${head.status}${head.location ? ' → ' + head.location : ''}`)
  }

  // [E] Kixxl markup on the product page (GET with follow — only meaningful if password is off)
  const page = await safeFetchText(publicProductUrl)
  if (!page.ok) {
    record('[E] Kixxl markup on product page', false, page.error)
  } else if (page.finalUrl && page.finalUrl.includes('/password')) {
    record('[E] Kixxl markup on product page', false, `redirected to password page; cannot inspect builder until disabled`)
  } else {
    const body = page.text
    const signals = {
      kixxl_scripts: (body.match(/kixxl/gi) || []).length,
      gang_sheet_words: (body.match(/gang[-\s]?sheet/gi) || []).length,
      create_upload_cta: /create.*(?:gang|sheet)|upload.*(?:gang|sheet)|start.*(?:design|building)/i.test(body),
      shopify_product_markup: /product-section|shopify-section/.test(body),
    }
    const kixxlOn = signals.kixxl_scripts >= 1 || signals.create_upload_cta
    record(
      '[E] Kixxl markup on product page',
      kixxlOn,
      `kixxl-keyword-hits=${signals.kixxl_scripts}, gang-sheet-words=${signals.gang_sheet_words}, create-upload-cta=${signals.create_upload_cta}, shopify-markup=${signals.shopify_product_markup}`
    )
    if (!kixxlOn) errors.push('no Kixxl signals in product page — theme app block may not be placed')
  }

  // Post-deploy extras
  if (flags.mode === 'post-deploy') {
    // [F] Deployed config.json redirect_url matches
    const configUrl = flags.publicSite.replace(/\/$/, '') + '/data/config.json'
    const cfg = await safeFetchText(configUrl)
    if (!cfg.ok) { record('[F] Deployed config.json fetch', false, cfg.error); errors.push('config.json fetch') }
    else {
      try {
        const json = JSON.parse(cfg.text)
        const ru = json.kicksy?.redirect_url
        const match = ru === publicProductUrl
        record('[F] Deployed config.redirect_url matches', match, `kicksy.redirect_url="${ru}"`)
        if (!match) errors.push('config redirect_url mismatch')
      } catch (err) {
        record('[F] Deployed config.json parse', false, err.message); errors.push('config parse')
      }
    }

    // [G] Deployed content.js has the patches
    const jsUrl = flags.publicSite.replace(/\/$/, '') + '/assets/js/content.js'
    const js = await safeFetchText(jsUrl)
    if (!js.ok) { record('[G] Deployed content.js fetch', false, js.error); errors.push('content.js fetch') }
    else {
      const markers = [
        { k: 'installBuilderClickDelegate', label: 'click delegate' },
        { k: 'data-sku-suffix', label: 'glitter compound SKU' },
        { k: 'Artwork files', label: 'multi-file Discord payload' },
        { k: 'builder-launch-btn', label: 'launch button class' },
      ]
      const missing = markers.filter((m) => !js.text.includes(m.k))
      const allIn = missing.length === 0
      record('[G] Deployed content.js has patches', allIn, allIn ? 'all 4 markers present' : 'missing: ' + missing.map((m) => m.label).join(', '))
      if (!allIn) errors.push('content.js missing markers: ' + missing.map((m) => m.k).join(', '))
    }
  }

  return printReport(flags, errors, shop, publicProductUrl)
}

function printReport(flags, errors, shop, publicProductUrl) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Kixxl Live Verification — ' + flags.mode.toUpperCase())
  if (shop) console.log('  Shop: ' + (shop.name || '?') + ' (' + shop.myshopifyDomain + ')')
  if (publicProductUrl) console.log('  Target URL: ' + publicProductUrl)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n)
  console.log(pad('  Check', 42) + ' | ' + pad('Status', 8) + ' | Detail')
  console.log('  ' + '-'.repeat(40) + ' | -------- | -----------------')
  for (const c of checks) {
    console.log(pad('  ' + c.name, 42) + ' | ' + pad(c.ok ? '✓ OK' : '✗ FAIL', 8) + ' | ' + (c.detail || ''))
  }

  console.log('')
  const passed = checks.filter((c) => c.ok).length
  const total = checks.length
  console.log(`  Passed: ${passed}/${total}`)
  if (errors.length === 0) {
    console.log('  → all green ✓')
    process.exit(0)
  } else {
    console.log('\n  ACTION NEEDED:')
    for (const e of [...new Set(errors)]) {
      console.log('    - ' + mapErrorToGuidance(e))
    }
    process.exit(1)
  }
}

function mapErrorToGuidance(err) {
  if (err === 'product not publicly reachable') return 'Product must be ACTIVE + published to Online Store. Run: npm run kixxl:publish'
  if (err === 'storefront password still on') return 'Disable Shopify storefront password (Admin → Online Store → Preferences → uncheck "Restrict access")'
  if (err === 'no Kixxl signals in product page — theme app block may not be placed') return 'In Kixxl admin → Configure Product → Add Button → drop the Kixxl app block on the custom-gang-sheet product template in the theme editor, save'
  if (err === 'discount missing') return 'Run: npm run kixxl:discount'
  if (err === 'discount misconfigured') return 'Open the discount in Shopify admin and verify it is ACTIVE + 100% off'
  if (err === 'config redirect_url mismatch') return 'Deploy the prototype: cd deliverables/prototype && vercel --prod'
  if (err === 'content.js fetch' || err === 'config.json fetch') return 'Confirm the futrbusiness.com site is deployed and reachable'
  if (err.startsWith('content.js missing markers')) return 'Deploy the latest prototype build: cd deliverables/prototype && vercel --prod'
  return err
}

main().catch((err) => {
  console.error('✗ Fatal error:')
  console.error(err.stack ?? err.message)
  process.exit(1)
})
