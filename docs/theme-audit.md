# Shopify Online Store Theme + Builder Audit — A2 (2026-06-11)

Read-only audit: Admin API (theme list) + public-page fetches. Zero store changes.

## Themes

| Theme | ID | Role |
|---|---|---|
| Builder Brand Match Test - 2026-05-22 | `gid://shopify/OnlineStoreTheme/149051179190` | **MAIN (published)** |
| Horizon | `gid://shopify/OnlineStoreTheme/147593855158` | UNPUBLISHED |

- Theme asset path on the storefront: `/cdn/shop/t/2/assets/…`
- Theme READ via Admin API works with current client-credentials auth (E1 can list/
  inspect via API; duplicate/write remains to be probed at E1 — gated regardless).
- E1 rule: duplicate the MAIN theme before any edit; never edit the published theme.

## Builder integration — current truth (supersedes the 2026-05-25 blocker report)

- The product page loads TWO app extensions: `gang-sheet-app-458`
  (uuid `019e4c04-b203-7de3-991a-3a4ff175c1ba` — the gang sheet builder app serving
  the `/apps/gangify/` proxy) and `affirm-pay-over-time-messaging`.
- The gangify form/app block renders **client-side** (no `gangify`/`kixxl` markup in
  served HTML) — static greps will always miss it; runtime checks must use a browser.
- **The May-25 "blank params" bug has a deployed fix** in theme asset
  `hm-builder-brand-match-r2.js` (live on MAIN, loaded by the builder PDP):
  - populates `#gangify-product-id` from `ShopifyAnalytics.meta.product`
  - rebuilds `.gangify-variant` hidden inputs (`data-id`, `data-price` in decimal)
  - keeps `#gangify-default-variant` + `#selected-variant` synced on variant/quantity
    change (event capture + MutationObserver + delayed re-syncs)
  - intercepts `#submit-link` / `#upload-link` clicks and navigates to
    `/apps/gangify/builder?variant=…&price=…&store=…&product=…&quantity=…&locale=…`
    (+`upload=true` for the upload path) with all params populated
- The same asset also rewrites any "Hatfield & McCoy / and McCoy" text to
  "Hatfield McCoy DTF" at runtime (brand rule enforcement on the theme).
- Custom brand-match section `hm-builder-masthead` is live on the builder PDP with
  production-quality copy ("Choose your sheet size first, then open the builder…",
  3-step proof grid, Logan WV reference).
- **Verified live:** `/apps/gangify/builder?…` proxy URL returns HTTP 200 with the
  full builder application (134 KB page, gang-sheet canvas content) — the headless
  site's 6 hardcoded launch URLs are functional.
- **Verified live:** DRAFT products 404 on the storefront (`/products/custom-gang-sheet`
  → 404), confirming drafts are customer-unreachable.

## Findings that need follow-up

1. **Normal add-to-cart form exists on the builder PDP**
   (`form action="/cart/add" id="BuyButtons-ProductForm-…"`). A customer could add a
   builder product to the Online Store cart without opening the builder. Whether the
   gang-sheet app blocks designless orders at checkout is unverified —
   **C-milestone staging test**: attempt a designless add-to-cart → checkout on the
   theme preview and confirm the app's order validation intervenes; if it does not,
   hide the native buy buttons on builder templates in the theme duplicate (E2).
2. **Runtime click verification still wanted** (browser): confirm the intercept wins
   over the app's own click handling on phone-width, and capture the launched URL.
   The mechanism is fully present in the deployed JS; this is a confirm-only check.
3. `scripts/shopify/verify-kixxl-live.js` checks `custom-gang-sheet` (now DRAFT) and
   so reports a stale picture — C1 repoints it at the 5 ACTIVE builder products.

## Evidence

- `output/shopify-audit/state-report.json` (A1) — products/publications/webhooks
- Public-page fetches 2026-06-11: builder PDP (200), gangify proxy (200), draft (404)
- Root-level audit screenshots from prior sessions: `audit-production-site-*-390.png`
