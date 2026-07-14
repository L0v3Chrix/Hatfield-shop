import crypto from "node:crypto";
import http from "node:http";
import { URL, fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const SHOP = process.env.SHOPIFY_SHOP || "zm1evm-rd.myshopify.com";
const CLIENT_ID = process.env.SHOPIFY_APP_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_APP_CLIENT_SECRET;
const PORT = Number(process.env.SHOPIFY_OAUTH_PORT || 3456);
const REDIRECT_PATH = "/shopify/callback";
const REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI || `http://localhost:${PORT}${REDIRECT_PATH}`;
const SCOPES =
  process.env.SHOPIFY_ADMIN_SCOPES ||
  "read_products,write_products,read_files,write_files";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing SHOPIFY_APP_CLIENT_ID or SHOPIFY_APP_CLIENT_SECRET.");
  console.error("Run with both env vars set. Do not commit secrets to the repo.");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");
const authUrl = new URL(`https://${SHOP}/admin/oauth/authorize`);
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("state", state);

function verifyHmac(searchParams) {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = crypto.createHmac("sha256", CLIENT_SECRET).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
}

async function exchangeCode(code) {
  const response = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(json, null, 2));
  }
  return json;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

    if (requestUrl.pathname !== REDIRECT_PATH) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    if (requestUrl.searchParams.get("state") !== state) {
      throw new Error("OAuth state mismatch. Restart the script and try again.");
    }

    if (!verifyHmac(requestUrl.searchParams)) {
      throw new Error("OAuth HMAC verification failed.");
    }

    const code = requestUrl.searchParams.get("code");
    if (!code) {
      throw new Error("OAuth callback did not include a code.");
    }

    const token = await exchangeCode(code);
    // Never print the full token to stdout/logs. Write it to a 0600 .env.local
    // and show only a masked preview so it can't be shoulder-surfed or captured
    // in terminal scrollback / CI logs.
    const tok = String(token.access_token || "");
    const masked = tok.length > 8 ? `${tok.slice(0, 4)}…${tok.slice(-4)}` : "(short)";
    const outPath = fileURLToPath(new URL("../../.env.local", import.meta.url));
    writeFileSync(outPath, `SHOPIFY_ADMIN_ACCESS_TOKEN=${tok}\n`, { mode: 0o600, flag: "a" });
    console.log(`\nAdmin API access token captured: ${masked} (${tok.length} chars)`);
    console.log(`Written to ${outPath} (mode 0600) — do not commit this file.`);
    console.log("\nGranted scopes:");
    console.log(token.scope);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Shopify Admin token captured</h1><p>You can return to Codex.</p>");
    server.close();
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(error.message);
  }
});

server.listen(PORT, () => {
  console.log(`Listening at ${REDIRECT_URI}`);
  console.log("\nAdd this exact Redirect URL in the Shopify app version if it is not already there:");
  console.log(REDIRECT_URI);
  console.log("\nOpen this authorization URL in the same browser where Shopify admin is logged in:");
  console.log(authUrl.toString());
});
