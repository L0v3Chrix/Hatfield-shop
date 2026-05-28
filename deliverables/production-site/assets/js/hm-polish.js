/* Hatfield McCoy DTF — UX polish helpers. No secrets, no product contract changes. */
(function () {
  function el(tag, props, children) {
    var node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (key) {
      if (key === 'class') node.className = props[key];
      else if (key === 'text') node.textContent = props[key];
      else if (key === 'html') node.innerHTML = props[key];
      else node.setAttribute(key, props[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function insertAfter(ref, node) {
    if (!ref || !ref.parentNode) return;
    ref.parentNode.insertBefore(node, ref.nextSibling);
  }

  function addTrustRail() {
    if (document.querySelector('.trust-rail')) return;
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var data = [
      ['✓', 'No minimums', 'Order one sheet or a full run'],
      ['24', 'Fast turnaround', 'In-stock around 24 hours'],
      ['$10', 'Flat shipping', 'Free shipping over $300'],
      ['WV', 'Logan pickup', 'Local pickup by appointment']
    ];
    var rail = el('section', { class: 'trust-rail wrap', 'aria-label': 'Store trust highlights' });
    var grid = el('div', { class: 'trust-rail-grid' });
    data.forEach(function (item) {
      grid.appendChild(el('div', { class: 'trust-pill' }, [
        el('div', { class: 'trust-icon', text: item[0] }),
        el('div', {}, [el('strong', { text: item[1] }), el('span', { text: item[2] })])
      ]));
    });
    rail.appendChild(grid);
    insertAfter(hero, rail);
  }

  function addBuilderProof() {
    var host = document.getElementById('builder-host');
    if (!host || host.querySelector('.builder-proof-grid')) return;
    var grid = el('div', { class: 'builder-proof-grid', 'aria-label': 'Builder process highlights' });
    [
      ['1. Choose sheet', 'Launch the builder and select the size that fits the job.'],
      ['2. Place artwork', 'Upload PNG/PDF/AI/EPS and arrange the layout before checkout.'],
      ['3. We print it', 'The shop prints the exact layout and keeps quote fallback available.']
    ].forEach(function (item) {
      grid.appendChild(el('div', { class: 'builder-proof' }, [el('strong', { text: item[0] }), el('span', { text: item[1] })]));
    });
    host.insertBefore(grid, host.firstChild);
  }

  function addStepGraphics() {
    var media = [
      { src: 'assets/images/product-graphics/builder-canvas-layout.png', alt: 'Artwork arranged on a transparent DTF gang sheet' },
      { src: 'assets/images/product-graphics/printer-output-film.png', alt: 'Fresh DTF transfer film coming off the printer' },
      { src: 'assets/images/product-graphics/heat-press-shirt.png', alt: 'Heat press applying a DTF transfer to a shirt' }
    ];
    document.querySelectorAll('.step-card').forEach(function (card, i) {
      if (card.querySelector('.step-media')) return;
      var data = media[i] || media[0];
      card.insertBefore(el('div', { class: 'step-media' }, [
        el('img', { src: data.src, alt: data.alt, loading: 'lazy', decoding: 'async' })
      ]), card.firstChild);
    });
  }

  function addBuilderVisual() {
    var host = document.getElementById('builder-host');
    if (!host || host.querySelector('.builder-visual-card')) return;
    host.insertBefore(el('div', { class: 'builder-visual-card' }, [
      el('img', {
        src: 'assets/images/product-graphics/builder-canvas-layout.png',
        alt: 'Example custom gang sheet layout with multiple designs arranged on clear film',
        loading: 'lazy',
        decoding: 'async'
      }),
      el('div', { class: 'builder-visual-copy' }, [
        el('strong', { text: 'Build the sheet visually' }),
        el('span', { text: 'Upload art, arrange it edge-to-edge, then send the exact layout to print.' })
      ])
    ]), host.firstChild);
  }

  function addProductBadges() {
    var badges = {
      'dtf-22': 'Best seller',
      'dtf-46': 'Wide format',
      'glitter-22': 'Specialty',
      'glow-22': 'Glow film',
      'sublimation-24': 'Hard goods',
      'gang-sheet': 'Builder',
      '3d-print': 'Local service'
    };
    document.querySelectorAll('.product').forEach(function (card) {
      if (card.querySelector('.hm-card-badge')) return;
      var key = Object.keys(badges).find(function (slug) { return card.classList.contains(slugToClass(slug)); });
      var thumb = card.querySelector('.thumb');
      if (key && thumb) thumb.appendChild(el('span', { class: 'hm-card-badge', text: badges[key] }));
    });
  }

  function slugToClass(slug) {
    if (slug === 'glitter-22') return 'glitter';
    if (slug === 'glow-22') return 'glow';
    if (slug === 'sublimation-24') return 'sub';
    if (slug === 'gang-sheet') return 'gangsheet';
    if (slug === '3d-print') return 'threed';
    return slug;
  }

  function addPdpNote() {
    var pdp = document.querySelector('#pdp:not([hidden]) .pdp-grid > div:last-child');
    if (!pdp || pdp.querySelector('.pdp-commerce-note')) return;
    var note = el('div', { class: 'pdp-commerce-note' });
    note.appendChild(el('strong', { text: 'Checkout-ready:' }));
    note.appendChild(document.createTextNode(' select a size, upload artwork if needed, and the cart opens with Shopify checkout behind it.'));
    pdp.appendChild(note);
  }

  function addMobileBuyBar() {
    if (document.querySelector('.mobile-buy-bar')) return;
    document.body.appendChild(el('div', { class: 'mobile-buy-bar', 'aria-label': 'Quick buying actions' }, [
      el('a', { class: 'btn btn-primary', href: '#builder', text: 'Build Sheet' }),
      el('a', { class: 'btn btn-ghost', href: '#shop', text: 'Shop Catalog' })
    ]));
  }

  function improveExternalishLabels() {
    document.querySelectorAll('a[href^="catalog-intake.html"]').forEach(function (a) {
      if (!a.getAttribute('aria-label')) a.setAttribute('aria-label', a.textContent.trim() + ' via quote intake');
    });
  }

  function run() {
    addTrustRail();
    addBuilderProof();
    addStepGraphics();
    addBuilderVisual();
    addProductBadges();
    addPdpNote();
    addMobileBuyBar();
    improveExternalishLabels();
  }

  window.addEventListener('DOMContentLoaded', run);
  window.addEventListener('content-loaded', run);
  window.addEventListener('hashchange', function () { setTimeout(run, 60); });
})();
