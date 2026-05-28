#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

if (!storefrontToken) {
  throw new Error('Missing SHOPIFY_STOREFRONT_PUBLIC_TOKEN (or SHOPIFY_STOREFRONT_ACCESS_TOKEN) for deploy-time config injection.')
}

rmSync(PUBLIC_DIR, { recursive: true, force: true })
mkdirSync(PUBLIC_DIR, { recursive: true })
cpSync(SOURCE_DIR, PUBLIC_DIR, { recursive: true })

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
config.site = {
  ...config.site,
  url_production: process.env.SITE_URL_PRODUCTION || 'https://www.hatfieldmccoydtf.com',
}
config.shopify = {
  ...config.shopify,
  storefront_access_token: storefrontToken,
}

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')

console.log(`Prepared ${PUBLIC_DIR}`)
console.log(`Injected deploy config into ${CONFIG_PATH}`)
