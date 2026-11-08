/* Loading page for exported / played games. It is always shown (it carries the Vextra Studio credit) and is customizable:
   Game settings → Loading page… . Everything the user types is escaped; colours are validated. */
(function () {
  const esc = VX.esc;
  const DEF = { title: '', subtitle: 'Loading…', bg: '', color: '#e8ecf8', accent: '#6c8cff', style: 'bar', logo: '', tips: '', minSec: 1.5, showPercent: true, creditAt: 'bottom' };
  const get = (project) => { const s = (project.settings = project.settings || {}); const L = Object.assign({}, DEF, s.loading || {}); L.style = ['bar', 'ring', 'dots'].includes(L.style) ? L.style : 'bar'; L.creditAt = L.creditAt === 'top' ? 'top' : 'bottom'; L.minSec = Math.max(0, Math.min(10, +L.minSec || 0)); return L; };
  const logoSrc = (project, id) => { const sp = id && project.assets && project.assets.sprites && project.assets.sprites[id]; const f = sp && sp.frames && sp.frames[0]; return typeof f === 'string' && /^data:image\//.test(f) ? f : ''; };
  /** returns { css, html, script } to put into the page: css in <style>, html first in <body>, script (plain) in <head> */
  function build(project, opts = {}) {
    const L = get(project), C = VX.credit, st = project.settings;
    const bg = C.safeColor(L.bg, C.safeColor(st.bg, '#10131a')), fg = C.safeColor(L.color, DEF.color), ac = C.safeColor(L.accent, DEF.accent);
    const title = L.title || st.title || 'Vextra game'; const logo = logoSrc(project, L.logo);
    const tips = String(L.tips || '').split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const spinner = L.style === 'ring' ? '<div class="vxl-ring"></div>' : L.style === 'dots' ? '<div class="vxl-dots"><i></i><i></i><i></i></div>' : '<div class="vxl-bar"><i></i></div>';
    const credit = `<div class="vxl-credit ${L.creditAt}">Made with <strong>${esc(C.app)}</strong> · &copy; ${C.year()} ${esc(C.owner)}</div>`;
    const css = `#vx-boot{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bg};color:${fg};font:15px system-ui,-apple-system,Segoe UI,sans-serif;transition:opacity .4s ease;text-align:center;padding:24px;box-sizing:border-box}#vx-boot.out{opacity:0;pointer-events:none}
#vx-boot .vxl-logo{max-width:160px;max-height:160px;margin-bottom:18px;image-rendering:auto}#vx-boot h1{margin:0 0 6px;font-size:28px;font-weight:700;letter-spacing:.3px}#vx-boot .vxl-sub{opacity:.75;margin-bottom:22px;min-height:1.2em}
#vx-boot .vxl-bar{width:min(320px,70vw);height:8px;border-radius:99px;background:${fg}22;overflow:hidden}#vx-boot .vxl-bar i{display:block;height:100%;width:0;background:${ac};border-radius:99px;transition:width .25s ease}
#vx-boot .vxl-ring{width:42px;height:42px;border-radius:50%;border:4px solid ${fg}22;border-top-color:${ac};animation:vxl-spin 1s linear infinite}#vx-boot .vxl-dots{display:flex;gap:8px}#vx-boot .vxl-dots i{width:10px;height:10px;border-radius:50%;background:${ac};animation:vxl-bounce 1s infinite ease-in-out}#vx-boot .vxl-dots i:nth-child(2){animation-delay:.15s}#vx-boot .vxl-dots i:nth-child(3){animation-delay:.3s}
#vx-boot .vxl-pct{margin-top:10px;font-size:13px;opacity:.7;min-height:1.2em}#vx-boot .vxl-tip{margin-top:18px;font-size:13px;opacity:.7;max-width:420px;min-height:1.4em}#vx-boot .vxl-err{margin-top:16px;color:#ff8a8a;max-width:520px;white-space:pre-wrap;font-size:13px}
#vx-boot .vxl-credit{position:absolute;left:0;right:0;${L.creditAt === 'top' ? 'top' : 'bottom'}:14px;font-size:12px;opacity:.65}
@keyframes vxl-spin{to{transform:rotate(360deg)}}@keyframes vxl-bounce{0%,80%,100%{transform:scale(.5);opacity:.5}40%{transform:scale(1);opacity:1}}@media (prefers-reduced-motion:reduce){#vx-boot,#vx-boot .vxl-bar i{transition:none}#vx-boot .vxl-ring,#vx-boot .vxl-dots i{animation-duration:3s}}`;
    const html = `<div id="vx-boot" role="status" aria-live="polite" aria-label="Loading">${credit.includes('top') ? credit : ''}${logo ? `<img class="vxl-logo" alt="" src="${esc(logo)}">` : ''}<h1>${esc(title)}</h1><div class="vxl-sub">${esc(L.subtitle)}</div>${spinner}<div class="vxl-pct">${L.showPercent && L.style === 'bar' ? '0%' : ''}</div><div class="vxl-tip"></div><div class="vxl-err"></div>${credit.includes('top') ? '' : credit}</div>`;
    const min = opts.preview ? 0 : (opts.channel ? 0 : L.minSec) * 1000;
    const script = `(function(){var t0=Date.now(),tips=${VX.jsLit(tips)},min=${min},showPct=${L.showPercent ? 'true' : 'false'},ti=0,timer=null,p=0;function q(s){return document.querySelector('#vx-boot '+s)}
window.__vxl={reset:function(){p=0;var b=q('.vxl-bar i');if(b)b.style.width='0'},set:function(v){p=Math.max(p,Math.min(1,v));var b=q('.vxl-bar i');if(b)b.style.width=(p*100)+'%';var c=q('.vxl-pct');if(c&&showPct&&b)c.textContent=Math.round(p*100)+'%'},
finish:function(){var self=this;return new Promise(function(r){var wait=Math.max(0,min-(Date.now()-t0));setTimeout(function(){self.set(1);setTimeout(r,120)},wait)})},
hide:function(){var e=document.getElementById('vx-boot');if(!e)return;e.classList.add('out');clearInterval(timer);setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},450)},
fail:function(m){clearInterval(timer);var e=q('.vxl-err');if(e)e.textContent=m;var s=q('.vxl-sub');if(s)s.textContent='Could not start'}};
function tip(){var e=q('.vxl-tip');if(e&&tips.length){e.textContent=tips[ti++%tips.length]}}
document.addEventListener('DOMContentLoaded',function(){tip();if(tips.length>1)timer=setInterval(tip,2600)});})();`;
    return { css, html, script };
  }
  /** the form in Game settings → Loading page… */
  async function edit(ed) {
    const project = ed.project, L = get(project); const sprites = Object.entries((project.assets && project.assets.sprites) || {});
    const v = await VX.ui.form({ title: 'Loading page', submit: 'Save', fields: [
      { key: 'title', label: 'Title (blank = game title)', value: L.title, placeholder: project.settings.title || '' }, { key: 'subtitle', label: 'Subtitle', value: L.subtitle },
      { key: 'style', label: 'Progress style', type: 'select', value: L.style, options: [['bar', 'Progress bar'], ['ring', 'Spinner'], ['dots', 'Bouncing dots']] },
      { key: 'bg', label: 'Background (blank = game background)', type: 'color', value: C0(L.bg, project.settings.bg || '#10131a') }, { key: 'color', label: 'Text colour', type: 'color', value: C0(L.color, DEF.color) }, { key: 'accent', label: 'Accent colour', type: 'color', value: C0(L.accent, DEF.accent) },
      { key: 'logo', label: 'Logo (one of your sprites)', type: 'select', value: L.logo, options: [['', '(none)']].concat(sprites.map(([id, s]) => [id, s.name || id])) },
      { key: 'tips', label: 'Tips (one per line, shown in turn)', type: 'textarea', rows: 4, value: L.tips, placeholder: 'Press Space to jump\nCollect all the coins' },
      { key: 'minSec', label: 'Show for at least (seconds)', type: 'number', value: L.minSec }, { key: 'showPercent', label: 'Show the percentage (progress bar)', type: 'checkbox', value: L.showPercent },
      { key: 'creditAt', label: 'Credit line position', type: 'select', value: L.creditAt, options: [['bottom', 'Bottom'], ['top', 'Top']], hint: `The loading page always shows “${VX.credit.text()}”. You can move it and change the text colour, not remove it.` }] });
    if (!v) return false; project.settings.loading = { title: v.title.trim(), subtitle: v.subtitle.trim(), style: v.style, bg: v.bg, color: v.color, accent: v.accent, logo: v.logo, tips: v.tips, minSec: Math.max(0, Math.min(10, v.minSec || 0)), showPercent: v.showPercent, creditAt: v.creditAt }; return true;
  }
  const C0 = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : /^#[0-9a-f]{6}$/i.test(d) ? d : '#10131a');
  /** a standalone page that animates the loader, for the preview dialog */
  function previewPage(project) { const b = build(project, { preview: true }); return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}${b.css}</style><script>${b.script}</script><body>${b.html}<script>var v=0;setInterval(function(){if(v>=1){v=0;__vxl.reset()}else v+=.12;__vxl.set(v)},300);</script></body>`; }
  VX.gameLoader = { get, build, edit, previewPage, DEF };
})();
