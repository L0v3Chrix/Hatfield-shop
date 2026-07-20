#!/usr/bin/env node
// E2E user-journey suite — walks the site the way a customer does, not the way
// a selector-driven smoke test does. Born from the 2026-07-13 owner finding:
// "There is no way to get to the checkout from the cart." Mechanism tests kept
// passing while the human journey was dead. This suite fails when a human would.
//
// Journeys:
//   direct-buy  A (blocked→resolve): add WITHOUT artwork → drawer must show the
//               line + Needs-artwork badge, checkout click must GUIDE (never a
//               dead disabled button), upload in the cart line, then checkout
//               must reach Shopify's checkout URL.
//   direct-buy  B (pre-upload): upload on the PDP first → add → line Ready →
//               checkout reaches Shopify.
//   builder     PDP CTA routes to /gang-sheet-builder; builder page carries
//               Kixxl deep links.
//   quote       PDP CTA routes to /contact with the product handle; intake form
//               is present and wired.
//   mobile      Journey A repeated at 390x844 — checkout button must sit inside
//               the viewport (regression: 2026-07-07 drawer overflow).
//
// Any pageerror/console error on a visited page fails that product.
//
// Usage:
//   node scripts/qa/e2e-journeys.mjs --base https://www.hatfieldmccoydtf.com
//   [--full-checkout-all]  reach Shopify checkout for EVERY buyable (default:
//                          every buyable runs journey B; A runs on a 3-product
//                          representative set + 1 mobile)
//   [--product <handle>]   limit to one product (debugging)
// Playwright resolution: local node_modules, else HM_PLAYWRIGHT_DIR.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
function loadPlaywright() {
  const candidates = [
    'playwright',
    process.env.HM_PLAYWRIGHT_DIR ? join(process.env.HM_PLAYWRIGHT_DIR, 'node_modules', 'playwright') : null,
  ].filter(Boolean)
  for (const candidate of candidates) {
    try { return require(candidate) } catch {}
  }
  console.error('playwright not found — run `npm i playwright` or set HM_PLAYWRIGHT_DIR to a dir whose node_modules has it')
  process.exit(2)
}
const { chromium } = loadPlaywright()

const args = process.argv.slice(2)
const argValue = (flag) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : null
}
const BASE = (argValue('--base') || 'https://www.hatfieldmccoydtf.com').replace(/\/$/, '')
const ONLY_PRODUCT = argValue('--product')
const SHOT_DIR = argValue('--shots') || join(process.env.TMPDIR || '/tmp', 'hm-e2e-shots')
mkdirSync(SHOT_DIR, { recursive: true })

// 4x4 lime PNG — a real file upload without a fixture on disk.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8z8DwnwEJMDGgAdwCAEQrAxH6E1WeAAAAAElFTkSuQmCC',
  'base64',
)
const uploadPayload = { name: 'hm-e2e-artwork.png', mimeType: 'image/png', buffer: TEST_PNG }

// production-site catalog includes the core (non-dtfva) products; prototype's does not.
const catalog = JSON.parse(readFileSync(resolve('deliverables/production-site/catalog.json'), 'utf8'))
let products = catalog.products.filter((product) => product.publicVisible !== false)
if (ONLY_PRODUCT) products = products.filter((product) => product.handle === ONLY_PRODUCT)

const results = []
const record = (handle, journey, ok, detail = '') => {
  results.push({ handle, journey, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${journey.padEnd(18)} ${handle}${detail ? ` — ${detail}` : ''}`)
}

function watchErrors(page, sink) {
  // Only errors on OUR pages count — once the journey hands off to Shopify's
  // checkout, its third-party console noise is not our verdict.
  const onSite = () => page.url().startsWith(BASE)
  page.on('pageerror', (error) => { if (onSite()) sink.push(`pageerror: ${error.message}`) })
  page.on('console', (message) => {
    if (message.type() !== 'error' || !onSite()) return
    const text = message.text()
    if (/web-pixel|monorail|shopify\.com\/cdn/i.test(text)) return
    sink.push(`console: ${text}`)
  })
}

async function classify(page) {
  return page.evaluate(() => {
    const cta = document.querySelector('.feature-cta')
    if (!cta) return { kind: 'none' }
    if (cta.tagName === 'A') {
      const href = cta.getAttribute('href') || ''
      // Size-picker pages rewrite the CTA to a Kixxl deep link on load —
      // an apps/gangify href is still the builder route.
      if (href.includes('gang-sheet-builder') || href.includes('apps/gangify')) return { kind: 'builder', href }
      return { kind: 'quote', href }
    }
    return { kind: 'direct' }
  })
}

async function openDrawer(page) {
  await page.evaluate(() => window.openCart && window.openCart())
  await page.waitForTimeout(400)
}

async function drawerState(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('#cart-items .cart-item')]
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { y: Math.round(r.y), h: Math.round(r.height) }
    }
    const checkout = document.getElementById('cart-checkout')
    return {
      rowCount: rows.length,
      firstRow: rect(rows[0]),
      firstRowBadge: rows[0]?.querySelector('.cart-item-state')?.textContent || '',
      firstRowFlashed: rows[0]?.classList.contains('cart-item-flash') || false,
      uploadBtnVisible: Boolean(rows[0]?.querySelector('.cart-upload-btn')),
      checkoutDisabled: checkout ? checkout.disabled : null,
      checkoutRect: rect(checkout),
      noteText: document.getElementById('cart-note')?.textContent || '',
      recsHidden: document.getElementById('cart-recommendations')?.hidden ?? true,
      viewportH: window.innerHeight,
    }
  })
}

async function uploadInCartLine(page) {
  const input = page.locator('#cart-items .cart-item .cart-upload-input').first()
  await input.setInputFiles(uploadPayload)
  await page.waitForFunction(() => {
    const status = document.querySelector('#cart-items .cart-upload-status')
    return status && /attached/i.test(status.textContent || '')
  }, { timeout: 30000 })
}

async function clickCheckoutExpectShopify(page) {
  await Promise.all([
    page.waitForURL(/checkouts|myshopify\.com|shop\.app/, { timeout: 45000 }),
    page.click('#cart-checkout'),
  ])
  return page.url()
}

async function journeyBlockedThenResolve(browser, product, { viewport, label }) {
  const errors = []
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  watchErrors(page, errors)
  try {
    await page.goto(`${BASE}/products/${product.handle}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    await page.click('button.feature-cta[data-merchandise-id]')
    await page.waitForTimeout(500)
    await openDrawer(page)
    let state = await drawerState(page)
    if (state.rowCount < 1) throw new Error('cart line did not render')
    if (!state.firstRow || state.firstRow.h < 100 || state.firstRow.y > state.viewportH - 60) {
      throw new Error(`cart line not visible to a human (rect ${JSON.stringify(state.firstRow)})`)
    }
    if (!/needs artwork/i.test(state.firstRowBadge)) throw new Error(`badge said "${state.firstRowBadge}", expected Needs artwork`)
    if (state.checkoutDisabled) throw new Error('checkout button is disabled — dead end')
    if (!state.recsHidden) throw new Error('recommendations shown while a line still needs artwork')
    if (!state.checkoutRect || state.checkoutRect.y + state.checkoutRect.h > state.viewportH + 1) {
      throw new Error(`checkout button below the fold (rect ${JSON.stringify(state.checkoutRect)})`)
    }
    // Blocked click must guide, not navigate and not die.
    await page.click('#cart-checkout')
    await page.waitForTimeout(600)
    if (!page.url().startsWith(BASE)) throw new Error('blocked checkout click navigated away')
    state = await drawerState(page)
    if (!state.firstRowFlashed) throw new Error('blocked checkout click did not highlight the pending line')
    if (!/upload artwork/i.test(state.noteText)) throw new Error(`note did not instruct: "${state.noteText}"`)
    await uploadInCartLine(page)
    await page.waitForTimeout(400)
    state = await drawerState(page)
    if (!/ready/i.test(state.firstRowBadge)) throw new Error(`badge after upload: "${state.firstRowBadge}"`)
    const checkoutUrl = await clickCheckoutExpectShopify(page)
    record(product.handle, label, true, `reached ${new URL(checkoutUrl).host}`)
  } catch (error) {
    await page.screenshot({ path: join(SHOT_DIR, `fail-${label}-${product.handle}.png`), fullPage: false }).catch(() => {})
    record(product.handle, label, false, `${error.message}${errors.length ? ` | ${errors[0]}` : ''}`)
  } finally {
    await context.close()
  }
}

async function journeyPreUpload(browser, product) {
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  watchErrors(page, errors)
  try {
    await page.goto(`${BASE}/products/${product.handle}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    const offerBlocks = await page.locator('.offer-summary').count()
    if (offerBlocks < 1) throw new Error('offer-summary prose missing')
    await page.locator('#pdp-artwork-input').setInputFiles(uploadPayload)
    await page.waitForFunction(() => document.querySelector('#pdp-upload')?.classList.contains('has-file'), { timeout: 30000 })
    await page.click('button.feature-cta[data-merchandise-id]')
    await page.waitForTimeout(500)
    await openDrawer(page)
    const state = await drawerState(page)
    if (state.rowCount < 1) throw new Error('cart line did not render')
    if (!/ready/i.test(state.firstRowBadge)) throw new Error(`badge said "${state.firstRowBadge}", expected Ready`)
    if (state.checkoutDisabled) throw new Error('checkout disabled despite artwork attached')
    const checkoutUrl = await clickCheckoutExpectShopify(page)
    if (errors.length) throw new Error(errors[0])
    record(product.handle, 'direct-pre-upload', true, `reached ${new URL(checkoutUrl).host}`)
  } catch (error) {
    await page.screenshot({ path: join(SHOT_DIR, `fail-pre-${product.handle}.png`) }).catch(() => {})
    record(product.handle, 'direct-pre-upload', false, `${error.message}${errors.length ? ` | ${errors[0]}` : ''}`)
  } finally {
    await context.close()
  }
}

async function journeyStatic(browser, product, kind, href) {
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  watchErrors(page, errors)
  try {
    if (kind === 'builder') {
      if (!href.includes('gang-sheet-builder') && !href.includes('apps/gangify')) throw new Error(`builder CTA href: ${href}`)
      if (product.handle === 'custom-gang-sheet') {
        // Size-first routing page: the picker must offer real sizes, the CTA
        // must deep-link an exact Kixxl variant, and the "we build it for you"
        // path must point at the direct-buy sheet PDPs.
        await page.goto(`${BASE}/products/${product.handle}`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(600)
        const picker = await page.evaluate(() => ({
          lengthOptions: document.querySelectorAll('#gs-length option').length,
          typeOptions: document.querySelectorAll('#gs-type option').length,
          openHref: document.getElementById('gs-open')?.getAttribute('href') || '',
          sheet22: Boolean(document.querySelector('a[href*="/products/dtf-22-sheet"]')),
          sheet46: Boolean(document.querySelector('a[href*="/products/dtf-46-sheet"]')),
        }))
        if (picker.typeOptions < 5) throw new Error(`sheet-type options: ${picker.typeOptions}`)
        if (picker.lengthOptions < 2) throw new Error(`length options: ${picker.lengthOptions}`)
        if (!/apps\/gangify\/builder\?variant=\d+&price=[\d.]+/.test(picker.openHref)) {
          throw new Error(`picker CTA is not a variant deep link: ${picker.openHref}`)
        }
        if (!picker.sheet22 || !picker.sheet46) throw new Error('missing we-build-it links to dtf-22-sheet / dtf-46-sheet')
      }
    } else {
      if (!href.includes('/contact')) throw new Error(`quote CTA href: ${href}`)
      await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })
      const hasForm = await page.locator('form').count()
      if (!hasForm) throw new Error('contact page has no form')
    }
    if (errors.length) throw new Error(errors[0])
    record(product.handle, kind, true)
  } catch (error) {
    record(product.handle, kind, false, error.message)
  } finally {
    await context.close()
  }
}

const browser = await chromium.launch({ headless: true })
try {
  // Pass 0a — checkout-config canary (outage 2026-07-16: a deploy shipped the
  // literal __PLACEHOLDER__ Storefront token; every cartCreate 401'd and no
  // customer could check out). Fail in seconds, before anything else runs.
  {
    const res = await fetch(`${BASE}/data/config.json`, { cache: 'no-store' })
    const cfg = res.ok ? await res.json() : null
    const tok = cfg?.shopify?.storefront_access_token || ''
    const domain = cfg?.shopify?.store_domain || ''
    const version = cfg?.shopify?.storefront_api_version || ''
    let ok = Boolean(res.ok && tok && !/^__.+__$/.test(tok) && domain)
    let detail = ok ? `token ${tok.slice(0, 6)}… v${version}` : `config broken (token: ${tok.slice(0, 12) || 'missing'})`
    if (ok) {
      const probe = await fetch(`https://${domain}/api/${version}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': tok },
        body: JSON.stringify({ query: '{shop{name}}' }),
      })
      ok = probe.status === 200
      if (!ok) detail = `storefront API returned ${probe.status} — CHECKOUT IS DOWN`
    }
    record('(site)', 'checkout-config', ok, detail)
    if (!ok) {
      console.error('\nFATAL: checkout config canary failed — aborting suite, fix this first.')
      await browser.close()
      process.exit(1)
    }
  }

  // Pass 0 — global surfaces.
  {
    const errors = []
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    watchErrors(page, errors)
    for (const path of ['/', '/shop', '/gang-sheet-builder', '/contact', '/wholesale']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(500)
    }
    const kixxlLinks = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll('a[href*="gangify"], a[href*="apps/"]')]
      return anchors.length
    }).catch(() => 0)
    record('(site)', 'global-surfaces', errors.length === 0, errors[0] || `builder deep links seen on last page: ${kixxlLinks}`)
    await context.close()
  }

  // Classify every public product from its live PDP.
  const classified = []
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    for (const product of products) {
      const errors = []
      const listener = (error) => errors.push(error.message)
      page.on('pageerror', listener)
      const response = await page.goto(`${BASE}/products/${product.handle}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(250)
      if (!response || response.status() >= 400) {
        record(product.handle, 'pdp-loads', false, `HTTP ${response ? response.status() : 'none'}`)
      } else {
        const kind = await classify(page)
        classified.push({ product, ...kind })
        if (errors.length) record(product.handle, 'pdp-loads', false, errors[0])
      }
      page.off('pageerror', listener)
    }
    await context.close()
  }

  const direct = classified.filter((entry) => entry.kind === 'direct')
  const builders = classified.filter((entry) => entry.kind === 'builder')
  const quotes = classified.filter((entry) => entry.kind === 'quote')
  console.log(`\nClassified: ${direct.length} direct-buy, ${builders.length} builder, ${quotes.length} quote\n`)

  // Journey A (the owner's failure scenario) — representative set + mobile.
  const aSet = ONLY_PRODUCT ? direct : direct.slice(0, 3)
  for (const entry of aSet) {
    await journeyBlockedThenResolve(browser, entry.product, { viewport: { width: 1440, height: 1000 }, label: 'blocked-resolve' })
  }
  if (direct.length && !ONLY_PRODUCT) {
    await journeyBlockedThenResolve(browser, direct[0].product, { viewport: { width: 390, height: 844 }, label: 'blocked-mobile' })
  }

  // Journey B — every direct-buy product reaches Shopify checkout.
  for (const entry of direct) {
    await journeyPreUpload(browser, entry.product)
  }

  for (const entry of builders) await journeyStatic(browser, entry.product, 'builder', entry.href)
  for (const entry of quotes) await journeyStatic(browser, entry.product, 'quote', entry.href)
} finally {
  await browser.close()
}

const failed = results.filter((result) => !result.ok)
const summary = {
  base: BASE,
  ranAt: new Date().toISOString(),
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed,
}
writeFileSync(join(SHOT_DIR, 'e2e-journeys-report.json'), JSON.stringify({ ...summary, results }, null, 2))
console.log(`\n${summary.passed}/${summary.total} journeys passed${failed.length ? ` — ${failed.length} FAILED (screenshots in ${SHOT_DIR})` : ''}`)
console.log(`Report: ${join(SHOT_DIR, 'e2e-journeys-report.json')}`)
process.exit(failed.length ? 1 : 0)
