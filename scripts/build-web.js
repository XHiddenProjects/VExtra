#!/usr/bin/env node
/* Builds the static "live demo" of Vextra Studio for GitHub Pages (or any static host).
   It is the normal browser build (renderer/ + renderer/vendor) plus:
     • __ext/plugins and __ext/themes – what `npm run web` serves on the fly (the built-in plugins and themes), written as files
     • a small "demo" bar (demo.js) that explains what is different from the desktop app
     • .nojekyll so GitHub Pages serves every file as it is
   Every path in the app is relative, so the site works under https://user.github.io/repo/ as well as on a custom domain.
   Usage: node scripts/build-web.js [--out dist-web] */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), src = path.join(root, 'renderer');
const oi = process.argv.indexOf('--out'), out = path.resolve(root, oi > 0 ? process.argv[oi + 1] : 'dist-web');
if (out === root || out === src || !out.startsWith(root)) { console.error('--out must be a folder inside the project (not the project itself)'); process.exit(1); }
if (!fs.existsSync(path.join(src, 'vendor', 'three'))) { console.log('[web] renderer/vendor is missing – running scripts/vendor.js'); cp.execFileSync(process.execPath, [path.join(__dirname, 'vendor.js')], { stdio: 'inherit' }); }

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

for (const kind of ['plugins', 'themes']) {
  const d = path.join(root, kind); fs.mkdirSync(path.join(out, '__ext'), { recursive: true });
  const list = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => !f.startsWith('.')).map((f) => ({ file: f, content: fs.readFileSync(path.join(d, f), 'utf8') })) : [];
  fs.writeFileSync(path.join(out, '__ext', kind), JSON.stringify(list));
}

const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const repo = process.env.GITHUB_REPOSITORY || '';
const demo = `/* Live demo bar – added by scripts/build-web.js (not part of the desktop app). */
(function () {
  window.__VX_DEMO = true;
  try { if (sessionStorage.getItem('vx-demo-bar') === 'x') return; } catch (e) { /* storage blocked */ }
  var css = document.createElement('style');
  css.textContent = '.vx-demo{position:fixed;z-index:99999;left:50%;bottom:12px;transform:translateX(-50%);max-width:min(860px,calc(100vw - 24px));display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:10px;background:#1f2430;color:#e8ecf4;border:1px solid #3a4256;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px #0008}.vx-demo b{color:#ffb347}.vx-demo a{color:#7cc4ff}.vx-demo button{all:unset;cursor:pointer;padding:2px 8px;border-radius:6px;color:#aab}.vx-demo button:hover{background:#ffffff18}';
  document.head.appendChild(css);
  var bar = document.createElement('div'); bar.className = 'vx-demo';
  bar.innerHTML = '<span><b>Live demo</b> v${version} – runs entirely in your browser; projects stay in this browser only. Accounts, collaboration, publishing and local files need the <a target="_blank" rel="noopener" href="${repo ? 'https://github.com/' + repo + '/releases/latest' : '#'}">desktop app</a>.</span><button title="Hide" aria-label="Hide">✕</button>';
  bar.querySelector('button').onclick = function () { bar.remove(); try { sessionStorage.setItem('vx-demo-bar', 'x'); } catch (e) { /* ignore */ } };
  document.body.appendChild(bar);
})();
`;
fs.writeFileSync(path.join(out, 'demo.js'), demo);
const idx = path.join(out, 'index.html'); let html = fs.readFileSync(idx, 'utf8');
if (!html.includes('</body>')) { console.error('[web] index.html has no </body>'); process.exit(1); }
if (!/<head[^>]*>/i.test(html)) { console.error('[web] index.html has no <head>'); process.exit(1); }
html = html.replace(/<head[^>]*>/i, (m) => m + '\n<script>window.__VX_DEMO = true;</script>').replace('</body>', '<script src="demo.js"></script>\n</body>');
fs.writeFileSync(idx, html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');

const size = (p) => fs.readdirSync(p, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(p, e.name)) : fs.statSync(path.join(p, e.name)).size), 0);
console.log(`[web] built ${path.relative(root, out)}/  (${(size(out) / 1e6).toFixed(1)} MB, v${version})`);
