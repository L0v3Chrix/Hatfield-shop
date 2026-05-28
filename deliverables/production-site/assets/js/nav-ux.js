/* Hatfield McCoy DTF — commerce navigation interactions */
(function () {
  const SEARCH_ITEMS = [
    { label: '22" DTF Gang Sheets', type: 'Order online', href: '#pdp-dtf-22' },
    { label: '46" DTF Gang Sheets', type: 'Order online', href: '#pdp-dtf-46' },
    { label: 'Custom Gang Sheet Builder', type: 'Builder', href: '#builder' },
    { label: 'Glitter DTF', type: 'Order online', href: '#pdp-glitter-22' },
    { label: 'Glow DTF', type: 'Order online', href: '#pdp-glow-22' },
    { label: '24" Sublimation Gang Sheets', type: 'Order online', href: '#pdp-sublimation-24' },
    { label: '3D Printing', type: 'Order online', href: '#pdp-3d-print' },
    { label: 'UV DTF', type: 'Quote', href: 'catalog-intake.html?service=uv-dtf' },
    { label: 'Reflective DTF', type: 'Quote', href: 'catalog-intake.html?service=reflective-dtf' },
    { label: 'Embroidery', type: 'Quote', href: 'catalog-intake.html?service=embroidery' },
    { label: 'Banners', type: 'Quote', href: 'catalog-intake.html?service=banners' },
    { label: 'Die Cut Stickers', type: 'Quote', href: 'catalog-intake.html?service=stickers' },
    { label: 'Bulk / Wholesale', type: 'Apply', href: 'catalog-intake.html?service=wholesale' },
    { label: 'Shipping & Pickup', type: 'Info', href: '#shipping' },
    { label: 'File Requirements', type: 'Guide', href: '#file-requirements' },
    { label: 'FAQ', type: 'Help', href: '#faq' },
    { label: 'Contact', type: 'Help', href: '#contact' }
  ];

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function openMobile() {
    document.body.classList.add('nav-open');
    const drawer = qs('#mobile-nav');
    const btn = qs('.hamburger');
    if (drawer) drawer.setAttribute('aria-hidden', 'false');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function closeMobile() {
    document.body.classList.remove('nav-open');
    const drawer = qs('#mobile-nav');
    const btn = qs('.hamburger');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function closeDesktopMenus(except) {
    qsa('.nav-category.open').forEach(cat => {
      if (cat !== except) {
        cat.classList.remove('open');
        const b = qs('button', cat);
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function renderResults(input, popover) {
    const value = (input.value || '').trim().toLowerCase();
    popover.textContent = '';
    if (value.length < 2) {
      popover.classList.remove('active');
      return;
    }
    const hits = SEARCH_ITEMS.filter(item => item.label.toLowerCase().includes(value) || item.type.toLowerCase().includes(value)).slice(0, 8);
    if (!hits.length) {
      const empty = document.createElement('div');
      empty.className = 'search-hit';
      empty.textContent = 'No quick matches. Start an intake and we will route it.';
      popover.appendChild(empty);
    } else {
      hits.forEach(item => {
        const a = document.createElement('a');
        a.className = 'search-hit';
        a.href = item.href;
        a.textContent = item.label;
        const small = document.createElement('small');
        small.textContent = item.type;
        a.appendChild(small);
        a.addEventListener('click', closeMobile);
        popover.appendChild(a);
      });
    }
    popover.classList.add('active');
  }

  function wireSearch(inputSelector, popoverSelector) {
    const input = qs(inputSelector);
    const popover = qs(popoverSelector);
    if (!input || !popover) return;
    input.addEventListener('input', () => renderResults(input, popover));
    input.addEventListener('focus', () => renderResults(input, popover));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        popover.classList.remove('active');
      }
    });
  }

  function syncMobileCartCount() {
    const desktop = qs('#cart-count');
    const mobile = qs('#cart-count-mobile');
    if (!desktop || !mobile) return;
    mobile.textContent = desktop.textContent || '0';
  }

  window.addEventListener('cart:changed', syncMobileCartCount);

  window.addEventListener('DOMContentLoaded', function () {
    qsa('.hamburger').forEach(btn => btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (document.body.classList.contains('nav-open')) closeMobile(); else openMobile();
    }));
    const close = qs('.mobile-close');
    if (close) close.addEventListener('click', closeMobile);
    const drawer = qs('#mobile-nav');
    if (drawer) drawer.addEventListener('click', e => { if (e.target === drawer) closeMobile(); });
    qsa('#mobile-nav a').forEach(a => a.addEventListener('click', closeMobile));

    qsa('.nav-category > button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const cat = btn.closest('.nav-category');
        const next = !cat.classList.contains('open');
        closeDesktopMenus(cat);
        cat.classList.toggle('open', next);
        btn.setAttribute('aria-expanded', next ? 'true' : 'false');
      });
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-category')) closeDesktopMenus();
      if (!e.target.closest('.nav-actions') && !e.target.closest('.mobile-panel')) {
        qsa('.search-popover.active').forEach(p => p.classList.remove('active'));
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeMobile();
        closeDesktopMenus();
        qsa('.search-popover.active').forEach(p => p.classList.remove('active'));
      }
    });

    wireSearch('#site-search', '#site-search-results');
    wireSearch('#mobile-site-search', '#mobile-site-search-results');
    syncMobileCartCount();
  });
})();
