const SHOPIFY_ASSET_BASE = '/assets/shopify-images'
const PRODUCT_GRAPHIC_BASE = '/assets/images/product-graphics'

const IMAGE_FAMILIES = {
  blankHats: family('blank-hats', 'Blank hats ready for custom transfers'),
  blankItems: family('blank-items', 'Blank apparel and merchandise assortment'),
  blankItemsAlt: family('blank-items-alt', 'Blank items prepared for custom print production'),
  blankSweatshirt: family('blank-sweatshirt', 'Blank sweatshirt ready for custom transfer printing'),
  boyStickerSheet: family('boy-sticker-sheet', 'Youth themed custom sticker sheet'),
  carGangSheet: family('car-gang-sheet', 'DTF gang sheet layout with vehicle graphics'),
  cuteStickerSheet: family('cute-sticker-sheet', 'Colorful custom sticker sheet'),
  customDtfTransfers: family('custom-dtf-transfers', 'Neon Hatfield McCoy DTF transfer print sample'),
  customPatches: family('custom-patches', 'Custom patch samples for apparel and merchandise'),
  dtfProcess: family('dtf-process', 'DTF printing process close-up'),
  featuredMerchScene: family('featured-merch-scene', 'Hatfield McCoy DTF featured merchandise scene'),
  hatTransfer: family('hat-transfer', 'Custom transfer applied to a blank hat'),
  hatfieldTags: family('hatfield-tags', 'Hatfield McCoy branded tags'),
  mermaidPatch: family('mermaid-patch', 'Decorative custom patch sample'),
  neonBasketball: family('neon-basketball', 'Neon basketball transfer design sample'),
  neonHoodieTransfer: family('neon-hoodie-transfer', 'Neon DTF transfer on a hoodie'),
  neonItems: family('neon-items', 'Neon custom merchandise samples'),
  neonWvPrint: family('neon-wv-print', 'West Virginia themed neon DTF print'),
  puffShirt: family('puff-shirt', 'Raised puff transfer on apparel'),
  puffShirt2: family('puff-shirt2', 'Raised puff transfer detail on shirt'),
  qualityTags: family('quality-tags', 'Print quality and product tag detail'),
  stickerRolls: family('sticker-rolls', 'Custom sticker rolls for branded packaging'),
  vibrantTransferStack: family('vibrant-transfer-stack', 'Stack of vibrant custom DTF transfers'),
  windowFront: family('window-front', 'Custom storefront window and signage graphic'),
  womanHoodieNeon: family('woman-hoodie-neon', 'Neon hoodie lifestyle print sample'),
  apparelSamplesStack: graphicFamily('apparel-samples-stack', 'Stack of apparel samples ready for custom decoration'),
  appalachianRidgeFilm: graphicFamily('appalachian-ridge-film', 'West Virginia ridge artwork printed on DTF film'),
  blankShirtTransfer: graphicFamily('blank-shirt-transfer', 'Blank shirt with custom transfer placement'),
  builderCanvasLayout: graphicFamily('builder-canvas-layout', 'Gang sheet builder canvas with arranged artwork'),
  dtfTransferPeel: graphicFamily('dtf-transfer-peel', 'DTF transfer peel and application detail'),
  gangSheetRoll: graphicFamily('gang-sheet-roll', 'Wide gang sheet roll with repeated artwork'),
  glitterFilmSheet: graphicFamily('glitter-film-sheet', 'Glitter transfer film sheet'),
  glowFilmSheet: graphicFamily('glow-film-sheet', 'Glow specialty transfer film sheet'),
  heatPressShirt: graphicFamily('heat-press-shirt', 'Heat press applying a transfer to a shirt'),
  pressedShirtFront: graphicFamily('pressed-shirt-front', 'Finished shirt front with transfer applied'),
  printerOutputFilm: graphicFamily('printer-output-film', 'Printer output film in a production workflow'),
  serviceSampleBundle: graphicFamily('service-sample-bundle', 'Artwork service and custom sample print bundle'),
  shippingPouchTransfers: graphicFamily('shipping-pouch-transfers', 'Packaged transfers ready for shipping'),
  sublimationTumbler: graphicFamily('sublimation-tumbler', 'Sublimation tumbler product sample'),
  uvStickerPack: graphicFamily('uv-dtf-sticker-pack', 'UV DTF sticker pack sample'),
  wideFormatRoll: graphicFamily('wide-format-roll', 'Wide format print roll for signs and transfers'),
}

// Hand-curated per-product card images. Entries here take precedence over
// PRODUCT_RULES for the card slot only; hero stays rule-resolved.
export const HANDLE_IMAGE_OVERRIDES = {
  'dtfva-42-custom-sublimation-gang-sheets-builder': { src: `${SHOPIFY_ASSET_BASE}/42-gang-sheet-builder.png`, alt: '42 inch gang sheet builder sample' },
  'dtfva-custom-dtf-gang-sheets-dtf-virginia': { src: `${SHOPIFY_ASSET_BASE}/46-gang-sheet.png`, alt: '46 inch gang sheet sample' },
  'dtfva-america-s-250th-anniversary-patch-1-inch-circle': { src: `${SHOPIFY_ASSET_BASE}/250th-anniversary.jpg`, alt: 'America\'s 250th anniversary patch sample' },
  'dtfva-brand-growth-pack': { src: `${SHOPIFY_ASSET_BASE}/guru-pack.jpg`, alt: 'GURU branding kit growth pack sample' },
  'dtfva-brand-business-pack': { src: `${SHOPIFY_ASSET_BASE}/items-stickerd.jpg`, alt: 'Merch branding kit business pack sample' },
  'dtfva-custom-sublimation-transfers-by-size': { src: `${SHOPIFY_ASSET_BASE}/custom-sublimation-transfers-by-size.png`, alt: 'Custom sublimation transfers by size sample' },
  'dtfva-custom-glitter-dtf-transfer-by-size': { src: `${SHOPIFY_ASSET_BASE}/custom-glitter-dtf-transfer-by-size.png`, alt: 'Custom glitter DTF transfer by size sample' },
  'dtfva-custom-fluorescent-dtf-transfers-by-size': { src: `${SHOPIFY_ASSET_BASE}/custom-flouresent-dtf-transfers-by-size.png`, alt: 'Custom fluorescent DTF transfers by size sample' },
  'dtfva-custom-dtf-gang-sheets-printing-service': { src: `${SHOPIFY_ASSET_BASE}/custome-22-gang-sheet-builder.png`, alt: 'Custom 22 inch gang sheet builder sample' },
  'dtfva-glitter-dtf-transfers-builder': { src: `${SHOPIFY_ASSET_BASE}/22-glitter-dtf-transfer-builder.png`, alt: '22 inch glitter DTF transfer builder sample' },
  'dtfva-next-level-3600': { src: `${SHOPIFY_ASSET_BASE}/next-level-3600-cotton-crew-t-shirt.png`, alt: 'Next Level 3600 cotton crew t-shirt sample' },
  'dtfva-gildan-64000': { src: `${SHOPIFY_ASSET_BASE}/gildan-64000-unisex-softstyle-t-shirt.png`, alt: 'Gildan 64000 unisex softstyle t-shirt sample' },
  'dtfva-bella-canvas-3001': { src: `${SHOPIFY_ASSET_BASE}/bella-canvas-3001-unisex-jersey-tee.png`, alt: 'BELLA + CANVAS 3001 unisex jersey tee sample' },
  'dtfva-custom-shaka-wear-drop-shoulder-cropped-t-shirt-premium-blank': { src: `${SHOPIFY_ASSET_BASE}/custom-shaka-wear-drop-shoulder-cropped-t-shirt-premium-blank.png`, alt: 'Custom Shaka Wear drop shoulder cropped t-shirt sample' },
  'dtfva-custom-shaka-wear-max-heavyweight-short-sleeve-t-shirt-premium-blank': { src: `${SHOPIFY_ASSET_BASE}/custom-shaka-wear-max-heavyweight-short-sleeve-t-shirt-premium-blank.png`, alt: 'Custom Shaka Wear Max heavyweight short sleeve t-shirt sample' },
  'dtfva-custom-american-apparel-unisex-heavyweight-cotton-long-sleeve-t-shirt': { src: `${SHOPIFY_ASSET_BASE}/custom-american-apparel-unisex-heavyweight-cotton-long-sleeve-t-shirt.png`, alt: 'Custom American Apparel heavyweight cotton long sleeve t-shirt sample' },
  'dtfva-custom-los-angeles-apparel-1865gd-garment-dye-sleeveless-tee': { src: `${SHOPIFY_ASSET_BASE}/custom-los-angeles-apparel-1865gd-garment-dye-sleeveless-tee.png`, alt: 'Custom Los Angeles Apparel 1865GD garment dye sleeveless tee sample' },
  'dtfva-custom-dtf-gang-sheets-30-inches': { src: `${SHOPIFY_ASSET_BASE}/dtf-gang-sheets-30.png`, alt: 'DTF gang sheets 30 inch sample' },
  'dtfva-window-clings': { src: `${SHOPIFY_ASSET_BASE}/window-front.jpg`, alt: 'Window cling storefront sample' },
  'dtfva-perforated-window-vinyl': { src: `${SHOPIFY_ASSET_BASE}/perforated-window-vinyl-window-perf-graphics.png`, alt: 'Perforated window vinyl sample' },
  'dtfva-3d-puff-transfers': { src: `${SHOPIFY_ASSET_BASE}/puff-shirt2.png`, alt: '3D puff transfer shirt sample' },
  'dtfva-custom-dtf-transfers-by-size-virginia': { src: `${SHOPIFY_ASSET_BASE}/custom-dtf-transfers-by-size.png`, alt: 'Custom DTF transfers by size sample' },
  'dtfva-sublimation-gang-sheets-bulk-printing': { src: `${SHOPIFY_ASSET_BASE}/42-and-22-sublimation-gangsheet.png`, alt: '42 and 22 inch sublimation gang sheet sample' },
  'dtfva-custom-sublimation-gang-sheets': { src: `${SHOPIFY_ASSET_BASE}/42-and-22-sublimation-gangsheet.png`, alt: '42 and 22 inch sublimation gang sheet sample' },
  'dtfva-fluorescent-dtf-printing-bold-bright-stunning': { src: `${SHOPIFY_ASSET_BASE}/fluorescent-dtf-printing-bold-bright-stunning.png`, alt: 'Fluorescent DTF printing bold bright and stunning sample' },
  'dtfva-digital-factory-dtf-desktop-edition': { src: `${SHOPIFY_ASSET_BASE}/digital-factory-12.png`, alt: 'Digital Factory 12 Direct to Film Edition icon' },
  'dtfva-add-driver-port-24-wide-or-larger': { src: `${SHOPIFY_ASSET_BASE}/add-driver-port-24-wide-or-larger.png`, alt: 'Add driver port 24 inch wide or larger sample' },
  'dtfva-cadlink-digital-factory-10-for-wide-format-dtf-activation-code': { src: `${SHOPIFY_ASSET_BASE}/cadlink-digital-factory-direct-to-film-dtf-for-wide-format.png`, alt: 'CADlink Digital Factory DTF wide format sample' },
  'dtfva-cadlink-digitalfactory-10-for-dtf-w-activation-code': { src: `${SHOPIFY_ASSET_BASE}/add-driver-port-23-wide-or-smaller.png`, alt: 'Add driver port 23 inch wide or smaller sample' },
  'dtfva-cadlink-digital-factory-10-dtf-printing-15-days-trial-desktop-wide-format': { src: `${SHOPIFY_ASSET_BASE}/cadlink-digital-factory-v12-dtf-printing-15-days-trial-desktop-wide-format.png`, alt: 'Cadlink Digital Factory v12 DTF printing trial sample' },
}

const PRODUCT_RULES = [
  [/\b(software|cadlink|rip|driver|port|trial)\b|digital factory/, IMAGE_FAMILIES.printerOutputFilm, 'Software and RIP support'],
  [/vector|artwork|branding kit|brand starter|brand growth|brand business|logo/, IMAGE_FAMILIES.serviceSampleBundle, 'Artwork and brand services'],
  [/woven label|label|tag/, IMAGE_FAMILIES.qualityTags, 'Labels and tags'],
  [/leather.*hat patch|hat patch|hat\b/, IMAGE_FAMILIES.hatTransfer, 'Hat transfers and patches'],
  [/patch|tpu/, IMAGE_FAMILIES.customPatches, 'Patches'],
  [/puff|3d/, IMAGE_FAMILIES.puffShirt, '3D puff transfers'],
  [/fluorescent|neon/, IMAGE_FAMILIES.glowFilmSheet, 'Fluorescent and neon transfers'],
  [/glitter|gold glitter|foil|spangle|silver/, IMAGE_FAMILIES.glitterFilmSheet, 'Specialty finish transfers'],
  [/uv|sticker|decal|dye-cut|dye cut/, IMAGE_FAMILIES.cuteStickerSheet, 'UV DTF and stickers'],
  [/sublimation|\bdye\b|tumbler/, IMAGE_FAMILIES.sublimationTumbler, 'Sublimation transfers'],
  [/window|floor|banner|poster|magnet|vinyl|cling|graphics|perf|sign/, IMAGE_FAMILIES.wideFormatRoll, 'Signage and magnets'],
  [/softball|baseball|hockey|puck|pickleball|sports/, IMAGE_FAMILIES.neonBasketball, 'Sports products'],
  [/tumbler|coin|personalized|promo/, IMAGE_FAMILIES.featuredMerchScene, 'Promotional products'],
  [/hoodie|sweatshirt|fleece|crewneck/, IMAGE_FAMILIES.blankSweatshirt, 'Blank sweatshirts and fleece'],
  [/\b(shirt|tee|t-shirt|apparel|bella|canvas|gildan)\b|next level|american apparel|los angeles apparel|shaka wear/, IMAGE_FAMILIES.apparelSamplesStack, 'Apparel blanks'],
  [/gang|sheet|builder/, IMAGE_FAMILIES.gangSheetRoll, 'Gang sheets'],
  [/transfer|dtf|heat/, IMAGE_FAMILIES.dtfTransferPeel, 'DTF transfers'],
]

const COLLECTION_RULES = [
  [/cadlink|software|rip/, IMAGE_FAMILIES.printerOutputFilm],
  [/artwork|vector|branding/, IMAGE_FAMILIES.serviceSampleBundle],
  [/label|tag/, IMAGE_FAMILIES.qualityTags],
  [/sports|balls|pucks/, IMAGE_FAMILIES.neonBasketball],
  [/patch/, IMAGE_FAMILIES.customPatches],
  [/sticker|decal|uv/, IMAGE_FAMILIES.cuteStickerSheet],
  [/window|floor|banner|magnet|vinyl|cling|graphics|poster/, IMAGE_FAMILIES.wideFormatRoll],
  [/t-shirt|shirt|apparel/, IMAGE_FAMILIES.apparelSamplesStack],
  [/puff|3d/, IMAGE_FAMILIES.puffShirt2],
  [/fluorescent|neon|ultravibe|chromablast/, IMAGE_FAMILIES.glowFilmSheet],
  [/sublimation|dye/, IMAGE_FAMILIES.sublimationTumbler],
  [/glitter|foil|spangle|gold|silver|specialty/, IMAGE_FAMILIES.glitterFilmSheet],
  [/gang|builder/, IMAGE_FAMILIES.builderCanvasLayout],
  [/transfer|dtf|heat/, IMAGE_FAMILIES.dtfTransferPeel],
  [/personalized|coin|promo|featured|best|all/, IMAGE_FAMILIES.featuredMerchScene],
]

export function getAssetMapImages({ product = null, collection = null } = {}) {
  const productImages = resolveProductImages(product)
  const collectionImages = resolveCollectionImages(collection)
  return {
    productCard: productImages.card,
    productHero: productImages.hero,
    collectionCard: collectionImages.card,
    collectionHero: collectionImages.hero,
  }
}

export function resolveProductImages(product = {}) {
  const family = resolveFamily(product, PRODUCT_RULES, IMAGE_FAMILIES.customDtfTransfers)
  const override = HANDLE_IMAGE_OVERRIDES[product?.handle ?? '']
  if (override) return { family: family.slug, card: override, hero: family.hero }
  return { family: family.slug, card: family.card, hero: family.hero }
}

export function resolveCollectionImages(collection = {}) {
  const family = resolveFamily(collection, COLLECTION_RULES, IMAGE_FAMILIES.featuredMerchScene)
  return { family: family.slug, card: family.card, hero: family.hero }
}

export function classifyProductVisualFamily(product = {}) {
  const text = searchableText(product)
  const rule = PRODUCT_RULES.find(([pattern]) => pattern.test(text))
  return rule ? rule[2] : 'DTF transfers'
}

function resolveFamily(item, rules, fallback) {
  const text = searchableText(item)
  const rule = rules.find(([pattern]) => pattern.test(text))
  return rule ? rule[1] : fallback
}

function searchableText(item = {}) {
  const productType = /kixxl|hidden|competitor parity|mws_fee_generated/i.test(item.productType ?? '') ? '' : item.productType
  return `${item.handle ?? ''} ${item.title ?? ''} ${productType ?? ''}`.toLowerCase()
}

function family(slug, alt) {
  return {
    slug,
    card: image(SHOPIFY_ASSET_BASE, slug, 'card', alt),
    hero: image(SHOPIFY_ASSET_BASE, slug, 'hero', alt),
  }
}

function graphicFamily(slug, alt) {
  const src = `${PRODUCT_GRAPHIC_BASE}/${slug}.webp`
  return {
    slug,
    card: { src, alt },
    hero: { src, alt },
  }
}

function image(base, slug, size, alt) {
  return {
    src: `${base}/${slug}-${size}.webp`,
    alt,
  }
}
