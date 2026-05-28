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
