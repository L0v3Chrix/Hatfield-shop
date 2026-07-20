#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_DIR = join(ROOT, 'deliverables', 'production-site')
const PUBLIC_DIR = join(ROOT, 'public')
const CONFIG_PATH = join(PUBLIC_DIR, 'data', 'config.json')

const storefrontToken =
  process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  ''

if (!existsSync(SOURCE_DIR)) {
  throw new Error(`Missing built storefront at ${SOURCE_DIR}`)
}

// Defense-in-depth (outage 2026-07-16: a deploy served the literal placeholder
// and killed checkout for every customer): the committed config now carries the
// real public Storefront token, so a build that skips injection still ships a
// working checkout. Env injection below remains the override when present.
if (!storefrontToken || /^__.+__$/.test(storefrontToken)) {
  console.warn('[vercel-build] no SHOPIFY_STOREFRONT_PUBLIC_TOKEN in env — keeping the committed config token.')
}

mkdirSync(PUBLIC_DIR, { recursive: true })
cpSync(SOURCE_DIR, PUBLIC_DIR, { recursive: true, force: true })

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
config.site = {
  ...config.site,
  url_production: process.env.SITE_URL_PRODUCTION || 'https://www.hatfieldmccoydtf.com',
}
config.shopify = {
  ...config.shopify,
  ...(storefrontToken && !/^__.+__$/.test(storefrontToken) ? { storefront_access_token: storefrontToken } : {}),
}

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')

console.log(`Prepared ${PUBLIC_DIR}`)
console.log(`Injected deploy config into ${CONFIG_PATH}`)
