const BASE_URL = 'https://dtfvirginia.com'

const ENDPOINTS = {
  products: `${BASE_URL}/products.json?limit=250`,
  collections: `${BASE_URL}/collections.json?limit=250`,
  robots: `${BASE_URL}/robots.txt`,
  sitemap: `${BASE_URL}/sitemap.xml`,
}

export async function scrapeDtfVirginia({ fetcher = fetch, scrapedAt = new Date().toISOString(), includeCollectionProducts = false } = {}) {
  const [productsPayload, collectionsPayload, robotsTxt, sitemapXml] = await Promise.all([
    fetchJson(fetcher, ENDPOINTS.products),
    fetchJson(fetcher, ENDPOINTS.collections),
    fetchText(fetcher, ENDPOINTS.robots),
    fetchText(fetcher, ENDPOINTS.sitemap),
  ])

  const childSitemapUrls = parseSitemapXml(sitemapXml)
  const childSitemaps = await fetchChildSitemaps(fetcher, childSitemapUrls)
  const collections = collectionsPayload.collections ?? []

  let collectionProducts = {}
  if (includeCollectionProducts) {
    collectionProducts = await fetchCollectionProducts(fetcher, collections)
  }

  return {
    scrapedAt,
    source: {
      domain: 'dtfvirginia.com',
      endpoints: ENDPOINTS,
    },
    robotsTxt,
    products: productsPayload.products ?? [],
    collections,
    collectionProducts,
    sitemaps: classifySitemapUrls(childSitemaps),
  }
}

export function parseSitemapXml(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => decodeXml(match[1].trim()))
}

async function fetchChildSitemaps(fetcher, childSitemapUrls) {
  const entries = []
  for (const url of childSitemapUrls) {
    const urls = parseSitemapXml(await fetchText(fetcher, url))
    entries.push({ sitemapUrl: url, urls })
  }
  return entries
}

function classifySitemapUrls(childSitemaps) {
  const classified = {
    products: [],
    pages: [],
    collections: [],
    blogs: [],
    other: [],
    childSitemaps,
  }

  for (const child of childSitemaps) {
    for (const url of child.urls) {
      if (url.includes('/products/')) classified.products.push(url)
      else if (url.includes('/pages/')) classified.pages.push(url)
      else if (url.includes('/collections/')) classified.collections.push(url)
      else if (url.includes('/blogs/')) classified.blogs.push(url)
      else classified.other.push(url)
    }
  }

  return classified
}

async function fetchCollectionProducts(fetcher, collections) {
  const result = {}
  for (const collection of collections) {
    const url = `${BASE_URL}/collections/${collection.handle}/products.json?limit=250`
    try {
      const payload = await fetchJson(fetcher, url)
      result[collection.handle] = (payload.products ?? []).map((product) => product.handle)
    } catch (error) {
      result[collection.handle] = { error: error.message }
    }
  }
  return result
}

async function fetchJson(fetcher, url) {
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}`)
  return response.json()
}

async function fetchText(fetcher, url) {
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}`)
  return response.text()
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
