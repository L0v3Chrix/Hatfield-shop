// Structured reporting — builds a timestamped JSON + markdown report and prints a console summary.

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORTS_DIR = join(__dirname, '..', 'reports')

export function createReport({ shop, apiVersion, dryRun, updateMode, productsOnly, collectionsOnly, startedAt }) {
  const record = {
    meta: {
      generated_at: new Date().toISOString(),
      started_at: startedAt,
      shop,
      api_version: apiVersion,
      mode: {
        dry_run: !!dryRun,
        update: !!updateMode,
        products_only: !!productsOnly,
        collections_only: !!collectionsOnly,
      },
    },
    summary: { created: 0, updated: 0, skipped: 0, errors: 0 },
    products: [],
    collections: [],
    keystone_products: [],
    pricing_anomalies: [],
    conflicts: [],
    errors: [],
  }

  function addProductResult(result, sourceProduct) {
    if (result.error) record.summary.errors++
    else if (result.action === 'created') record.summary.created++
    else if (result.action === 'updated') record.summary.updated++
    else record.summary.skipped++

    record.products.push({
      handle: sourceProduct.handle,
      title: sourceProduct.title,
      action: result.action,
      productId: result.productId ?? null,
      variantCount: sourceProduct.variants.length,
      variantIds: result.variantIds ?? [],
      reason: result.reason ?? null,
      diff: result.diff ?? null,
      dryRun: !!result.dryRun,
      error: result.error ?? null,
    })

    if (sourceProduct.keystone) {
      record.keystone_products.push({
        handle: sourceProduct.handle,
        title: sourceProduct.title,
        productId: result.productId ?? null,
        note: 'Required for Kixxl gang sheet builder mapping',
      })
    }

    for (const v of sourceProduct.variants) {
      if (v.flags?.includes('likely_pricing_typo')) {
        record.pricing_anomalies.push({
          handle: sourceProduct.handle,
          sku: v.sku,
          price: v.price,
          flag: 'likely_pricing_typo',
          note: 'Flagged per prompt: confirm with client before publishing',
        })
      }
      if (v.flags?.includes('placeholder_price_pending_kixxl_decision')) {
        record.pricing_anomalies.push({
          handle: sourceProduct.handle,
          sku: v.sku,
          price: v.price,
          flag: 'placeholder_price',
          note: 'Set per prompt: confirm pricing model with Kixxl workflow before publishing',
        })
      }
    }

    if (result.diff?.extras?.length) {
      record.conflicts.push({
        handle: sourceProduct.handle,
        type: 'extra_existing_variants',
        extras: result.diff.extras,
        note: 'SKUs present on the live product but not in our catalog config — left untouched',
      })
    }
  }

  function addCollectionResult(result, sourceCollection) {
    record.collections.push({
      handle: sourceCollection.handle,
      title: sourceCollection.title,
      action: result.action ?? 'member-sync',
      collectionId: result.collectionId ?? null,
      addedCount: result.addedCount ?? 0,
      addedHandles: result.addedHandles ?? [],
      alreadyMember: result.alreadyMember ?? [],
      dryRun: !!result.dryRun,
      error: result.error ?? null,
    })
    if (result.error) record.summary.errors++
  }

  function addError(scope, err) {
    record.errors.push({
      scope,
      message: err.message,
      userErrors: err.userErrors ?? null,
      errors: err.errors ?? null,
    })
    record.summary.errors++
  }

  function finalize({ outputDir = REPORTS_DIR } = {}) {
    record.meta.finished_at = new Date().toISOString()
    mkdirSync(outputDir, { recursive: true })
    const stamp = record.meta.generated_at.replace(/[:.]/g, '-')
    const base = dryRun ? `${stamp}-DRY-RUN` : stamp
    const jsonPath = join(outputDir, `${base}.json`)
    const mdPath = join(outputDir, `${base}.md`)

    writeFileSync(jsonPath, JSON.stringify(record, null, 2))
    writeFileSync(mdPath, renderMarkdown(record))

    return { jsonPath, mdPath, record }
  }

  return { record, addProductResult, addCollectionResult, addError, finalize }
}

function renderMarkdown(r) {
  const lines = []
  const mode = Object.entries(r.meta.mode).filter(([, v]) => v).map(([k]) => k).join(', ') || 'live-full'

  lines.push(`# Shopify Catalog Run — ${r.meta.generated_at}`)
  lines.push('')
  lines.push(`- **Shop:** ${r.meta.shop}`)
  lines.push(`- **API version:** ${r.meta.api_version}`)
  lines.push(`- **Mode:** ${mode}`)
  lines.push(`- **Duration:** ${computeDuration(r.meta.started_at, r.meta.finished_at)}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Created: ${r.summary.created}`)
  lines.push(`- Updated: ${r.summary.updated}`)
  lines.push(`- Skipped: ${r.summary.skipped}`)
  lines.push(`- Errors: ${r.summary.errors}`)
  lines.push('')

  if (r.keystone_products.length) {
    lines.push('## Keystone products (for downstream integrations)')
    lines.push('')
    for (const k of r.keystone_products) {
      lines.push(`- **${k.title}** (\`${k.handle}\`)`)
      lines.push(`  - Product ID: \`${k.productId ?? '(dry-run)'}\``)
      lines.push(`  - Note: ${k.note}`)
    }
    lines.push('')
  }

  lines.push('## Products')
  lines.push('')
  lines.push('| Handle | Title | Action | Variants | Product ID |')
  lines.push('|---|---|---|---|---|')
  for (const p of r.products) {
    const id = p.productId ? `\`${p.productId}\`` : p.dryRun ? '(dry-run)' : '—'
    lines.push(`| \`${p.handle}\` | ${escapePipe(p.title)} | ${p.action}${p.dryRun ? ' (dry-run)' : ''} | ${p.variantCount} | ${id} |`)
  }
  lines.push('')

  for (const p of r.products) {
    if (p.reason || p.diff || p.error) {
      lines.push(`### \`${p.handle}\` detail`)
      lines.push('')
      if (p.reason) lines.push(`- Reason: ${p.reason}`)
      if (p.diff) {
        if (p.diff.toCreate?.length) lines.push(`- To create SKUs: ${p.diff.toCreate.map((s) => `\`${s}\``).join(', ')}`)
        if (p.diff.toUpdate?.length) {
          lines.push('- Price changes:')
          for (const u of p.diff.toUpdate) lines.push(`  - \`${u.sku}\`: ${u.from} → ${u.to}`)
        }
        if (p.diff.extras?.length) lines.push(`- Extra existing SKUs (untouched): ${p.diff.extras.map((s) => `\`${s}\``).join(', ')}`)
      }
      if (p.error) {
        lines.push(`- Error: ${p.error.message}`)
      }
      lines.push('')
    }
  }

  lines.push('## Collections')
  lines.push('')
  lines.push('| Handle | Title | Action | Added | Already Member |')
  lines.push('|---|---|---|---|---|')
  for (const c of r.collections) {
    lines.push(`| \`${c.handle}\` | ${escapePipe(c.title)} | ${c.action}${c.dryRun ? ' (dry-run)' : ''} | ${c.addedCount} | ${c.alreadyMember?.length ?? 0} |`)
  }
  lines.push('')

  if (r.pricing_anomalies.length) {
    lines.push('## Pricing anomalies (manual review required)')
    lines.push('')
    for (const a of r.pricing_anomalies) {
      lines.push(`- \`${a.sku}\` ($${a.price}) — ${a.flag}: ${a.note}`)
    }
    lines.push('')
  }

  if (r.conflicts.length) {
    lines.push('## Conflicts')
    lines.push('')
    for (const c of r.conflicts) {
      lines.push(`- \`${c.handle}\` — ${c.type}: ${(c.extras || []).map((s) => `\`${s}\``).join(', ')}`)
      lines.push(`  - ${c.note}`)
    }
    lines.push('')
  }

  if (r.errors.length) {
    lines.push('## Errors')
    lines.push('')
    for (const e of r.errors) {
      lines.push(`- [${e.scope}] ${e.message}`)
      if (e.userErrors?.length) {
        for (const ue of e.userErrors) lines.push(`  - ${(ue.field || []).join('.') || '(root)'}: ${ue.message}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function escapePipe(s = '') {
  return String(s).replace(/\|/g, '\\|')
}

function computeDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '—'
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
