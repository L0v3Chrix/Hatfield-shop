(function (global) {
  function normalizeKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&quot;/g, '"')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function itemKeyText(item) {
    return normalizeKey([
      item && item.handle,
      item && item.sku,
      item && item.name,
      item && item.variant,
    ].filter(Boolean).join(' '))
  }

  function isBuilderKey(key) {
    return /builder|gang-sheet|sheet-builder|3d-puff/.test(key)
  }

  function attributeValue(item, key) {
    const attributes = Array.isArray(item && item.attributes) ? item.attributes : []
    const match = attributes.find((entry) => String(entry && entry.key || '').toLowerCase() === String(key).toLowerCase())
    return match && match.value ? String(match.value) : ''
  }

  function itemNeedsArtwork(item) {
    if (classifyCartItem(item) !== 'checkout-ready') return false
    return !(item && (item.requiresArtwork === false || item.requiresArtwork === 'false'))
  }

  function itemHasArtwork(item) {
    return Boolean(
      item && (
        item.artworkUrl
        || attributeValue(item, 'Artwork upload URL')
        || attributeValue(item, 'Artwork file URL')
      )
    )
  }

  function classifyCartItem(item) {
    if (!item) return 'review-required'
    if (item.merchandiseId || item.storefront_variant_id) return 'checkout-ready'
    const key = itemKeyText(item)
    if (isBuilderKey(key)) return 'builder-required'
    return 'review-required'
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`
  }

  function summarizeCart(items) {
    const safeItems = Array.isArray(items) ? items : []
    let subtotal = 0
    let totalQuantity = 0
    let checkoutReadyQuantity = 0
    let checkoutReadyLineCount = 0
    let builderLineCount = 0
    let reviewLineCount = 0
    let artworkPendingLineCount = 0

    for (const item of safeItems) {
      const qty = Math.max(0, Math.floor(Number(item && item.qty) || 0))
      subtotal += (Number(item && item.price) || 0) * qty
      totalQuantity += qty
      const state = classifyCartItem(item)
      if (state === 'checkout-ready') {
        checkoutReadyQuantity += qty
        checkoutReadyLineCount += 1
        if (itemNeedsArtwork(item) && !itemHasArtwork(item)) artworkPendingLineCount += 1
      } else if (state === 'builder-required') {
        builderLineCount += 1
      } else {
        reviewLineCount += 1
      }
    }

    const checkoutBlocked = builderLineCount > 0 || reviewLineCount > 0 || artworkPendingLineCount > 0
    const messageParts = []
    if (checkoutReadyQuantity > 0) {
      messageParts.push(`${pluralize(checkoutReadyQuantity, 'item is', 'items are')} ready for checkout`)
    }
    if (artworkPendingLineCount > 0) {
      messageParts.push(`${pluralize(artworkPendingLineCount, 'line still needs', 'lines still need')} artwork uploaded`)
    }
    if (builderLineCount > 0) {
      messageParts.push(`${pluralize(builderLineCount, 'builder item needs', 'builder items need')} a saved design`)
    }
    if (reviewLineCount > 0) {
      messageParts.push(`${pluralize(reviewLineCount, 'line is unavailable', 'lines are unavailable')} for online checkout`)
    }
    if (!messageParts.length) {
      messageParts.push('Your cart is empty.')
    } else if (!checkoutBlocked) {
      messageParts.push('Ready for secure Shopify checkout.')
    }

    return {
      subtotal,
      totalQuantity,
      checkoutReadyQuantity,
      checkoutReadyLineCount,
      artworkPendingLineCount,
      builderLineCount,
      reviewLineCount,
      checkoutBlocked,
      statusMessage: `${messageParts.join('. ')}${messageParts.length ? '.' : ''}`,
    }
  }

  global.HMCartHelpers = {
    attributeValue,
    classifyCartItem,
    itemHasArtwork,
    itemNeedsArtwork,
    summarizeCart,
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
