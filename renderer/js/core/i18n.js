/* Vextra Studio – interface languages.
 * English text in the interface is the source: a language is a dictionary {English text → translation}. Text, tooltips (title),
 * placeholders and aria-labels that match an entry are swapped live (and swapped back when you choose English), so every panel –
 * also plugin panels – is translated without changing any code. Text without an entry stays in English.
 * Plugins can add languages:  VX.i18n.register('nl', { name: 'Nederlands', dir: 'ltr', strings: { 'Settings': 'Instellingen' } })  */
(function () {
  const langs = new Map([['en', { name: 'English', dir: 'ltr', strings: {} }]]);
  const ATTRS = ['title', 'placeholder', 'aria-label'], SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|SVG|CANVAS|IFRAME)$/;
  let cur = 'en', dict = {}, busy = false, obs = null;
  const orig = new WeakMap(); // Text node → {src, out};  Element → {attr: {src, out}}
  const suffix = /^(.*?)(\s*\([^()]*\))$/;
  function lookup(s) {
    const t = s.trim(); if (!t || !Object.keys(dict).length) return null;
    if (dict[t] != null) return dict[t];
    const m = suffix.exec(t); if (m && dict[m[1].trim()] != null) return dict[m[1].trim()] + m[2]; // "Explorer (Ctrl+Shift+E)"
    return null;
  }
  const skip = (el) => !el || SKIP.test(el.tagName) || (el.closest && el.closest('[data-no-i18n],.ace_editor,.docs-body,.preview-frame'));
  function doText(n) {
    const rec = orig.get(n), v = n.nodeValue;
    if (rec && v !== rec.out) orig.delete(n); // changed by the app since: new source text
    const r2 = orig.get(n), src = r2 ? r2.src : v, tr = cur === 'en' ? null : lookup(src);
    if (tr == null) { if (r2) { n.nodeValue = r2.src; orig.delete(n); } return; }
    const lead = /^\s*/.exec(src)[0], trail = /\s*$/.exec(src)[0], out = lead + tr + trail; orig.set(n, { src, out }); if (n.nodeValue !== out) n.nodeValue = out;
  }
  function doAttrs(el) {
    let rec = orig.get(el); for (const a of ATTRS) {
      const v = el.getAttribute(a); if (v == null) continue; const r = rec && rec[a]; if (r && v !== r.out) { delete rec[a]; }
      const r2 = rec && rec[a], src = r2 ? r2.src : v, tr = cur === 'en' ? null : lookup(src);
      if (tr == null) { if (r2) { el.setAttribute(a, r2.src); delete rec[a]; } continue; }
      if (!rec) { rec = {}; orig.set(el, rec); } rec[a] = { src, out: tr }; if (v !== tr) el.setAttribute(a, tr);
    }
  }
  function walk(root) {
    if (!root) return; if (root.nodeType === 3) { if (!skip(root.parentElement)) doText(root); return; } if (root.nodeType !== 1 || skip(root)) return;
    doAttrs(root); const tw = document.createTreeWalker(root, 5); let n = tw.nextNode();
    while (n) { if (n.nodeType === 3) { if (!skip(n.parentElement)) doText(n); } else if (SKIP.test(n.tagName) || (n.closest && n.closest('[data-no-i18n]'))) { /* skip subtree attrs only */ } else doAttrs(n); n = tw.nextNode(); }
  }
  function run(fn) { busy = true; try { fn(); } finally { busy = false; } }
  function start() {
    if (obs) return; obs = new MutationObserver((ms) => { if (busy) return; run(() => { for (const m of ms) { if (m.type === 'childList') m.addedNodes.forEach((x) => walk(x)); else if (m.type === 'characterData') { if (!skip(m.target.parentElement)) doText(m.target); } else if (m.type === 'attributes') { if (!skip(m.target)) doAttrs(m.target); } } }); });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function resolve(code) {
    if (!code || code === 'auto') { const n = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((x) => String(x).toLowerCase()); for (const l of n) { const b = l.split('-')[0]; if (langs.has(b)) return b; } return 'en'; }
    return langs.has(code) ? code : 'en';
  }
  const i18n = (VX.i18n = {
    register(code, def) { if (!code || !def || typeof def.strings !== 'object') throw new Error('Language needs a code and strings'); langs.set(String(code), { name: def.name || code, dir: def.dir === 'rtl' ? 'rtl' : 'ltr', strings: def.strings }); VX.emit('languages'); },
    list: () => [...langs].map(([code, d]) => ({ code, name: d.name, dir: d.dir })),
    get current() { return cur; },
    /** translate a string from code (returns the English text when there is no entry) */
    t: (s) => { const tr = cur === 'en' ? null : lookup(String(s)); return tr == null ? String(s) : tr; },
    set(code) {
      const c = resolve(code); cur = c; const d = langs.get(c); dict = d.strings || {};
      document.documentElement.lang = c; document.documentElement.dir = d.dir; document.body.dataset.dir = d.dir;
      run(() => walk(document.body)); VX.emit('language', c, d); return c;
    },
    init(code) { start(); return i18n.set(code); },
    /** how many interface strings the language covers (for the Settings page) */
    count: (code) => Object.keys((langs.get(code) || {}).strings || {}).length,
  });
})();
