# Shopify Backend Access Needed

Generated: 2026-05-27

## Current Status

The project now has working Shopify Storefront API access and a valid Shopify access token that authenticates against the Admin endpoint.

However, the current token does **not** have Admin catalog scopes. Shopify rejects product reads with:

`Access denied for productByHandle field. Required access: read_products access scope.`

That means backend catalog import, verification, media upload, product updates, collection assignment, metafield sync, and Kixxl product verification are still blocked until the custom app permissions are updated and the token is rotated or reissued.

## Required Admin API Scopes

Minimum required for the draft catalog workflow:

- `read_products`
- `write_products`
- `read_publications`
- `write_publications`

Recommended for the full production implementation:

- `read_products`
- `write_products`
- `read_publications`
- `write_publications`
- `read_inventory`
- `write_inventory`
- `read_files`
- `write_files`
- `read_metaobjects`
- `write_metaobjects`
- `read_content`
- `write_content`
- `read_themes`

Theme access may be needed for Kixxl/Gangify app block verification and final builder flow checks. If product media is handled entirely through Product media mutations, `write_products` may be enough for media, but `write_files` is useful for broader Shopify file/media workflows.

## Safe Next Step

In Shopify Admin, update the custom/headless app permissions to include the Admin API scopes above, save, reinstall or rotate the Admin token, then update local `.env`:

```bash
SHOPIFY_ADMIN_ACCESS_TOKEN=<new-admin-token>
```

After that, rerun:

```bash
npm run competitor:dtfva:import:dry
npm run catalog:verify
npm run kixxl:verify
```

Only after dry-run and verification pass should the draft import be executed:

```bash
npm run competitor:dtfva:import
```

## Still Preserved

- Public Storefront API access works.
- The static production build now uses the updated public Storefront token.
- The site remains noindex and review-gated.
- No products were published.
- No Shopify mutations were executed during this access check.
