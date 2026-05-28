const ALLOWED_ORIGINS = new Set([
  'https://www.hatfieldmccoydtf.com',
  'https://hatfieldmccoydtf.com',
  'https://hatfield-mccoy-dtf.vercel.app',
  'https://hatfield-mccoy-dtf.futrbusiness.com',
  'https://production-site-flax.vercel.app'
]);

const MAX_BODY_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 8000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateStore = new Map();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function rateLimit(ip) {
  const now = Date.now();
  const bucket = rateStore.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  rateStore.set(ip, bucket);
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX,
    retryAfterSec: Math.max(1, Math.ceil((bucket.reset - now) / 1000)),
  };
}

function setCorsHeaders(res, origin) {
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

async function readJsonBody(req) {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    const err = new Error('Content-Type must be application/json');
    err.statusCode = 400;
    throw err;
  }
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const err = new Error('Request body too large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const err = new Error('Invalid JSON body');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Missing body';
  const hasContent = typeof payload.content === 'string' && payload.content.length > 0;
  const hasEmbeds = Array.isArray(payload.embeds) && payload.embeds.length > 0;
  if (!hasContent && !hasEmbeds) return 'Body must contain content or embeds';
  if (payload.content && payload.content.length > 2000) return 'content exceeds 2000 chars';
  if (payload.embeds && payload.embeds.length > 10) return 'embeds exceeds 10';
  return null;
}

async function forwardToDiscord(url, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const isAllowedOrigin = ALLOWED_ORIGINS.has(origin);
  const isSameSite = !origin;
  if (!isAllowedOrigin && !isSameSite) {
    res.status(403).json({ ok: false, error: 'Origin not allowed' });
    return;
  }

  const limit = rateLimit(getClientIp(req));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    res.status(429).json({ ok: false, error: 'Too many requests', retry_after_seconds: limit.retryAfterSec });
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    res.status(500).json({ ok: false, error: 'Server misconfigured' });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    res.status(error.statusCode || 400).json({ ok: false, error: error.message });
    return;
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    res.status(400).json({ ok: false, error: validationError });
    return;
  }

  try {
    const discordResp = await forwardToDiscord(webhookUrl, payload);
    if (!discordResp.ok) {
      const snippet = await discordResp.text().then((text) => text.slice(0, 200)).catch(() => '');
      console.error('[intake] Discord returned', discordResp.status, snippet);
      res.status(502).json({ ok: false, error: 'Upstream webhook failed', upstream_status: discordResp.status });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    const isAbort = error.name === 'AbortError';
    console.error('[intake]', isAbort ? 'upstream timeout' : 'upstream error', error.message);
    res.status(502).json({ ok: false, error: isAbort ? 'Upstream timeout' : 'Upstream error' });
  }
}
