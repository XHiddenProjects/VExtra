/* Vextra Studio – accessibility helpers (see ACCESSIBILITY.md).
 *  • landmarks, roles and accessible names for icon-only controls (added automatically, also for plugin panels)
 *  • dialogs: role="dialog", focus moves in, Tab stays inside, Esc closes (ui.js), focus returns to where it was
 *  • a polite live announcer (toasts, tab changes, selections in the canvas editors) – VX.a11y.announce(text)
 *  • skip link, visible keyboard focus, reduced motion (system or forced), interface zoom, high-contrast themes (themes/)
 *  • VX.a11y.reduceMotion() – also read by the game runtime to tone down screen shake */
(function () {
  const { h } = VX; const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let live = null, lastTimer = 0, obs = null, mq = null;
  const T = (s) => (VX.i18n ? VX.i18n.t(s) : s);
  const set = (el, a, v) => { if (el && !el.hasAttribute(a)) el.setAttribute(a, v); };
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  function landmarks() {
    const m = (sel, role, label) => { const e = document.querySelector(sel); if (e) { set(e, 'role', role); if (label) set(e, 'aria-label', label); } };
    m('#activity', 'navigation', 'Views'); m('#sidebar', 'complementary', 'Side panel'); m('#main', 'main'); m('#tabbar', 'tablist', 'Open files'); m('#toolbar', 'toolbar', 'Tools'); m('#statusbar', 'contentinfo', 'Status'); m('#bottom', 'region', 'Output panel');
    const t = document.querySelector('#toasts'); if (t) { set(t, 'role', 'status'); set(t, 'aria-live', 'polite'); }
  }
  /** names for icon-only buttons, inputs without a label, images */
  function label(el) {
    if (el.nodeType !== 1) return; const all = el.matches && el.matches('button,[role=button],input,select,textarea,img,svg,[role=tab]') ? [el] : []; el.querySelectorAll && all.push(...el.querySelectorAll('button,[role=button],input,select,textarea,img,[role=tab]'));
    for (const e of all) {
      const tag = e.tagName; if (tag === 'IMG') { if (!e.hasAttribute('alt')) e.setAttribute('alt', ''); continue; }
      if (e.hasAttribute('aria-label') || e.hasAttribute('aria-labelledby')) continue;
      if (tag === 'BUTTON' || e.getAttribute('role') === 'button' || e.getAttribute('role') === 'tab') { if (!(e.textContent || '').trim() && e.title) e.setAttribute('aria-label', e.title); }
      else if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { if (e.type === 'checkbox' || e.type === 'radio' ? false : true) { const l = e.closest('label'); if (!l && !(e.id && document.querySelector('label[for="' + CSS.escape(e.id) + '"]'))) { const t = e.title || e.placeholder || (e.closest('.srow') && e.closest('.srow').querySelector('.l b') && e.closest('.srow').querySelector('.l b').textContent); if (t) e.setAttribute('aria-label', t); } } }
    }
    const kids = el.querySelectorAll ? [el, ...el.querySelectorAll('.tab,.switch,.tile')] : [el];
    for (const k of kids) { const c = k.classList; if (!c) continue; if (c.contains('tab')) { set(k, 'role', 'tab'); set(k, 'tabindex', '0'); k.setAttribute('aria-selected', c.contains('active') ? 'true' : 'false'); } else if (c.contains('tile')) { set(k, 'role', 'button'); set(k, 'tabindex', '0'); } else if (c.contains('switch')) { set(k, 'role', 'switch'); k.setAttribute('aria-checked', c.contains('on') ? 'true' : 'false'); } }
  }
  /* Enter / Space activates tabs and tiles (they are divs) */
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=tab],.tile[role=button]') && !e.target.matches('input,textarea')) { e.preventDefault(); e.target.click(); } });
  function dialogs(added) {
    for (const o of added) { if (o.nodeType !== 1 || !o.classList.contains('overlay')) continue; const m = o.querySelector('.modal'); if (!m) continue;
      set(m, 'role', 'dialog'); set(m, 'aria-modal', 'true'); const hd = m.querySelector('.modal-head span'); if (hd && hd.textContent) set(m, 'aria-label', hd.textContent); else { const msg = m.querySelector('.ask-msg'); if (msg) set(m, 'aria-label', msg.textContent.slice(0, 80)); }
      o._vxPrev = document.activeElement; const first = () => { const f = [...m.querySelectorAll('input,textarea,select')].find(visible) || [...m.querySelectorAll(FOCUSABLE)].filter(visible).find((b) => !b.closest('.modal-head')) || m.querySelector(FOCUSABLE); if (f) f.focus({ preventScroll: true }); else { m.tabIndex = -1; m.focus(); } }; setTimeout(first, 0); }
  }
  function restore(removed) { for (const o of removed) if (o.nodeType === 1 && o._vxPrev && o.classList.contains('overlay')) { const p = o._vxPrev; setTimeout(() => { if (p.isConnected && !document.querySelector('#overlays .overlay')) try { p.focus({ preventScroll: true }); } catch { /* gone */ } }, 0); } }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return; const ov = document.querySelectorAll('#overlays .overlay'); if (!ov.length) return; const m = ov[ov.length - 1].querySelector('.modal'); if (!m) return;
    const f = [...m.querySelectorAll(FOCUSABLE)].filter(visible); if (!f.length) { e.preventDefault(); return; }
    const a = document.activeElement, i = f.indexOf(a);
    if (!m.contains(a)) { e.preventDefault(); f[0].focus(); } else if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }, true);

  function announce(text, assertive) {
    if (!live) return; const t = String(text || '').trim(); if (!t) return; const el = assertive ? live.a : live.p; clearTimeout(lastTimer); el.textContent = '';
    lastTimer = setTimeout(() => { el.textContent = t; }, 30); // re-set so the same message is read again
  }
  function reduceMotion() { const m = VX.app && VX.app.settings && VX.app.settings.motion; if (m === 'reduce') return true; if (m === 'full') return false; return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function applyPrefs() {
    const s = (VX.app && VX.app.settings) || {}; document.body.classList.toggle('reduce-motion', reduceMotion());
    const z = Math.min(200, Math.max(70, +s.uiZoom || 100)); document.documentElement.style.zoom = z === 100 ? '' : String(z / 100);
    document.body.classList.toggle('big-focus', !!s.bigFocus);
  }
  function init() {
    if (live) return; const skip = h('a', { class: 'skip-link', href: '#main', onclick: (e) => { e.preventDefault(); const t = document.querySelector('#stage .host.on,#stage .host:not(.hidden)') || document.querySelector('#main'); if (t) { t.tabIndex = -1; t.focus(); } } }, 'Skip to the editor');
    live = { p: h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true', role: 'status', 'data-no-i18n': '' }), a: h('div', { class: 'sr-only', 'aria-live': 'assertive', 'aria-atomic': 'true', role: 'alert', 'data-no-i18n': '' }) };
    document.body.prepend(skip); document.body.append(live.p, live.a); landmarks(); label(document.body);
    obs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'childList') { m.addedNodes.forEach((n) => { if (n.nodeType === 1) { label(n); if (n.classList.contains('toast')) announce(n.textContent, n.classList.contains('error')); } }); dialogs(m.addedNodes); restore(m.removedNodes); } else if (m.type === 'attributes' && m.target.nodeType === 1) { if (m.attributeName === 'class') { const c = m.target.classList; if (c.contains('switch')) m.target.setAttribute('aria-checked', c.contains('on') ? 'true' : 'false'); else if (c.contains('tab')) m.target.setAttribute('aria-selected', c.contains('active') ? 'true' : 'false'); } else label(m.target); } } });
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'placeholder', 'class'] });
    if (window.matchMedia) { mq = matchMedia('(prefers-reduced-motion: reduce)'); (mq.addEventListener ? mq.addEventListener('change', applyPrefs) : mq.addListener && mq.addListener(applyPrefs)); }
    VX.on('settings', (k) => { if (['motion', 'uiZoom', 'bigFocus'].includes(k)) applyPrefs(); });
    VX.on('tabChange', (t) => t && announce((t.title || '') + ' opened'));
    applyPrefs();
  }
  VX.a11y = { init, announce, reduceMotion, applyPrefs, label };
})();
