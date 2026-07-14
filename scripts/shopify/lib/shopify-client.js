// Thin Shopify Admin GraphQL client — native fetch, exponential backoff on throttle.
// Supports two auth modes:
//   1. Static access token (shpat_... from admin-created Custom App)
//   2. client_credentials grant (clientId + clientSecret from Dev Dashboard app)
//      → exchanges on first use for a 24h admin API token

const DEFAULT_API_VERSION = '2026-07'

export class ShopifyError extends Error {
  constructor(message, { errors, userErrors, status } = {}) {
    super(message)
    this.name = 'ShopifyError'
    this.errors = errors
    this.userErrors = userErrors
    this.status = status
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exchange client_id + client_secret for a short-lived admin API access token.
 * Used for Dev Dashboard apps (token prefix varies; see Shopify docs).
 * Endpoint: POST https://{shop}/admin/oauth/access_token
 * Content-Type: application/x-www-form-urlencoded
 * Body: grant_type=client_credentials&client_id=...&client_secret=...
 * Response: { access_token, scope, expires_in (86399 = 24h) }
 */
export async function exchangeClientCredentials({ shopDomain, clientId, clientSecret, verbose = false } = {}) {
  if (!shopDomain) throw new Error('shopDomain is required')
  if (!clientId) throw new Error('clientId is required')
  if (!clientSecret) throw new Error('clientSecret is required')

  const normalizedDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const url = `https://${normalizedDomain}/admin/oauth/access_token`

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  if (verbose) console.error(`[shopify] exchanging client credentials → ${url}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })

  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new ShopifyError(`Token exchange returned non-JSON (${res.status}): ${text.slice(0, 300)}`, { status: res.status })
  }

  if (!res.ok || json.error) {
    const hint = interpretTokenExchangeError(json, res.status)
    throw new ShopifyError(
      `Token exchange failed (${res.status}): ${json.error || 'unknown'} — ${json.error_description || ''}${hint ? `\n  Hint: ${hint}` : ''}`,
      { status: res.status, errors: [json] }
    )
  }

  if (!json.access_token) {
    throw new ShopifyError(`Token exchange succeeded but no access_token in response: ${text.slice(0, 300)}`, { status: res.status })
  }

  if (verbose) {
    const ttl = json.expires_in ? `${Math.round(json.expires_in / 3600)}h` : '?'
    const tokenPreview = `${json.access_token.slice(0, 8)}…${json.access_token.slice(-4)}`
    const scopes = (json.scope || '').split(',').filter(Boolean)
    console.error(`[shopify] token acquired: ${tokenPreview} (ttl=${ttl}, scopes=${scopes.length})`)
  }

  return {
    accessToken: json.access_token,
    scope: json.scope,
    expiresIn: json.expires_in,
  }
}

function interpretTokenExchangeError(json, status) {
  const err = json.error || ''
  const desc = json.error_description || ''
  if (err === 'application_cannot_be_found' || /application.*not.*found/i.test(desc)) {
    return 'The app may not be installed on this store. Install it via the Dev Dashboard first, or verify the shop domain matches where the app was installed.'
  }
  if (err === 'invalid_client' || status === 401) {
    return 'client_id or client_secret is incorrect. Double-check the Dev Dashboard app credentials.'
  }
  if (err === 'invalid_scope' || /scope/i.test(desc)) {
    return 'Configure Admin API scopes on the Dev Dashboard app (write_products, read_products, write_publications, read_publications).'
  }
  if (err === 'unauthorized_client') {
    return 'This app is not authorized for client_credentials grant. Check app distribution settings in the Dev Dashboard.'
  }
  return null
}

export async function createClient({ shopDomain, accessToken, clientId, clientSecret, apiVersion = DEFAULT_API_VERSION, verbose = false } = {}) {
  if (!shopDomain) throw new Error('shopDomain is required (e.g. your-store.myshopify.com)')

  let resolvedToken = accessToken
  let tokenMeta = null

  if (!resolvedToken) {
    if (!clientId || !clientSecret) {
      throw new Error(
        'Either accessToken (shpat_...) OR both clientId + clientSecret must be provided. ' +
        'For Dev Dashboard apps, use clientId + clientSecret to exchange for a token via client_credentials grant.'
      )
    }
    const exchanged = await exchangeClientCredentials({ shopDomain, clientId, clientSecret, verbose })
    resolvedToken = exchanged.accessToken
    tokenMeta = { scope: exchanged.scope, expiresIn: exchanged.expiresIn, source: 'client_credentials' }
  } else {
    tokenMeta = { source: 'static' }
  }

  const normalizedDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const endpoint = `https://${normalizedDomain}/admin/api/${apiVersion}/graphql.json`

  async function gql(query, variables = {}, { maxRetries = 5 } = {}) {
    let attempt = 0
    let lastErr

    while (attempt <= maxRetries) {
      attempt++
      let res
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': resolvedToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        })
      } catch (err) {
        lastErr = err
        if (attempt > maxRetries) break
        const delay = Math.min(2000 * attempt, 10000)
        if (verbose) console.error(`[shopify] network error (attempt ${attempt}): ${err.message} — retrying in ${delay}ms`)
        await sleep(delay)
        continue
      }

      // 401/403 → don't retry; bad auth
      if (res.status === 401 || res.status === 403) {
        const body = await safeReadText(res)
        const hint = tokenMeta?.source === 'client_credentials'
          ? 'Token acquired via client_credentials grant but rejected by Admin API. Likely missing scopes — configure write_products/read_products on the Dev Dashboard app, then reinstall.'
          : 'Check SHOPIFY_ADMIN_ACCESS_TOKEN and app scopes.'
        throw new ShopifyError(`Auth rejected (${res.status}). ${hint}`, {
          status: res.status,
          errors: [{ message: body }],
        })
      }

      // 5xx → transient, retry
      if (res.status >= 500 && attempt <= maxRetries) {
        const delay = Math.min(1500 * attempt, 8000)
        if (verbose) console.error(`[shopify] ${res.status} from upstream (attempt ${attempt}) — retrying in ${delay}ms`)
        await sleep(delay)
        continue
      }

      const text = await safeReadText(res)
      let json
      try {
        json = JSON.parse(text)
      } catch {
        throw new ShopifyError(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`, { status: res.status })
      }

      // Throttled — back off using suggested rate if present, else exponential
      if (json.errors && isThrottled(json.errors)) {
        const cost = json.extensions?.cost
        const wait = computeThrottleWait(cost, attempt)
        if (verbose) console.error(`[shopify] throttled (attempt ${attempt}) — waiting ${wait}ms`)
        if (attempt > maxRetries) {
          throw new ShopifyError('Throttled: exceeded retry budget', { errors: json.errors })
        }
        await sleep(wait)
        continue
      }

      if (json.errors && json.errors.length) {
        throw new ShopifyError(`GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`, {
          errors: json.errors,
          status: res.status,
        })
      }

      if (verbose) {
        const cost = json.extensions?.cost
        const costStr = cost ? ` cost=${cost.actualQueryCost}/${cost.requestedQueryCost}` : ''
        console.error(`[shopify] OK status=${res.status}${costStr}`)
      }

      return json.data
    }

    throw lastErr ?? new ShopifyError('Exceeded retry budget with no response')
  }

  // Convenience: run a mutation and surface its userErrors as throws
  async function mutate(mutationName, query, variables, { maxRetries } = {}) {
    const data = await gql(query, variables, { maxRetries })
    const payload = data?.[mutationName]
    if (!payload) {
      throw new ShopifyError(`Mutation ${mutationName} returned no payload`, { userErrors: [] })
    }
    const userErrors = payload.userErrors ?? []
    if (userErrors.length) {
      throw new ShopifyError(
        `${mutationName} userErrors: ${userErrors.map((e) => `${e.field?.join('.') ?? '(root)'} — ${e.message}`).join('; ')}`,
        { userErrors }
      )
    }
    return payload
  }

  async function probe() {
    const data = await gql(`{ shop { name myshopifyDomain primaryDomain { url } plan { displayName } } }`)
    return data.shop
  }

  return { gql, mutate, probe, endpoint, shopDomain: normalizedDomain, apiVersion, tokenMeta }
}

function isThrottled(errors) {
  return errors.some((e) => {
    const code = e.extensions?.code
    return code === 'THROTTLED' || /throttle/i.test(e.message ?? '')
  })
}

function computeThrottleWait(cost, attempt) {
  if (cost?.throttleStatus?.restoreRate && cost?.throttleStatus?.currentlyAvailable != null) {
    const needed = Math.max(1000 - cost.throttleStatus.currentlyAvailable, 100)
    const ms = Math.ceil((needed / cost.throttleStatus.restoreRate) * 1000)
    return Math.min(ms, 15000)
  }
  return Math.min(1000 * 2 ** attempt, 15000)
}

async function safeReadText(res) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}
