/* ============================================================
   Hatfield McCoy DTF — Content + Product Loader
   ============================================================
   Loads data/content.json, data/products.json, data/config.json.
   Renders shop grid, PDPs (hash-routed), FAQ, steps, comparison.
   Exposes window.__HM = { content, products, config }.
   Compatible with Stream B's products.json schema:
     collections[].products[] (each with sku, name, size, price|price_model)
   ============================================================ */
(function () {
  // --- tiny safe element builder ---
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
        } else if (props[k] === true) {
          node.setAttribute(k, '');
        } else if (props[k] !== false && props[k] != null) {
          node.setAttribute(k, props[k]);
        }
      });
    }
    if (children) children.forEach(c => { if (c) node.appendChild(c); });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function money(n) { return '$' + Number(n).toFixed(2); }

  // --- data fetch with fallback ---
  async function fetchJson(path, fallback) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      return await res.json();
    } catch (err) {
      console.warn('[content] failed to load', path, err);
      return fallback;
    }
  }

  // Defaults — used if data files missing (Stream B delivers real ones).
  const DEFAULT_CONFIG = {
    kicksy: { embed_url: null, fallback_mode: 'quote_form', iframe_height: '800', iframe_title: 'Gang Sheet Builder' },
    webhook: { endpoint: '/api/intake' },
    brand_email: 'HatfieldandMcCoydtf@gmail.com',
    socials: { instagram: null, facebook: null, tiktok: null },
    site: { url_staging: 'https://hatfield-mccoy-dtf.futrbusiness.com' }
  };

  // Senior-dev brand defaults — Stream B writes content.json to override.
  const DEFAULT_CONTENT = {
    brand: {
      tagline: 'Print Loud. Print Proud.',
      story_long: 'Hatfield McCoy DTF prints custom heat transfers, gang sheets, sublimation, and specialty films out of Logan, West Virginia. We took a name built on rivalry and put it to work — every sheet that leaves the shop has to earn its place on the press. Clean edges, stretched to hell, no fade, no peel. If it doesn\'t pass our feud, it doesn\'t ship.',
      established: '2022',
      location: 'Logan, West Virginia'
    },
    hero: {
      eyebrow: 'Logan, WV · Proudly Made',
      lede: 'Custom DTF heat transfers, gang sheets, sublimation, and glow-in-the-dark specialties — pressed in the hills of West Virginia and shipped everywhere. No pretreatment. No minimums. No feud between you and a clean print.'
    },
    steps: [
      { n: 1, title: 'Upload', desc: 'Send us your artwork — PNG, JPG, PDF, AI, or EPS at 300 DPI. Transparency prints cleanest.' },
      { n: 2, title: 'Print', desc: 'We print to order on 22″ or 46″ DTF film, cure it, and QC every sheet before it ships.' },
      { n: 3, title: 'Press', desc: 'Press it to your garment at 300°F, medium pressure, 10–15 seconds. Full instructions ship with every order.' }
    ],
    comparison_table: {
      heading: 'Why Hatfield McCoy',
      rows: [
        { feature: 'No minimum orders', hm: true, others: false },
        { feature: 'Works on cotton, poly, blends, nylon, leather', hm: true, others: true },
        { feature: 'No pretreatment required', hm: true, others: false },
        { feature: 'Stretches without cracking', hm: true, others: false },
        { feature: '22″ and 46″ widths in stock', hm: true, others: false },
        { feature: 'Custom gang sheet builder', hm: true, others: true },
        { feature: 'West Virginia-based production', hm: true, others: false }
      ]
    },
    tat: {
      standard: '24 hours for in-stock transfers', custom: '48 hours on custom gang sheets', rush: 'Rush/expedited service available for a flat $10 when schedule allows'
    },
    faq: [
      { q: 'How long does production take?', a: 'Most in-stock DTF transfers ship in 24–48 hours. Gang sheets and large orders may take 2–3 business days. Rush options available — contact us before you order.' },
      { q: 'What file formats do you accept?', a: 'PNG, JPG, PDF, AI, and EPS up to 50 MB. A transparent PNG at 300 DPI prints the cleanest.' },
      { q: 'Is there a minimum order?', a: 'No minimum. One sheet is fine. Bulk pricing kicks in automatically at higher quantities.' },
      { q: 'Do you offer local pickup?', a: 'Yes — local pickup is available in Logan, WV by appointment. Select "Pickup" at checkout and we\'ll send pickup instructions with your order confirmation.' },
      { q: 'How do I press my transfer?', a: 'Heat press to 300°F, medium pressure, 10–15 seconds. Peel warm for a matte finish, peel cold for glossy. Full instructions ship with every order.' },
      { q: 'What garments can I press onto?', a: 'DTF works on cotton, polyester, blends, nylon, and even leather. No pretreatment required.' },
      { q: 'Will the prints fade or crack?', a: 'Not if pressed correctly. Our DTF transfers are rated for 50+ wash cycles with no fade and no peel. Wash inside out in cold water for the longest life.' },
      { q: 'How does the gang sheet builder work?', a: 'Load the Gang Sheet Builder, drop your artwork onto the 22″ canvas, arrange until the sheet is full, and submit. We print exactly what you lay out.' },
      { q: 'What if I don\'t have print-ready art?', a: 'Send us what you have. If the file won\'t print cleanly we\'ll reach out before charging and help you fix it.' },
      { q: 'Do you offer wholesale pricing?', a: 'Yes. Contact us at HatfieldandMcCoydtf@gmail.com for wholesale and print shop partner pricing.' }
    ],
    cart: {
      empty_state: 'Your cart is empty. Pick a transfer to get started.',
      checkout_cta: 'Checkout',
      checkout_note: 'Shipping and tax calculated at checkout.'
    },
    reviews: {
      quote: 'Colors didn\'t fade after 40 washes. Best transfers we\'ve run.',
      meta: 'West Virginia print shop',
      stars: 5,
      count: 47
    },
    stats: {
      orders_shipped: '2,000+',
      avg_tat: '24–48 hr',
      review_score: '4.9/5'
    },
    about: {
      heading: 'Run by printers, for printers.',
      body: 'Hatfield McCoy DTF is a small, Logan, WV-based print shop. We run 22″ and 46″ DTF printers, a sublimation press, and a reject pile that gets bigger than we\'d like because we don\'t ship what we wouldn\'t wear. If you\'ve got a question about print quality, a weird fabric, or a deadline — email HatfieldandMcCoydtf@gmail.com and we\'ll actually answer.'
    },
    shipping: {
      heading: 'Shipping & turnaround',
      body: 'Domestic flat-rate shipping is $10. Overnight shipping is available for $32. Orders of $300 or more qualify for free shipping. International shipping is available. Local pickup is available at 311 George Kostas Dr, Logan, WV 25601 during Mon-Fri 9am-9pm shop hours.',
      cutoff: 'Contact us for same-day availability. Rush service is available when schedule allows.'
    },
    contact: {
      heading: 'Questions? We\'ll answer in a holler.',
      body: 'Email us at HatfieldandMcCoydtf@gmail.com, or use the form below. We\'re usually back within 2 business hours during shop time.',
      form_success: 'Thanks — we\'ll get back to you shortly.'
    },
    builder: {
      heading: 'Custom Gang Sheet Builder',
      body: 'Drop your artwork onto the 22″ canvas, arrange until the sheet is full, and submit your layout. We print exactly what you lay out. No minimums.',
      fallback_heading: 'Design Your Gang Sheet',
      fallback_body: 'Tell us what you want to fit onto a custom sheet. We\'ll send a quote and layout preview within 1 business day.'
    }
  };

  const DEFAULT_PRODUCTS = { collections: [] };

  const state = { content: null, products: null, config: null };

  async function load() {
    const [content, products, config] = await Promise.all([
      fetchJson('data/content.json', DEFAULT_CONTENT),
      fetchJson('data/products.json', DEFAULT_PRODUCTS),
      fetchJson('data/config.json', DEFAULT_CONFIG)
    ]);
    state.content = normalizeContent(content || DEFAULT_CONTENT);
    state.products = products || DEFAULT_PRODUCTS;
    state.config = config || DEFAULT_CONFIG;
    window.__HM = state;

    applyContentKeys();
    renderStory();
    renderSteps();
    renderComparison();
    renderFAQ();
    renderShop();
    renderBuilder();
    renderFooter();
    renderReviews();
    renderStats();
    renderBrandCompatibility();
    renderAdditionalServices();
    renderSocialLinks();
    renderPDP();

    window.dispatchEvent(new Event('content-loaded'));
  }

  /**
   * Normalize content.json shape → schema the renderers expect.
   * Stream B's content.json and Stream A's DEFAULT_CONTENT evolved in parallel
   * and drifted slightly. Rather than rewrite either, normalize at load time.
   *
   * Coverage:
   *  - comparison_table.rows: array form [feature, hm, others] → {feature, hm, others}
   *  - faq[]: {question, answer} → {q, a}  (accepts either)
   *  - reviews: content.json puts featured[] + stats on reviews; renderer wants
   *    top-level {quote, meta, stars} + stats. Lift first featured review.
   *  - about/contact sections exist as HTML bindings but content.json puts
   *    about in brand.story_long and contact in contact_strip — synthesize bodies.
   *  - shipping: HTML binds to shipping.body and shipping.cutoff. content.json
   *    has shipping.policy (→ body) and shipping.cutoff already. Copy over.
   *  - stats: content.json nests under reviews.stats as array of {label, value};
   *    renderer wants flat top-level {orders_shipped, avg_tat, review_score}.
   */
  function normalizeContent(c) {
    if (!c || typeof c !== 'object') return c;
    const out = Object.assign({}, c);

    // --- comparison rows: array → object form ---
    const ct = out.comparison_table;
    if (ct && Array.isArray(ct.rows) && ct.rows.length > 0) {
      out.comparison_table = Object.assign({}, ct, {
        heading: ct.heading || ct.headline || 'Comparison',
        rows: ct.rows.map(row => {
          if (Array.isArray(row)) {
            const [feature, hm, others] = row;
            return {
              feature: String(feature || ''),
              hm: coerceYesNo(hm),
              others: coerceYesNo(others)
            };
          }
          // Already in object form — keep as-is but coerce yes/no/sometimes values
          return {
            feature: row.feature || '',
            hm: coerceYesNo(row.hm),
            others: coerceYesNo(row.others)
          };
        })
      });
    }

    // --- FAQ: accept question/answer OR q/a ---
    if (Array.isArray(out.faq)) {
      out.faq = out.faq.map(item => ({
        q: item.q || item.question || '',
        a: item.a || item.answer || ''
      }));
    }

    // --- reviews: lift first featured into top-level + collect stats ---
    if (out.reviews && typeof out.reviews === 'object') {
      const r = out.reviews;
      const featured = Array.isArray(r.featured) && r.featured[0] ? r.featured[0] : null;
      const starCount = typeof r.stars === 'number' ? r.stars
        : (r.stars_display && (r.stars_display.match(/★/g) || []).length) || 5;
      out.reviews = Object.assign({}, r, {
        quote: r.quote || (featured && featured.quote) || '',
        meta: r.meta || (featured && [featured.author, featured.role].filter(Boolean).join(' · ')) || '',
        stars: starCount
      });

      // Stats: content.json has reviews.stats = [{label, value}, ...]
      // Renderer wants top-level state.content.stats = {orders_shipped, avg_tat, review_score}
      if (!out.stats && Array.isArray(r.stats) && r.stats.length > 0) {
        const statsMap = {};
        r.stats.forEach(s => {
          const label = (s.label || '').toLowerCase();
          if (label.includes('order') || label.includes('ship')) statsMap.orders_shipped = s.value;
          else if (label.includes('turn') || label.includes('tat')) statsMap.avg_tat = s.value;
          else if (label.includes('review') || label.includes('score') || label.includes('rat')) statsMap.review_score = s.value;
        });
        out.stats = statsMap;
      }
    }

    // --- about: synthesize from brand.story_long if no about section exists ---
    if (!out.about && out.brand) {
      out.about = {
        heading: 'Run by printers, for printers.',
        body: out.brand.story_long || out.brand.story_short || ''
      };
    } else if (out.about && !out.about.body && out.brand && out.brand.story_long) {
      out.about = Object.assign({}, out.about, { body: out.brand.story_long });
    }

    // --- shipping: map policy → body if body missing ---
    if (out.shipping && !out.shipping.body) {
      out.shipping = Object.assign({}, out.shipping, {
        heading: out.shipping.heading || 'Shipping & Turnaround',
        body: out.shipping.policy || ''
      });
    }

    // --- contact: synthesize from contact_strip / brand.email if missing ---
    if (!out.contact) {
      const strip = out.contact_strip || {};
      const email = (out.brand && (out.brand.shop_email || out.brand.email)) || 'HatfieldandMcCoydtf@gmail.com';
      out.contact = {
        heading: strip.headline_lead
          ? String(strip.headline_lead) + (strip.headline_cyan ? ' ' + strip.headline_cyan : '')
          : "Questions? We'll answer in a holler.",
        body: "Email " + email + " and you'll hear back the same day. We'd rather talk to a real customer than run another ad."
      };
    } else if (!out.contact.body) {
      const email = (out.brand && (out.brand.shop_email || out.brand.email)) || 'HatfieldandMcCoydtf@gmail.com';
      out.contact = Object.assign({}, out.contact, {
        body: "Email " + email + " and you'll hear back the same day. We'd rather talk to a real customer than run another ad."
      });
    }

    return out;
  }

  /**
   * Coerce a yes/no/sometimes/rare/varies/etc. string to a boolean-ish marker.
   * Truthy ("yes", "✓", true) → true. Everything else → the raw string (so
   * "sometimes" or "rare" renders literally rather than as "—").
   */
  function coerceYesNo(v) {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v == null) return '';
    const s = String(v).trim().toLowerCase();
    if (s === 'yes' || s === 'y' || s === '✓' || s === 'true') return true;
    return String(v).trim();
  }

  // --- helpers ---
  function resolveKey(obj, key) {
    return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  }

  function applyContentKeys() {
    document.querySelectorAll('[data-content-key]').forEach(elm => {
      const val = resolveKey(state.content, elm.dataset.contentKey);
      if (val !== undefined && val !== null) elm.textContent = String(val);
    });
  }

  function renderStory() {
    const node = document.getElementById('story-body');
    if (node && state.content.brand && state.content.brand.story_long) {
      node.textContent = state.content.brand.story_long;
    }
  }

  function renderSteps() {
    const container = document.getElementById('steps-grid');
    if (!container || !state.content.steps) return;
    clear(container);
    state.content.steps.forEach(step => {
      const card = el('div', { class: 'step-card' });
      card.appendChild(el('div', { class: 'step-num', text: String(step.n) }));
      card.appendChild(el('h3', { class: 'step-title', text: step.title }));
      card.appendChild(el('p', { class: 'step-desc', text: step.desc }));
      container.appendChild(card);
    });
  }

  function renderComparison() {
    const heading = document.getElementById('compare-heading');
    const tbody = document.getElementById('compare-body');
    if (!tbody || !state.content.comparison_table) return;
    if (heading) heading.textContent = state.content.comparison_table.heading || 'Comparison';
    clear(tbody);
    state.content.comparison_table.rows.forEach(row => {
      const tr = el('tr');
      tr.appendChild(el('td', { class: 'compare-feature', text: row.feature }));
      tr.appendChild(buildCompareCell(row.hm, 'compare-hm'));
      tr.appendChild(buildCompareCell(row.others, 'compare-other'));
      tbody.appendChild(tr);
    });
  }

  // Cell rendering: true → ✓ with "yes" class; empty → —; any other
  // string ("sometimes", "rare", "varies") renders literally.
  function buildCompareCell(value, role) {
    if (value === true) {
      return el('td', { class: 'compare-cell ' + role + ' yes', text: '✓' });
    }
    if (!value || value === '') {
      return el('td', { class: 'compare-cell ' + role, text: '—' });
    }
    return el('td', { class: 'compare-cell ' + role + ' qualifier', text: String(value) });
  }

  function renderFAQ() {
    const container = document.getElementById('faq-list');
    if (!container || !state.content.faq) return;
    clear(container);
    state.content.faq.forEach((item, i) => {
      const d = el('details', i === 0 ? { open: true } : null);
      const s = el('summary');
      s.appendChild(el('span', { text: item.q }));
      d.appendChild(s);
      d.appendChild(el('p', { text: item.a }));
      container.appendChild(d);
    });
  }

  function renderReviews() {
    const container = document.getElementById('review-card');
    if (!container || !state.content.reviews) return;
    clear(container);
    const r = state.content.reviews;
    const starCount = Math.max(1, Math.min(5, Number(r.stars) || 5));
    const stars = '★ '.repeat(starCount).trim();
    container.appendChild(el('div', { class: 'stars', text: stars }));
    container.appendChild(el('p', { class: 'proof-quote', text: '"' + r.quote + '"' }));
    container.appendChild(el('p', { class: 'proof-meta', text: '— ' + r.meta }));
  }

  function renderStats() {
    const s = state.content.stats;
    if (!s) return;
    const map = {
      'stat-orders-shipped': s.orders_shipped,
      'stat-avg-tat': s.avg_tat,
      'stat-review-score': s.review_score
    };
    Object.keys(map).forEach(id => {
      const elm = document.getElementById(id);
      if (elm && map[id]) elm.textContent = map[id];
    });
  }

  function getShopEmail() {
    return (state.config && (state.config.shop_email || state.config.brand_email)) ||
      (state.content && state.content.brand && (state.content.brand.shop_email || state.content.brand.email)) ||
      'HatfieldandMcCoydtf@gmail.com';
  }

  function getShopPhone() {
    return (state.config && state.config.shop_phone) ||
      (state.content && state.content.brand && state.content.brand.phone) ||
      '(304) 688-9970';
  }

  function renderFooter() {
    const email = getShopEmail();
    const phone = getShopPhone();
    document.querySelectorAll('[data-contact-email]').forEach(elm => {
      elm.setAttribute('href', 'mailto:' + email);
      if (elm.dataset.contactEmail === 'text') elm.textContent = email;
    });
    document.querySelectorAll('[data-contact-phone]').forEach(elm => {
      const tel = String(phone).replace(/[^0-9+]/g, '');
      elm.setAttribute('href', 'tel:' + tel);
      elm.textContent = phone;
    });
  }

  function renderSocialLinks() {
    const host = document.getElementById('social-links');
    if (!host) return;
    clear(host);
    const socials = (state.config && state.config.socials) || {};
    const items = [
      ['Instagram', socials.instagram, socials.instagram_handle || '@Hatfieldnmccoydtf'],
      ['Facebook', socials.facebook, 'Facebook'],
      ['YouTube', socials.youtube, 'YouTube']
    ];
    items.forEach(([label, url, text]) => {
      if (!url) return;
      host.appendChild(el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: text || label }));
    });
  }

  function renderBrandCompatibility() {
    const host = document.getElementById('brand-compatibility-list');
    if (!host) return;
    const data = state.content.brand_compatibility || {};
    const brands = Array.isArray(data.brands) ? data.brands : [];
    clear(host);
    brands.forEach(brand => host.appendChild(el('li', { text: brand })));
  }

  function renderAdditionalServices() {
    const host = document.getElementById('additional-services-grid');
    if (!host) return;
    const services = Array.isArray(state.content.additional_services) ? state.content.additional_services : [];
    clear(host);
    services.forEach(service => {
      const card = el('article', { class: 'service-card' });
      card.appendChild(el('h3', { text: service.name || '' }));
      card.appendChild(el('p', { class: 'service-status', text: service.status || '' }));
      if (service.public_note) card.appendChild(el('p', { class: 'service-note', text: service.public_note }));
      const cta = service.cta || 'Contact Us';
      const isSoon = /coming soon/i.test(cta) || /coming soon/i.test(service.status || '');
      if (isSoon) {
        card.appendChild(el('span', { class: 'service-cta muted-pill', text: 'Coming Soon' }));
      } else {
        card.appendChild(el('a', { class: 'service-cta', href: '#contact', text: cta }));
      }
      host.appendChild(card);
    });
  }

  // --- Shop grid (Stream B schema: collections[].products[]) ---
  function slugToClass(slug) {
    // dtf-22 -> dtf-22; glitter-22 -> glitter; glow-22 -> glow; sublimation-24 -> sub; gang-sheet -> gangsheet
    if (!slug) return 'dtf-22';
    if (slug === 'glitter-22') return 'glitter';
    if (slug === 'glow-22') return 'glow';
    if (slug === 'sublimation-24') return 'sub';
    if (slug === 'gang-sheet') return 'gangsheet';
    if (slug === '3d-print') return 'threed';
    return slug;
  }

  function coverForCollection(col) {
    // Prefer cover_image from data file; fall back to conventional path
    return col.cover_image || ('assets/images/covers/' + slugToClass(col.slug) + '.png');
  }

  function coverWebpForCollection(col) {
    // Derive .webp sibling path when cover_image is a .png, otherwise null
    const png = coverForCollection(col);
    if (typeof png === 'string' && /\.png$/i.test(png)) {
      return png.replace(/\.png$/i, '.webp');
    }
    return null;
  }

  function describeVariantCount(col) {
    if (Array.isArray(col.products)) {
      if (col.products.length === 1 && col.products[0].price_model === 'builder') {
        return 'Build your own · 22″ wide';
      }
      return col.products.length + ' size option' + (col.products.length === 1 ? '' : 's');
    }
    return '';
  }

  function priceFromLabel(col) {
    if (col.price_from != null) return 'From ' + money(col.price_from);
    // Derive from products array
    if (Array.isArray(col.products) && col.products.length) {
      const withPrice = col.products.filter(p => typeof p.price === 'number');
      if (withPrice.length) return 'From ' + money(Math.min.apply(null, withPrice.map(p => p.price)));
    }
    return 'Build & Quote';
  }

  function renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid || !state.products || !state.products.collections) return;
    clear(grid);

    state.products.collections.forEach(col => {
      // Gang sheet tile links to builder, others go to PDP
      const isGangSheet = col.slug === 'gang-sheet';
      const href = isGangSheet ? '#builder' : '#pdp-' + col.slug;

      const link = el('a', {
        class: 'product ' + slugToClass(col.slug),
        href: href,
        'aria-label': 'View ' + col.name
      });

      const thumb = el('div', { class: 'thumb' });
      const cover = coverForCollection(col);
      const coverWebp = coverWebpForCollection(col);
      const altDesc = col.description
        ? (col.description.length > 80 ? col.description.slice(0, 80).trimEnd() + '…' : col.description)
        : 'product cover image';
      const picture = el('picture');
      if (coverWebp) {
        const source = el('source', {
          type: 'image/webp',
          srcset: coverWebp
        });
        picture.appendChild(source);
      }
      const img = el('img', {
        src: cover,
        alt: col.name + ' — ' + altDesc,
        width: '1200',
        height: '800',
        loading: 'lazy',
        decoding: 'async',
        class: 'thumb-img'
      });
      picture.appendChild(img);
      thumb.appendChild(picture);
      // HTML overlay title — replaces baked-in image text (D-101b fix)
      const title = el('h3', { class: 'thumb-title', text: col.name });
      thumb.appendChild(title);
      link.appendChild(thumb);

      const body = el('div', { class: 'product-body' });
      body.appendChild(el('h4', { text: col.name }));
      body.appendChild(el('div', { class: 'from', text: describeVariantCount(col) }));
      body.appendChild(el('div', { class: 'price', text: priceFromLabel(col) }));
      link.appendChild(body);

      grid.appendChild(link);
    });
  }

  // --- PDP (hash-routed) ---
  function findCollection(slug) {
    if (!state.products || !Array.isArray(state.products.collections)) return null;
    return state.products.collections.find(c => c.slug === slug) || null;
  }

  function getCollectionFromHash() {
    const h = window.location.hash || '';
    const m = h.match(/^#pdp-([a-z0-9-]+)$/i);
    if (!m) return null;
    return findCollection(m[1]);
  }

  function renderPDP() {
    const section = document.getElementById('pdp');
    if (!section) return;

    const col = getCollectionFromHash();
    if (!col) {
      section.hidden = true;
      return;
    }
    section.hidden = false;

    const container = section.querySelector('.pdp-body');
    if (!container) return;
    clear(container);

    // Breadcrumb + heading
    const head = section.querySelector('.page-head');
    if (head) {
      const crumb = head.querySelector('.crumbs');
      if (crumb) crumb.textContent = 'Shop / ' + col.name;
      const h2 = head.querySelector('h2');
      if (h2) h2.textContent = col.name;
    }

    const grid = el('div', { class: 'pdp-grid pdp' });
    const heroThumb = el('div', { class: 'pdp-hero' });
    const heroPicture = el('picture');
    const heroWebp = coverWebpForCollection(col);
    if (heroWebp) {
      heroPicture.appendChild(el('source', { type: 'image/webp', srcset: heroWebp }));
    }
    const heroImg = el('img', {
      src: coverForCollection(col),
      alt: col.name,
      width: '1200',
      height: '800',
      class: 'pdp-hero-img',
      loading: 'eager',
      decoding: 'async'
    });
    heroPicture.appendChild(heroImg);
    heroThumb.appendChild(heroPicture);
    // HTML overlay title — consistent with shop grid
    heroThumb.appendChild(el('h2', { class: 'pdp-hero-title', text: col.name }));

    const pdp = el('div');
    pdp.appendChild(el('h1', { text: col.name }));
    const fromPrice = el('div', { class: 'from', id: 'pdp-price' });

    // Find first variant with a real price
    const firstPriced = Array.isArray(col.products)
      ? col.products.find(p => typeof p.price === 'number')
      : null;
    const initialPrice = firstPriced ? firstPriced.price : (col.price_from || 0);
    fromPrice.textContent = 'From ' + money(initialPrice);
    pdp.appendChild(fromPrice);

    if (col.description) {
      pdp.appendChild(el('p', { class: 'desc', text: col.description }));
    }

    // Color chooser (if color_options present).
    // Accepts either ["Silver","Gold",...] or [{name,sku_suffix}, ...] (backwards-compatible).
    if (Array.isArray(col.color_options) && col.color_options.length > 1) {
      pdp.appendChild(el('div', { class: 'variant-label', text: 'Color' }));
      const colorRow = el('div', { class: 'variant-row color-row', role: 'radiogroup', 'aria-label': 'Color' });
      // Track whether any color lacks a sku_suffix — triggers a console warn for glitter
      // (the only collection that needs compound SKUs today).
      var missingSkuSuffixForColors = [];
      col.color_options.forEach((c, i) => {
        var name;
        if (typeof c === 'string') {
          name = c;
        } else if (c && typeof c.name === 'string' && c.name.trim()) {
          name = c.name;
        } else {
          // Invalid entry — skip rendering the button. Don't silently label it "null".
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[content] Skipping invalid color_options entry at index ' + i + ' for collection ' + col.slug, c);
          }
          return;
        }
        var suffix = (typeof c === 'object' && c && c.sku_suffix) ? c.sku_suffix : '';
        if (!suffix && col.slug === 'glitter-22') {
          missingSkuSuffixForColors.push(name);
        }
        const btnAttrs = {
          type: 'button',
          class: 'variant' + (i === 0 ? ' selected' : ''),
          role: 'radio',
          'aria-checked': i === 0 ? 'true' : 'false',
          'data-color': name
        };
        if (suffix) btnAttrs['data-sku-suffix'] = suffix;
        const btn = el('button', btnAttrs);
        btn.appendChild(el('span', { class: 'size', text: name }));
        btn.addEventListener('click', () => {
          colorRow.querySelectorAll('.variant').forEach(v => {
            v.classList.remove('selected');
            v.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('selected');
          btn.setAttribute('aria-checked', 'true');
          // Keep PDP price + add-to-cart label in sync with the currently selected size
          // (color doesn't change price today, but re-select to refresh compound SKU context)
          const sizeRow = document.querySelector('.variant-row.size-row');
          const selected = sizeRow && sizeRow.querySelector('.variant.selected');
          if (selected) selectVariant(selected);
        });
        colorRow.appendChild(btn);
      });
      if (missingSkuSuffixForColors.length && typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[content] glitter-22 color_options missing sku_suffix for: ' +
          missingSkuSuffixForColors.join(', ') +
          '. Cart SKUs will not match Shopify variants (GLT-22-{L}-{SIL|GLD|MLT}).'
        );
      }
      pdp.appendChild(colorRow);
    }

    // Size variants
    pdp.appendChild(el('div', { class: 'variant-label', text: 'Select Size' }));
    const varRow = el('div', { class: 'variant-row size-row', role: 'radiogroup', 'aria-label': 'Size options' });

    const sizedProducts = Array.isArray(col.products)
      ? col.products.filter(p => typeof p.price === 'number' && p.checkout_enabled !== false)
      : [];

    if (sizedProducts.length === 0) {
      // e.g. gang-sheet with builder-priced single product
      const msg = el('div', { class: 'pdp-note',
        text: 'Pricing for this collection is calculated by the builder below or via custom quote.' });
      pdp.appendChild(msg);
    } else {
      sizedProducts.forEach((p, i) => {
        const isSelected = i === 0;
        const btnAttrs = {
          type: 'button',
          class: 'variant' + (isSelected ? ' selected' : ''),
          role: 'radio',
          'aria-checked': isSelected ? 'true' : 'false',
          'data-sku': p.sku,
          'data-size': p.size,
          'data-price': String(p.price)
        };
        if (p.storefront_variant_id) btnAttrs['data-merchandise-id'] = p.storefront_variant_id;
        if (p.storefront_variant_ids) btnAttrs['data-merchandise-ids'] = JSON.stringify(p.storefront_variant_ids);
        const btn = el('button', btnAttrs);
        btn.appendChild(el('span', { class: 'size', text: p.size }));
        btn.appendChild(el('span', { class: 'pp', text: money(p.price) }));
        btn.addEventListener('click', () => selectVariant(btn));
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = btn.nextElementSibling || varRow.firstElementChild;
            if (next && next.classList.contains('variant')) { next.click(); next.focus(); }
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = btn.previousElementSibling || varRow.lastElementChild;
            if (prev && prev.classList.contains('variant')) { prev.click(); prev.focus(); }
          }
        });
        varRow.appendChild(btn);
      });
      pdp.appendChild(varRow);

      pdp.appendChild(el('div', { class: 'variant-label', text: 'Quantity' }));
      const qty = el('input', { type: 'number', min: '1', value: '1', class: 'pdp-qty', id: 'pdp-qty', 'aria-label': 'Quantity' });
      pdp.appendChild(qty);

      pdp.appendChild(buildUploadBox(col.slug));
    }

    const ctaRow = el('div', { class: 'cta-row', style: 'margin-top: 24px;' });

    if (sizedProducts.length) {
      const initialSku = sizedProducts[0].sku;
      const addBtn = el('button', {
        type: 'button',
        class: 'btn btn-primary',
        id: 'pdp-add-to-cart',
        'data-sku': initialSku,
        text: 'Add to Cart — ' + money(sizedProducts[0].price)
      });
      addBtn.addEventListener('click', () => onAddToCart(col));
      ctaRow.appendChild(addBtn);
    } else {
      const builderBtn = el('a', { class: 'btn btn-primary', href: '#builder', text: 'Use the Builder' });
      ctaRow.appendChild(builderBtn);
    }
    const altLink = el('a', { class: 'btn btn-ghost', href: '#builder', text: 'Need a gang sheet?' });
    ctaRow.appendChild(altLink);
    pdp.appendChild(ctaRow);

    grid.appendChild(heroThumb);
    grid.appendChild(pdp);
    container.appendChild(grid);

    // Scroll to the section
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectVariant(btn) {
    const row = btn.parentElement;
    row.querySelectorAll('.variant').forEach(v => {
      v.classList.remove('selected');
      v.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('selected');
    btn.setAttribute('aria-checked', 'true');

    const price = Number(btn.dataset.price);
    const priceEl = document.getElementById('pdp-price');
    if (priceEl && !isNaN(price)) priceEl.textContent = money(price);
    const addBtn = document.getElementById('pdp-add-to-cart');
    if (addBtn && !isNaN(price)) addBtn.textContent = 'Add to Cart — ' + money(price);
  }

  function buildUploadBox(slug) {
    const label = el('label', {
      class: 'upload-box',
      for: 'art-upload-' + slug,
      tabindex: '0',
      'data-sku': slug
    });
    const input = el('input', {
      type: 'file',
      id: 'art-upload-' + slug,
      name: 'artwork',
      accept: '.png,.jpg,.jpeg,.pdf,.ai,.eps,image/png,image/jpeg,application/pdf,application/postscript',
      hidden: true
    });
    label.appendChild(input);
    label.appendChild(el('span', { class: 'upload-prompt', text: 'Upload Your Artwork' }));
    label.appendChild(el('span', { class: 'upload-hint', text: 'PNG, JPG, PDF, AI, EPS · Up to 50MB · 300 DPI recommended' }));
    label.appendChild(el('span', { class: 'upload-filename', 'aria-live': 'polite' }));
    label.appendChild(el('span', { class: 'upload-error', 'aria-live': 'assertive' }));

    input.addEventListener('change', (e) => {
      handleFile(label, e.target.files && e.target.files[0]);
    });

    label.addEventListener('dragover', (e) => {
      e.preventDefault();
      label.classList.add('dragover');
    });
    label.addEventListener('dragleave', () => label.classList.remove('dragover'));
    label.addEventListener('drop', (e) => {
      e.preventDefault();
      label.classList.remove('dragover');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) {
        input.files = e.dataTransfer.files;
        handleFile(label, f);
      }
    });

    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });

    return label;
  }

  function handleFile(labelNode, file) {
    const fn = labelNode.querySelector('.upload-filename');
    const err = labelNode.querySelector('.upload-error');
    if (err) err.textContent = '';
    if (fn) fn.textContent = '';
    labelNode.classList.remove('has-error', 'has-file');
    delete labelNode.dataset.file;

    if (!file) return;

    const MAX = 50 * 1024 * 1024;
    if (file.size > MAX) {
      if (err) err.textContent = 'File is too large (' + (file.size / 1024 / 1024).toFixed(1) + ' MB). Max 50MB.';
      labelNode.classList.add('has-error');
      return;
    }
    const allowed = /\.(png|jpg|jpeg|pdf|ai|eps)$/i;
    if (!allowed.test(file.name)) {
      if (err) err.textContent = 'Unsupported file type. Use PNG, JPG, PDF, AI, or EPS.';
      labelNode.classList.add('has-error');
      return;
    }

    if (fn) fn.textContent = file.name + ' · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB';
    labelNode.dataset.file = file.name;
    labelNode.classList.add('has-file');
  }

  function onAddToCart(col) {
    const row = document.querySelector('.variant-row.size-row') || document.querySelector('.variant-row');
    const selected = row && row.querySelector('.variant.selected');
    if (!selected) return;
    const baseSku = selected.dataset.sku || col.slug;
    const size = selected.dataset.size || '';
    const price = Number(selected.dataset.price) || 0;
    const qtyInput = document.getElementById('pdp-qty');
    const qty = Math.max(1, parseInt(qtyInput && qtyInput.value, 10) || 1);

    // Get color if separate. If the color button exposes a data-sku-suffix, we append it
    // to the base SKU to form the compound Shopify SKU (e.g. GLT-22-24 + SIL → GLT-22-24-SIL).
    const colorRow = document.querySelector('.variant-row.color-row');
    const colorBtn = colorRow && colorRow.querySelector('.variant.selected');
    const color = colorBtn && colorBtn.dataset.color;
    const skuSuffix = colorBtn && colorBtn.dataset.skuSuffix;
    const sku = skuSuffix ? (baseSku + '-' + skuSuffix) : baseSku;

    const variant = color ? (size + ' · ' + color) : size;
    let merchandiseId = selected.dataset.merchandiseId || '';
    if (!merchandiseId && selected.dataset.merchandiseIds && skuSuffix) {
      try {
        const idMap = JSON.parse(selected.dataset.merchandiseIds);
        merchandiseId = idMap && idMap[skuSuffix] ? idMap[skuSuffix] : '';
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[content] invalid merchandise id map', err);
      }
    }

    // File from upload box
    const upload = document.querySelector('.upload-box[data-sku="' + col.slug + '"]');
    const file = upload && upload.dataset.file ? upload.dataset.file : null;

    if (window.Cart) {
      window.Cart.add({
        sku: sku,
        handle: col.slug || '',
        name: col.name,
        variant: variant,
        price: price,
        qty: qty,
        thumb: coverForCollection(col),
        file: file,
        merchandiseId: merchandiseId,
        attributes: [
          { key: 'SKU', value: sku },
          { key: 'Size', value: size || 'n/a' },
          { key: 'Color', value: color || 'n/a' },
          { key: 'Artwork file', value: file || 'not uploaded in browser checkout' }
        ]
      });
    }
    if (typeof window.openCart === 'function') window.openCart();
  }

  // --- Builder section ---
  function renderBuilder() {
    const host = document.getElementById('builder-host');
    if (!host) return;
    const k = (state.config && state.config.kicksy) || {};
    const embedUrl = k.embed_url;
    const redirectUrl = k.redirect_url;
    const mode = k.mode;
    clear(host);

    // Mode: redirect → render a launch button + retain the quote form as a secondary path.
    // This is the current Kixxl integration (Shopify-hosted builder page; iframe is blocked by
    // Shopify's X-Frame-Options, so we deep-link instead).
    if (mode === 'redirect' && redirectUrl) {
      host.appendChild(buildLaunchButton(redirectUrl, k.button_label || 'Launch Gang Sheet Builder', !!k.open_in_new_tab));
      const alt = el('div', { class: 'builder-alt' });
      alt.appendChild(el('h3', { text: 'Need a custom quote instead?' }));
      alt.appendChild(buildQuoteForm());
      host.appendChild(alt);
      rewriteBuilderAnchors(redirectUrl, !!k.open_in_new_tab);
      installBuilderClickDelegate();
      return;
    }

    // Legacy iframe mode (retained for backward compat — not used with current Kixxl).
    const forceFallback = k.fallback_mode === 'quote_form' && (!embedUrl || embedUrl === pendingEmbedSentinel);
    if (!embedUrl || embedUrl === pendingEmbedSentinel || forceFallback) {
      host.appendChild(buildQuoteForm());
      return;
    }

    const iframe = el('iframe', {
      src: embedUrl,
      title: k.iframe_title || 'Gang Sheet Builder',
      width: '100%',
      height: k.iframe_height || '800',
      loading: 'lazy',
      class: 'kicksy-frame'
    });
    host.appendChild(iframe);
  }

  function buildLaunchButton(redirectUrl, label, openInNewTab) {
    const wrap = el('div', { class: 'builder-launch' });
    const btnAttrs = {
      href: redirectUrl,
      class: 'btn btn-primary builder-launch-btn',
      'data-builder-cta': 'primary'
    };
    if (openInNewTab) {
      btnAttrs.target = '_blank';
      btnAttrs.rel = 'noopener noreferrer';
    }
    const btn = el('a', btnAttrs);
    btn.appendChild(el('span', { text: label + ' →' }));
    wrap.appendChild(btn);
    return wrap;
  }

  // When redirect mode is active, rewrite every currently-rendered `<a href="#builder">`
  // so hover link-previews show the Shopify URL. Any anchors injected LATER (e.g. by
  // dynamic re-renders after cart open, search, etc.) are caught by the global click
  // delegate installed in installBuilderClickDelegate() — so a single missed attribute
  // rewrite never breaks the customer path.
  function rewriteBuilderAnchors(redirectUrl, openInNewTab) {
    const anchors = document.querySelectorAll('a[href="#builder"]');
    anchors.forEach((a) => {
      a.setAttribute('href', redirectUrl);
      a.setAttribute('data-builder-redirect', '1');
      if (openInNewTab) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  // Install ONCE. Catches clicks on any anchor whose href points at "#builder",
  // including anchors injected after initial render. Safe because anchors already
  // rewritten by rewriteBuilderAnchors() navigate directly via their new href
  // without matching "#builder" here.
  var builderDelegateInstalled = false;
  function installBuilderClickDelegate() {
    if (builderDelegateInstalled) return;
    builderDelegateInstalled = true;
    document.addEventListener('click', function (e) {
      var k = (state.config && state.config.kicksy) || {};
      if (k.mode !== 'redirect' || !k.redirect_url) return;
      // Find nearest anchor in the click path
      var a = e.target && e.target.closest ? e.target.closest('a[href="#builder"]') : null;
      if (!a) return;
      // Allow modifier-clicks + middle-click to use browser defaults (new tab, copy link, etc.)
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (k.open_in_new_tab) {
        window.open(k.redirect_url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = k.redirect_url;
      }
    });
  }

  function buildQuoteForm() {
    const wrap = el('div', { class: 'quote-form' });
    const fallbackBody = (state.content.builder && state.content.builder.fallback_body) ||
      'Send us a quote request and we\'ll send a layout preview within 1 business day.';
    wrap.appendChild(el('p', { class: 'muted', style: 'margin-bottom: 20px;', text: fallbackBody }));

    const form = el('form', { class: 'quote-form-grid', id: 'quote-form', novalidate: true });

    const g1 = el('div', { class: 'field' });
    g1.appendChild(el('label', { for: 'q-dims', text: 'Sheet dimensions (inches)' }));
    g1.appendChild(el('input', { id: 'q-dims', name: 'dimensions', type: 'text', placeholder: '22 × 60', required: true }));
    form.appendChild(g1);

    const g2 = el('div', { class: 'field' });
    g2.appendChild(el('label', { for: 'q-qty', text: 'Quantity' }));
    g2.appendChild(el('input', { id: 'q-qty', name: 'qty', type: 'number', min: '1', value: '1', required: true }));
    form.appendChild(g2);

    const g3 = el('div', { class: 'field field-full' });
    g3.appendChild(el('label', { for: 'q-file', text: 'Upload artwork (PNG/JPG/PDF/AI/EPS, 50MB each — multiple files allowed)' }));
    const file = el('input', { id: 'q-file', name: 'artwork', type: 'file',
      multiple: true,
      accept: '.png,.jpg,.jpeg,.pdf,.ai,.eps,image/png,image/jpeg,application/pdf,application/postscript' });
    g3.appendChild(file);
    const fileList = el('div', { class: 'quote-file-list', 'aria-live': 'polite' });
    g3.appendChild(fileList);
    const fileErr = el('div', { class: 'quote-file-err', 'aria-live': 'assertive' });
    g3.appendChild(fileErr);
    file.addEventListener('change', () => {
      while (fileList.firstChild) fileList.removeChild(fileList.firstChild);
      fileErr.textContent = '';
      const files = Array.from(file.files || []);
      const MAX = 50 * 1024 * 1024;
      const bad = files.filter(f => f.size > MAX);
      if (bad.length) {
        fileErr.textContent = 'Too large: ' + bad.map(f => f.name + ' (' + (f.size / 1024 / 1024).toFixed(1) + ' MB)').join(', ') + '. Max 50MB each.';
      }
      files.forEach(f => {
        const row = el('div', { class: 'quote-file-row' });
        row.textContent = f.name + ' · ' + (f.size / 1024 / 1024).toFixed(2) + ' MB';
        fileList.appendChild(row);
      });
    });
    form.appendChild(g3);

    const g4 = el('div', { class: 'field' });
    g4.appendChild(el('label', { for: 'q-name', text: 'Name' }));
    g4.appendChild(el('input', { id: 'q-name', name: 'name', type: 'text', autocomplete: 'name', required: true }));
    form.appendChild(g4);

    const g5 = el('div', { class: 'field' });
    g5.appendChild(el('label', { for: 'q-email', text: 'Email' }));
    g5.appendChild(el('input', { id: 'q-email', name: 'email', type: 'email', autocomplete: 'email', required: true }));
    form.appendChild(g5);

    const g6 = el('div', { class: 'field field-full' });
    g6.appendChild(el('label', { for: 'q-msg', text: 'Message / special instructions' }));
    g6.appendChild(el('textarea', { id: 'q-msg', name: 'message', rows: '4', maxlength: '1000' }));
    form.appendChild(g6);

    const submit = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Request Quote' });
    const row = el('div', { class: 'field field-full', style: 'margin-top: 10px;' });
    row.appendChild(submit);
    form.appendChild(row);

    const status = el('p', { class: 'quote-status', 'aria-live': 'polite' });
    form.appendChild(status);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const endpoint = (state.config && state.config.webhook && state.config.webhook.endpoint) || '/api/intake';

      // Collect fields from the form
      const fd = new FormData(form);
      const f = {};
      fd.forEach((v, k) => { if (k !== 'artwork') f[k] = String(v); });

      // Collect uploaded files and reject oversize client-side (server has no upload path —
      // these are just filenames reported to Discord for human follow-up)
      const MAX = 50 * 1024 * 1024;
      const files = Array.from(file.files || []);
      const bad = files.filter(fi => fi.size > MAX);
      if (bad.length) {
        status.className = 'quote-status err';
        status.textContent = 'Some files are over 50MB: ' + bad.map(fi => fi.name).join(', ') + '. Remove and try again.';
        return;
      }

      // Build a Discord-embed-shaped payload (the API contract at /api/intake)
      const fields = [
        { name: 'Sheet dimensions', value: f.dimensions || '—', inline: true },
        { name: 'Quantity', value: f.qty || '—', inline: true },
        { name: 'Name', value: f.name || '—', inline: true },
        { name: 'Email', value: f.email || '—', inline: true },
      ];
      if (files.length) {
        const fileLines = files.map(fi => '• ' + fi.name + ' (' + (fi.size / 1024 / 1024).toFixed(2) + ' MB)').join('\n');
        fields.push({
          name: 'Artwork files (' + files.length + ')',
          value: fileLines.slice(0, 1024), // Discord field.value hard limit = 1024 chars
          inline: false,
        });
      }
      if (f.message && f.message.trim()) {
        fields.push({ name: 'Message', value: f.message.slice(0, 1024), inline: false });
      }
      const forensics = navigator.userAgent + ' | ' + new Date().toISOString() + ' | ' + (navigator.language || '—');
      const payload = {
        content: '**🧵 New gang sheet quote from ' + (f.name || 'anonymous') + '** (' + (f.email || 'no email') + ')',
        embeds: [{
          title: 'Hatfield McCoy DTF — Gang Sheet Quote',
          color: 0x00E5FF,
          fields: fields,
          footer: { text: 'H&M DTF · Submitted via #builder quote form · ' + forensics },
          timestamp: new Date().toISOString(),
        }],
      };

      submit.disabled = true;
      submit.textContent = 'Sending…';
      status.className = 'quote-status';
      status.textContent = '';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(r => {
          submit.disabled = false;
          submit.textContent = 'Request Quote';
          if (r.ok) {
            status.classList.add('ok');
            status.textContent = 'Got it. We\'ll send a quote within 1 business day.';
            form.reset();
          } else {
            status.classList.add('error');
            status.textContent = 'Hit a snag (' + r.status + '). Email ' + getShopEmail() + ' instead.';
          }
        })
        .catch(() => {
          submit.disabled = false;
          submit.textContent = 'Request Quote';
          status.classList.add('error');
          status.textContent = 'Network error. Email ' + getShopEmail() + ' and we\'ll handle it there.';
        });
    });

    wrap.appendChild(form);
    return wrap;
  }

  // --- Hash routing ---
  window.addEventListener('hashchange', () => {
    if (state.content) renderPDP();
  });

  window.addEventListener('DOMContentLoaded', load);
})();
