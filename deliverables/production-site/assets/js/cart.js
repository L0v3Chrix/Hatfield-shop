/* ============================================================
   Hatfield McCoy DTF — Cart State (localStorage)
   ============================================================
   Contract:
     Cart.add(item)       -> item: {sku, name, variant, price, qty, thumb?, file?, merchandiseId?, attributes?}
     Cart.remove(sku, variant)
     Cart.updateQty(sku, variant, qty)
     Cart.getItems()      -> [item, ...]
     Cart.getTotal()      -> number
     Cart.getCount()      -> number (total qty across items)
     Cart.clear()
   Events (on window):
     'cart:changed'        dispatched on any mutation
   Storage key: hm_cart_v1
   ============================================================ */
(function () {
  const STORAGE_KEY = 'hm_cart_v1';
  const SHOPIFY_CART_STORAGE_KEY = 'hmdtf_shopify_cart_v1';
  const GANGIFY_BUILDER_URL = '/gang-sheet-builder';
  const ARTWORK_MAX_BYTES = 50 * 1024 * 1024;
  const ARTWORK_ACCEPTED_TYPES = /\.(png|jpe?g|pdf|ai|eps)$/i;
  const cartHelpers = window.HMCartHelpers || {
    isBuilderKey(key) {
      return /builder|gang-sheet|sheet-builder|3d-puff/.test(key);
    },
    attributeValue(item, key) {
      const attributes = Array.isArray(item && item.attributes) ? item.attributes : [];
      const match = attributes.find((entry) => String(entry && entry.key || '').toLowerCase() === String(key).toLowerCase());
      return match && match.value ? String(match.value) : '';
    },
    classifyCartItem(item) {
      if (item && (item.merchandiseId || item.storefront_variant_id)) return 'checkout-ready';
      const key = String([item && item.handle, item && item.sku, item && item.name, item && item.variant].filter(Boolean).join(' '))
        .toLowerCase()
        .replace(/&quot;/g, '"')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (cartHelpers.isBuilderKey(key)) return 'builder-required';
      return 'review-required';
    },
    itemNeedsArtwork(item) {
      if (cartHelpers.classifyCartItem(item) !== 'checkout-ready') return false;
      return !(item && (item.requiresArtwork === false || item.requiresArtwork === 'false'));
    },
    itemHasArtwork(item) {
      return Boolean(item && (item.artworkUrl || cartHelpers.attributeValue(item, 'Artwork upload URL') || cartHelpers.attributeValue(item, 'Artwork file URL')));
    },
    summarizeCart(items) {
      const safeItems = Array.isArray(items) ? items : [];
      const summary = {
        subtotal: 0,
        totalQuantity: 0,
        checkoutReadyQuantity: 0,
        checkoutReadyLineCount: 0,
        readyLineCount: 0,
        artworkPendingLineCount: 0,
        builderLineCount: 0,
        reviewLineCount: 0,
        checkoutBlocked: false,
        statusMessage: '',
      };
      safeItems.forEach((item) => {
        const qty = Math.max(0, Math.floor(Number(item && item.qty) || 0));
        summary.subtotal += (Number(item && item.price) || 0) * qty;
        summary.totalQuantity += qty;
        const state = cartHelpers.classifyCartItem(item);
        if (state === 'checkout-ready') {
          summary.checkoutReadyQuantity += qty;
          summary.checkoutReadyLineCount += 1;
          if (cartHelpers.itemNeedsArtwork(item) && !cartHelpers.itemHasArtwork(item)) summary.artworkPendingLineCount += 1;
        } else if (state === 'builder-required') {
          summary.builderLineCount += 1;
        } else {
          summary.reviewLineCount += 1;
        }
      });
      summary.checkoutBlocked = summary.builderLineCount > 0 || summary.reviewLineCount > 0 || summary.artworkPendingLineCount > 0;
      summary.readyLineCount = summary.checkoutReadyLineCount - summary.artworkPendingLineCount;
      const bits = [];
      if (summary.artworkPendingLineCount > 0) bits.push('Upload artwork on ' + summary.artworkPendingLineCount + ' line' + (summary.artworkPendingLineCount === 1 ? '' : 's') + ' below to unlock checkout');
      if (summary.builderLineCount > 0) bits.push(summary.builderLineCount + ' builder item' + (summary.builderLineCount === 1 ? ' needs' : 's need') + ' a saved design');
      if (summary.reviewLineCount > 0) bits.push(summary.reviewLineCount + ' line' + (summary.reviewLineCount === 1 ? ' needs' : 's need') + ' a quote instead of online checkout');
      if (!safeItems.length) bits.push('Your cart is empty');
      else if (!summary.checkoutBlocked) bits.push('Everything has what it needs — checkout opens Shopify secure payment');
      else if (summary.readyLineCount > 0) bits.push(summary.readyLineCount + ' other line' + (summary.readyLineCount === 1 ? ' is' : 's are') + ' good to go');
      summary.statusMessage = bits.join('. ') + '.';
      return summary;
    }
  };
  // Images are same-origin paths that ship with the build — verify-roundtrip
  // asserts each exists on disk, so a recommendation can never render gray.
  const CURATED_RECOMMENDATIONS = [
    { handle: 'dtf-22-sheet', group: 'dtf-22', family: 'dtf', kind: 'buyable', title: 'DTF 22" Sheet', detail: 'Fast-start sheet for everyday DTF transfer orders.', price: 12, url: '/products/dtf-22-sheet', image: '/assets/shopify-images/vibrant-transfer-stack-card.webp', merchandiseId: 'gid://shopify/ProductVariant/45063581860022' },
    { handle: 'dtf-46-sheet', group: 'dtf-46', family: 'dtf', kind: 'buyable', title: 'DTF 46" Sheet', detail: 'More room for larger transfer layouts and shop runs.', price: 12, url: '/products/dtf-46-sheet', image: '/assets/shopify-images/custom-dtf-transfers-card.webp', merchandiseId: 'gid://shopify/ProductVariant/45063582417078' },
    { handle: 'glitter-dtf-22-sheet', group: 'glitter-22', family: 'specialty', kind: 'buyable', title: 'Glitter DTF 22" Sheet', detail: 'Add sparkle for merch, events, and high-impact designs.', price: 12, url: '/products/glitter-dtf-22-sheet', image: '/assets/shopify-images/glitter-football-tee-card.webp', merchandiseId: 'gid://shopify/ProductVariant/45063583137974' },
    { handle: 'glow-dtf-22-sheet', group: 'glow-22', family: 'specialty', kind: 'buyable', title: 'Glow DTF 22" Sheet', detail: 'Glow-ready transfers for bold specialty orders.', price: 18, url: '/products/glow-dtf-22-sheet', image: '/assets/shopify-images/neon-items-card.webp', merchandiseId: 'gid://shopify/ProductVariant/45063584743606' },
    { handle: 'sublimation-24', group: 'sublimation-24', family: 'sublimation', kind: 'buyable', title: 'Sublimation 24"', detail: 'A clean path for sublimation-ready product work.', price: 8.5, url: '/products/sublimation-24', image: '/assets/shopify-images/h-m-tumblers-card.webp', merchandiseId: 'gid://shopify/ProductVariant/45063585300662' },
    { handle: 'dtf-22-gang-sheet-builder', group: 'dtf-22', family: 'builder', kind: 'builder', title: 'Build a 22" Gang Sheet', detail: 'Open the builder when artwork needs to be arranged first.', price: 12, url: GANGIFY_BUILDER_URL, image: '/assets/shopify-images/car-gang-sheet-card.webp' },
    { handle: 'dtf-46-gang-sheet-builder', group: 'dtf-46', family: 'builder', kind: 'builder', title: 'Build a 46" Gang Sheet', detail: 'Use the larger builder path for oversized layouts.', price: 12, url: GANGIFY_BUILDER_URL, image: '/assets/shopify-images/big-gangsheet-card.webp' }
  ];
  let runtimeConfigPromise = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[cart] failed to parse cart storage', err);
      return [];
    }
  }

  function save(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('[cart] failed to save cart', err);
    }
  }

  function notify() {
    window.dispatchEvent(new CustomEvent('cart:changed', { detail: Cart.getItems() }));
  }

  function findIndex(items, sku, variant) {
    return items.findIndex(i => i.sku === sku && (i.variant || '') === (variant || ''));
  }

  function normalizeKey(value) {
    return String(value || '').toLowerCase().replace(/&quot;/g, '"').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function inferRecommendationGroup(item) {
    const key = normalizeKey([item.handle, item.sku, item.name, item.variant].filter(Boolean).join(' '));
    if (key.includes('glitter') && key.includes('22')) return 'glitter-22';
    if (key.includes('glow') && key.includes('22')) return 'glow-22';
    if (key.includes('sublimation') && key.includes('24')) return 'sublimation-24';
    if (key.includes('by-size') && key.includes('uv')) return 'uv-builder';
    if (key.includes('by-size') && key.includes('glitter')) return 'glitter-builder';
    if (key.includes('by-size') && key.includes('sublimation')) return 'sublimation-builder';
    if (key.includes('by-size') && key.includes('dtf')) return 'dtf-builder';
    if (key.includes('46')) return 'dtf-46';
    if (key.includes('22')) return 'dtf-22';
    return key || 'unknown';
  }

  function inferRecommendationFamily(item) {
    const key = normalizeKey([item.handle, item.sku, item.name, item.variant].filter(Boolean).join(' '));
    if (key.includes('builder') || key.includes('gang-sheet') || key.includes('by-size')) return 'builder';
    if (key.includes('glitter') || key.includes('glow')) return 'specialty';
    if (key.includes('sublimation')) return 'sublimation';
    return 'dtf';
  }

  function curatedRecommendations(items) {
    const handles = new Set(items.map(item => normalizeKey(item.handle || item.sku || item.name)));
    const groups = new Set(items.map(inferRecommendationGroup));
    const families = new Set(items.map(inferRecommendationFamily));
    const candidates = CURATED_RECOMMENDATIONS.filter((candidate) => {
      if (handles.has(normalizeKey(candidate.handle))) return false;
      if (groups.has(candidate.group)) return false;
      if (candidate.kind === 'builder' && families.has('builder')) return false;
      return true;
    });
    const familyOrder = families.has('specialty')
      ? ['dtf', 'builder', 'sublimation', 'specialty']
      : families.has('sublimation')
        ? ['dtf', 'builder', 'specialty', 'sublimation']
        : ['builder', 'specialty', 'sublimation', 'dtf'];
    return candidates.sort((a, b) => familyOrder.indexOf(a.family) - familyOrder.indexOf(b.family)).slice(0, 3);
  }

  function isCheckoutReadyValue(value) {
    return value === true || value === 'true';
  }

  const Cart = {
    add(item) {
      if (!item || !item.sku) {
        console.warn('[cart] add() requires {sku}');
        return;
      }
      const items = load();
      const checkoutReady = item.checkoutReady === undefined ? true : isCheckoutReadyValue(item.checkoutReady);
      const merchandiseId = checkoutReady ? (item.merchandiseId || item.storefront_variant_id || '') : '';
      const idx = findIndex(items, item.sku, item.variant);
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      if (idx >= 0) {
        items[idx].qty += qty;
        if (item.handle || item.productHandle) items[idx].handle = item.handle || item.productHandle;
        if (item.file) items[idx].file = item.file;
        if (item.artworkUrl) items[idx].artworkUrl = item.artworkUrl;
        if (item.uploadedAt) items[idx].uploadedAt = item.uploadedAt;
        if (item.requiresArtwork !== undefined) items[idx].requiresArtwork = item.requiresArtwork;
        if (checkoutReady && merchandiseId) {
          items[idx].merchandiseId = merchandiseId;
        } else if (!checkoutReady) {
          items[idx].merchandiseId = '';
          items[idx].storefront_variant_id = '';
        }
        if (Array.isArray(item.attributes)) items[idx].attributes = item.attributes;
      } else {
        items.push({
          sku: item.sku,
          handle: item.handle || item.productHandle || '',
          name: item.name || item.sku,
          variant: item.variant || '',
          price: Number(item.price) || 0,
          qty,
          thumb: item.thumb || '',
          file: item.file || null,
          artworkUrl: item.artworkUrl || '',
          requiresArtwork: item.requiresArtwork === undefined ? true : item.requiresArtwork,
          merchandiseId,
          attributes: Array.isArray(item.attributes) ? item.attributes : [],
          uploadedAt: item.uploadedAt || '',
          addedAt: Date.now()
        });
      }
      save(items);
      notify();
    },
    remove(sku, variant) {
      const items = load();
      const idx = findIndex(items, sku, variant);
      if (idx >= 0) {
        items.splice(idx, 1);
        save(items);
        notify();
      }
    },
    updateQty(sku, variant, qty) {
      const items = load();
      const idx = findIndex(items, sku, variant);
      if (idx < 0) return;
      const next = Math.max(0, Math.floor(Number(qty) || 0));
      if (next === 0) {
        items.splice(idx, 1);
      } else {
        items[idx].qty = next;
      }
      save(items);
      notify();
    },
    getItems() {
      return load();
    },
    getTotal() {
      return load().reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    },
    getCount() {
      return load().reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    },
    clear() {
      save([]);
      notify();
    },
    updateLine(sku, variant, patch) {
      const items = load();
      const idx = findIndex(items, sku, variant);
      if (idx < 0) return;
      const next = typeof patch === 'function' ? patch({ ...items[idx] }) : { ...items[idx], ...(patch || {}) };
      items[idx] = next;
      save(items);
      notify();
    }
  };

  // Cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) notify();
  });

  window.Cart = Cart;
  // PDP pages upload before add-to-cart; expose the same uploader the drawer uses.
  Cart.uploadArtwork = uploadArtworkFile;

  /* --- Drawer UI wiring (all DOM built with createElement/textContent) --- */
  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(k => {
        if (k === 'class') node.className = props[k];
        else if (k === 'text') node.textContent = props[k];
        else if (k === 'dataset') {
          Object.keys(props[k]).forEach(d => { node.dataset[d] = props[k][d]; });
        } else if (k.startsWith('on') && typeof props[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        } else {
          node.setAttribute(k, props[k]);
        }
      });
    }
    if (children) children.forEach(c => c && node.appendChild(c));
    return node;
  }

  async function loadRuntimeConfig() {
    if (!runtimeConfigPromise) {
      runtimeConfigPromise = fetch('/data/config.json', { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('Could not load checkout config');
          return res.json();
        });
    }
    return runtimeConfigPromise;
  }

  function getUploadConfig(config) {
    return (config && config.uploads) || {
      endpoint: '/api/upload-artwork',
      max_bytes: ARTWORK_MAX_BYTES
    };
  }

  async function storefrontGraphql(query, variables) {
    const cfg = await loadRuntimeConfig();
    const shopify = cfg.shopify || {};
    const domain = shopify.store_domain;
    const apiVersion = shopify.storefront_api_version || '2025-01';
    const token = shopify.storefront_access_token;
    if (!domain || !token) throw new Error('Shopify checkout is not configured yet.');
    const res = await fetch('https://' + domain + '/api/' + apiVersion + '/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token
      },
      body: JSON.stringify({ query: query, variables: variables || {} })
    });
    const json = await res.json();
    if (!res.ok || json.errors) {
      throw new Error('Shopify checkout request failed.');
    }
    return json.data;
  }

  function toCartLine(item) {
    const merchandiseId = item.merchandiseId || item.storefront_variant_id || '';
    if (!merchandiseId) return null;
    const attributes = Array.isArray(item.attributes) ? item.attributes : [];
    if (cartHelpers.itemNeedsArtwork(item) && !cartHelpers.itemHasArtwork(item)) return null;
    const cleanAttributes = attributes
      .filter(a => a && a.key && a.value && a.value !== 'n/a')
      .map(a => ({ key: String(a.key), value: String(a.value) }));
    return {
      merchandiseId: merchandiseId,
      quantity: Math.max(1, Math.floor(Number(item.qty) || 1)),
      attributes: cleanAttributes
    };
  }

  async function createShopifyCheckout(items) {
    const lines = items.map(toCartLine).filter(Boolean);
    if (!lines.length) {
      throw new Error('No checkout-ready Shopify products are in the cart yet.');
    }
    const summary = cartHelpers.summarizeCart(items);
    if (summary.builderLineCount > 0) {
      throw new Error('One or more builder items still need a saved design before checkout can open.');
    }
    if (summary.reviewLineCount > 0) {
      throw new Error('One or more products in this cart are unavailable for online checkout.');
    }
    if (summary.artworkPendingLineCount > 0) {
      throw new Error('Upload artwork for every direct-order line before checkout.');
    }
    const mutation = `mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { id checkoutUrl totalQuantity }
        userErrors { field message code }
      }
    }`;
    const data = await storefrontGraphql(mutation, { lines: lines });
    const payload = data && data.cartCreate;
    if (!payload || (payload.userErrors && payload.userErrors.length)) {
      const message = payload && payload.userErrors && payload.userErrors[0] && payload.userErrors[0].message;
      throw new Error(message || 'Shopify rejected the cart.');
    }
    if (!payload.cart || !payload.cart.checkoutUrl) throw new Error('Shopify did not return a checkout URL.');
    try {
      localStorage.setItem(SHOPIFY_CART_STORAGE_KEY, JSON.stringify({ id: payload.cart.id, checkoutUrl: payload.cart.checkoutUrl, createdAt: Date.now() }));
    } catch (_) {}
    return payload.cart.checkoutUrl;
  }

  function setCheckoutState(button, state, message) {
    if (!button) return;
    if (state === 'loading') {
      button.disabled = true;
      button.dataset.originalText = button.dataset.originalText || button.textContent;
      button.textContent = message || 'Opening secure checkout…';
    } else {
      const items = Cart.getItems();
      button.disabled = items.length === 0;
      button.textContent = button.dataset.originalText || 'Checkout';
    }
  }

  function showCheckoutError(message) {
    alert(message || 'Checkout is temporarily unavailable.');
  }

  function applyArtworkAttributes(item, result) {
    const attributes = Array.isArray(item.attributes) ? item.attributes.slice() : [];
    const next = attributes.filter((entry) => {
      const key = String(entry && entry.key || '').toLowerCase();
      return key !== 'artwork file' && key !== 'artwork file url' && key !== 'artwork upload url';
    });
    if (result.fileName) next.push({ key: 'Artwork file', value: result.fileName });
    if (result.url) {
      next.push({ key: 'Artwork file URL', value: result.url });
      next.push({ key: 'Artwork upload URL', value: result.url });
    }
    return next;
  }

  async function uploadArtworkFile(file) {
    if (!file) throw new Error('Choose an artwork file first.');
    if (file.size > ARTWORK_MAX_BYTES) {
      throw new Error('File is too large. Max 50MB.');
    }
    if (!ARTWORK_ACCEPTED_TYPES.test(file.name)) {
      throw new Error('Unsupported file type. Use PNG, JPG, PDF, AI, or EPS.');
    }
    const config = await loadRuntimeConfig();
    const uploadConfig = getUploadConfig(config);
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await fetch(uploadConfig.endpoint || '/api/upload-artwork', {
      method: 'POST',
      body: form
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {}
    if (!response.ok || !payload || !payload.url) {
      throw new Error(payload && payload.error ? payload.error : 'Artwork upload failed.');
    }
    return payload;
  }

  function buildItemRow(item) {
    const row = el('div', { class: 'cart-item', dataset: { sku: item.sku, variant: item.variant || '' } });

    const thumb = el('div', { class: 'cart-item-thumb', 'aria-hidden': 'true' });
    const body = el('div', { class: 'cart-item-body' });
    body.appendChild(el('div', { class: 'cart-item-name', text: item.name }));
    if (item.variant) body.appendChild(el('div', { class: 'cart-item-variant', text: item.variant }));
    if (item.file) body.appendChild(el('div', { class: 'cart-item-file', text: 'Artwork: ' + item.file }));
    const lineState = cartHelpers.classifyCartItem(item);
    const lineNeedsArt = lineState === 'checkout-ready' && cartHelpers.itemNeedsArtwork(item) && !cartHelpers.itemHasArtwork(item);
    const lineBadgeText = lineNeedsArt
      ? 'Needs artwork'
      : lineState === 'checkout-ready'
        ? 'Ready'
        : lineState === 'builder-required'
          ? 'Builder item'
          : 'Quote required';
    body.appendChild(el('div', { class: 'cart-item-state cart-item-state-' + (lineNeedsArt ? 'needs-artwork' : lineState), text: lineBadgeText }));

    if (lineState === 'builder-required') {
      body.appendChild(el('a', { class: 'cart-item-next', href: '/gang-sheet-builder', text: 'Finish in builder' }));
    } else if (lineState === 'review-required') {
      body.appendChild(el('a', { class: 'cart-item-next', href: '/contact', text: 'Request a quote' }));
    }

    if (lineState === 'checkout-ready' && cartHelpers.itemNeedsArtwork(item)) {
      const uploadWrap = el('div', { class: 'cart-item-upload' });
      const uploadLabel = el('label', { class: 'cart-upload-label' });
      const uploadInput = el('input', {
        class: 'cart-upload-input',
        type: 'file',
        accept: '.png,.jpg,.jpeg,.pdf,.ai,.eps,image/png,image/jpeg,application/pdf,application/postscript'
      });
      const uploadButton = el('button', {
        class: 'cart-upload-btn',
        type: 'button',
        text: cartHelpers.itemHasArtwork(item) ? 'Replace artwork' : 'Upload artwork',
        onclick: () => uploadInput.click()
      });
      const uploadStatus = el('div', {
        class: 'cart-upload-status',
        text: cartHelpers.itemHasArtwork(item)
          ? 'Artwork attached' + (item.file ? ': ' + item.file : '')
          : 'Upload artwork before checkout'
      });
      uploadInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        uploadButton.disabled = true;
        uploadStatus.textContent = 'Uploading artwork…';
        try {
          const uploaded = await uploadArtworkFile(file);
          Cart.updateLine(item.sku, item.variant, (current) => ({
            ...current,
            file: uploaded.fileName || file.name,
            artworkUrl: uploaded.url,
            uploadedAt: uploaded.uploadedAt || new Date().toISOString(),
            attributes: applyArtworkAttributes(current, {
              fileName: uploaded.fileName || file.name,
              url: uploaded.url
            })
          }));
        } catch (err) {
          uploadButton.disabled = false;
          uploadStatus.textContent = err && err.message ? err.message : 'Artwork upload failed.';
        }
      });
      uploadLabel.appendChild(uploadInput);
      uploadWrap.appendChild(uploadLabel);
      uploadWrap.appendChild(uploadButton);
      uploadWrap.appendChild(uploadStatus);
      body.appendChild(uploadWrap);
    }

    const controls = el('div', { class: 'cart-item-controls' });
    const dec = el('button', { class: 'qty-btn', 'aria-label': 'Decrease quantity', text: '−',
      onclick: () => Cart.updateQty(item.sku, item.variant, item.qty - 1) });
    const qtyInput = el('input', { class: 'qty-input', type: 'number', min: '1', value: String(item.qty), 'aria-label': 'Quantity' });
    qtyInput.addEventListener('change', (e) => {
      const n = parseInt(e.target.value, 10);
      Cart.updateQty(item.sku, item.variant, isNaN(n) ? 1 : n);
    });
    const inc = el('button', { class: 'qty-btn', 'aria-label': 'Increase quantity', text: '+',
      onclick: () => Cart.updateQty(item.sku, item.variant, item.qty + 1) });
    const remove = el('button', { class: 'cart-remove', 'aria-label': 'Remove item', text: 'Remove',
      onclick: () => Cart.remove(item.sku, item.variant) });

    controls.appendChild(dec);
    controls.appendChild(qtyInput);
    controls.appendChild(inc);
    controls.appendChild(remove);
    body.appendChild(controls);

    const lineTotal = Number(item.price) * item.qty;
    const price = el('div', { class: 'cart-item-price', text: lineTotal > 0 ? money(lineTotal) : 'Quote' });

    row.appendChild(thumb);
    row.appendChild(body);
    row.appendChild(price);
    return row;
  }

  function buildCartSummary(items) {
    const summaryData = cartHelpers.summarizeCart(items);
    const summary = el('div', { class: 'cart-summary', 'aria-label': 'Cart summary' });
    summary.appendChild(el('div', { class: 'cart-summary-row' }, [
      el('span', { text: 'Items' }),
      el('strong', { text: String(summaryData.totalQuantity) })
    ]));
    summary.appendChild(el('div', { class: 'cart-summary-row' }, [
      el('span', { text: 'Subtotal' }),
      el('strong', { text: money(summaryData.subtotal) })
    ]));
    if (summaryData.readyLineCount > 0) {
      summary.appendChild(el('div', { class: 'cart-summary-row' }, [
        el('span', { text: 'Ready lines' }),
        el('strong', { text: String(summaryData.readyLineCount) })
      ]));
    }
    if (summaryData.builderLineCount > 0) {
      summary.appendChild(el('div', { class: 'cart-summary-row' }, [
        el('span', { text: 'Builder lines' }),
        el('strong', { text: String(summaryData.builderLineCount) })
      ]));
    }
    if (summaryData.artworkPendingLineCount > 0) {
      summary.appendChild(el('div', { class: 'cart-summary-row cart-summary-row-pending' }, [
        el('span', { text: 'Needs artwork' }),
        el('strong', { text: String(summaryData.artworkPendingLineCount) })
      ]));
    }
    if (summaryData.reviewLineCount > 0) {
      summary.appendChild(el('div', { class: 'cart-summary-row' }, [
        el('span', { text: 'Held back' }),
        el('strong', { text: String(summaryData.reviewLineCount) })
      ]));
    }
    summary.appendChild(el('p', {
      text: summaryData.statusMessage
    }));
    return summary;
  }

  function buildRecommendationCard(product) {
    const card = el('article', { class: 'cart-recommendation-card' });
    card.appendChild(el('img', { src: product.image, alt: product.title, loading: 'lazy' }));
    const body = el('div', { class: 'cart-recommendation-body' });
    body.appendChild(el('strong', { text: product.title }));
    body.appendChild(el('span', { text: product.detail }));
    body.appendChild(el('small', { text: product.kind === 'builder' ? 'Builder item' : 'From ' + money(product.price) }));
    const action = product.kind === 'builder'
      ? el('a', { class: 'cart-recommendation-action', href: product.url, text: 'Open Builder' })
      : el('button', {
          class: 'cart-recommendation-action',
          type: 'button',
          text: 'Add',
          onclick: () => Cart.add({
            sku: product.handle,
            handle: product.handle,
            name: product.title,
            variant: 'Default',
            price: product.price,
            qty: 1,
            thumb: product.image,
            merchandiseId: product.merchandiseId,
            checkoutReady: true,
            requiresArtwork: true,
            attributes: [{ key: 'Source', value: 'Curated cart recommendation' }]
          })
        });
    body.appendChild(action);
    card.appendChild(body);
    return card;
  }

  function buildRecommendations(items) {
    const recommendations = curatedRecommendations(items);
    if (!recommendations.length) return null;
    const wrap = el('section', { class: 'cart-recommendations', 'aria-label': 'Recommended next products' });
    wrap.appendChild(el('div', { class: 'cart-recommendations-head' }, [
      el('span', { text: 'Next best options' }),
      el('a', { href: '/shop', text: 'Shop all' })
    ]));
    recommendations.forEach(product => wrap.appendChild(buildRecommendationCard(product)));
    return wrap;
  }

  function blockedNoteText(summary) {
    if (summary.artworkPendingLineCount > 0) {
      return 'Almost there — tap "Upload artwork" on the highlighted line' + (summary.artworkPendingLineCount === 1 ? '' : 's') + '. Checkout opens the moment every line has art.';
    }
    if (summary.builderLineCount > 0) return 'Builder lines need a saved design — tap "Finish in builder" on that line.';
    return 'One or more lines need a quote — tap "Request a quote" on that line, or remove it to check out the rest.';
  }

  function itemIsBlocked(item) {
    const state = cartHelpers.classifyCartItem(item);
    if (state !== 'checkout-ready') return true;
    return cartHelpers.itemNeedsArtwork(item) && !cartHelpers.itemHasArtwork(item);
  }

  function guideToFirstBlockedLine(items) {
    const rows = Array.prototype.slice.call(document.querySelectorAll('#cart-items .cart-item'));
    const blocked = items.filter(itemIsBlocked);
    let firstRow = null;
    blocked.forEach(function (item, index) {
      const row = rows.find(function (r) {
        return r.dataset.sku === String(item.sku) && (r.dataset.variant || '') === String(item.variant || '');
      });
      if (!row) return;
      if (!firstRow) firstRow = row;
      row.classList.remove('cart-item-flash');
      void row.offsetWidth;
      row.classList.add('cart-item-flash');
    });
    if (firstRow) {
      firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const uploadBtn = firstRow.querySelector('.cart-upload-btn');
      if (uploadBtn) uploadBtn.focus({ preventScroll: true });
    }
    const note = document.getElementById('cart-note');
    if (note) {
      note.hidden = false;
      note.textContent = blockedNoteText(cartHelpers.summarizeCart(items));
    }
  }

  function renderDrawer() {
    const list = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const emptyEl = document.getElementById('cart-empty');
    const checkout = document.getElementById('cart-checkout');
    const note = document.getElementById('cart-note');
    const summaryEl = document.getElementById('cart-summary');
    const recommendationsEl = document.getElementById('cart-recommendations');
    if (!list || !totalEl) return;

    const items = Cart.getItems();
    while (list.firstChild) list.removeChild(list.firstChild);
    if (summaryEl) while (summaryEl.firstChild) summaryEl.removeChild(summaryEl.firstChild);
    if (recommendationsEl) while (recommendationsEl.firstChild) recommendationsEl.removeChild(recommendationsEl.firstChild);

    if (items.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (checkout) checkout.disabled = true;
      if (note) note.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      if (recommendationsEl) recommendationsEl.hidden = true;
      totalEl.textContent = money(0);
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (summaryEl) {
      summaryEl.hidden = false;
      summaryEl.appendChild(buildCartSummary(items));
    }
    if (recommendationsEl) {
      // Upsells only when the customer's own lines are all clear — they must
      // never compete for attention with a line that still needs artwork.
      const allClear = !cartHelpers.summarizeCart(items).checkoutBlocked;
      const recommendations = allClear ? buildRecommendations(items) : null;
      recommendationsEl.hidden = !recommendations;
      if (recommendations) recommendationsEl.appendChild(recommendations);
    }
    const cartSummary = cartHelpers.summarizeCart(items);
    if (checkout) checkout.disabled = false;
    if (note) {
      note.hidden = !cartSummary.checkoutBlocked;
      note.textContent = cartSummary.checkoutBlocked ? blockedNoteText(cartSummary) : '';
    }

    items.forEach(i => list.appendChild(buildItemRow(i)));
    totalEl.textContent = money(Cart.getTotal());
  }

  function renderCount() {
    const n = Cart.getCount();
    const countEls = [document.getElementById('cart-count'), document.getElementById('cart-count-mobile')].filter(Boolean);
    countEls.forEach(el => { el.textContent = n; });
    document.querySelectorAll('.cart-btn').forEach(btn => {
      btn.setAttribute('aria-label', 'Cart, ' + n + ' item' + (n === 1 ? '' : 's'));
    });
  }

  function openCart() {
    const drawer = document.getElementById('cart-drawer');
    const scrim = document.getElementById('cart-scrim');
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.removeAttribute('inert');
    const scroll = document.getElementById('cart-scroll');
    if (scroll) scroll.scrollTop = 0;
    if (scrim) scrim.classList.add('open');
    document.body.classList.add('cart-open');
    const close = drawer.querySelector('.cart-close');
    if (close) close.focus();
  }

  function closeCart() {
    const drawer = document.getElementById('cart-drawer');
    const scrim = document.getElementById('cart-scrim');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    if (scrim) scrim.classList.remove('open');
    document.body.classList.remove('cart-open');
  }

  window.openCart = openCart;
  window.closeCart = closeCart;

  function wireDrawer() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('.quote-button[data-checkout-ready="false"]');
      if (!button) return;
      button.dataset.merchandiseId = '';
    }, true);

    document.querySelectorAll('.cart-btn').forEach((cartBtn) => {
      cartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openCart();
      });
    });

    const close = document.querySelector('.cart-close');
    if (close) close.addEventListener('click', closeCart);

    const scrim = document.getElementById('cart-scrim');
    if (scrim) scrim.addEventListener('click', closeCart);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('cart-open')) {
        closeCart();
      }
    });

    const checkout = document.getElementById('cart-checkout');
    if (checkout) {
      checkout.addEventListener('click', async () => {
        const items = Cart.getItems();
        if (!items.length) return;
        if (cartHelpers.summarizeCart(items).checkoutBlocked) {
          guideToFirstBlockedLine(items);
          return;
        }
        setCheckoutState(checkout, 'loading', 'Opening secure Shopify checkout…');
        try {
          const checkoutUrl = await createShopifyCheckout(items);
          window.location.href = checkoutUrl;
        } catch (err) {
          console.warn('[cart] checkout failed', err);
          showCheckoutError(err && err.message ? err.message : 'Checkout is temporarily unavailable.');
          setCheckoutState(checkout, 'idle');
        }
      });
    }
  }

  window.addEventListener('cart:changed', () => {
    renderCount();
    renderDrawer();
  });

  window.addEventListener('DOMContentLoaded', () => {
    wireDrawer();
    renderCount();
    renderDrawer();
  });
})();
