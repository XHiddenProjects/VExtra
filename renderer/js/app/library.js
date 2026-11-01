/* Vextra Studio – Library: install website templates and 2D / 3D games, from the built-in defaults or from a URL.
 * URL can be: a .vxgame file, a .zip (game or website), a single .html page, a GitHub repository link, or a library index (.json: { name, items:[{ name, desc, type, url }] }). */
(function () {
  const { h } = VX; const S = VX.app.S;
  const DEFAULT_SOURCES = ['https://raw.githubusercontent.com/XHiddenProjects/VExtraStudio/master/library/index.json'];
  const MAX_FILES = 3000;
  const lib = (VX.library = { index: new Map(), loading: new Set() });

  const GAMES = [
    { id: 'demo2d', name: 'Platformer demo (2D)', desc: 'Run, jump and collect coins. A complete small game to learn from.', type: 'game2d', build: () => VX.GameProject.blank({ name: 'Platformer demo', dim: '2d', sample: true }) },
    { id: 'demo3d', name: 'First-person demo (3D)', desc: 'Walk around a 3D scene, collect gems, WASD + mouse look.', type: 'game3d', build: () => VX.GameProject.blank({ name: 'First-person demo', dim: '3d', sample: true }) },
    { id: 'blank2d', name: 'Blank 2D game', desc: 'An empty 2D scene.', type: 'game2d', build: () => VX.GameProject.blank({ name: 'My 2D game', dim: '2d' }) },
    { id: 'blank3d', name: 'Blank 3D game', desc: 'An empty 3D scene.', type: 'game3d', build: () => VX.GameProject.blank({ name: 'My 3D game', dim: '3d' }) },
  ];
  lib.defaults = () => ({ websites: VX.templates.list().map((t) => ({ id: t.id, name: t.name, desc: t.desc, type: 'website', template: t.id })), games: GAMES });
  lib.sources = () => (VX.app.settings.librarySources && VX.app.settings.librarySources.length ? VX.app.settings.librarySources : DEFAULT_SOURCES);
  lib.installed = () => VX.app.settings.libraryInstalled || [];
  const remember = (rec) => { const l = lib.installed().filter((x) => x.url !== rec.url); l.unshift(Object.assign({ at: Date.now() }, rec)); VX.app.set('libraryInstalled', l.slice(0, 50)); VX.emit('library'); };

  /* ---------- URL handling ---------- */
  function normalize(url) {
    url = String(url || '').trim(); if (!/^https:\/\//i.test(url)) throw new Error('Only https:// links are supported.');
    const u = new URL(url); const host = u.hostname.toLowerCase();
    if (host === 'github.com') {
      const p = u.pathname.split('/').filter(Boolean); if (p.length >= 2 && !/\.(zip|json|html?|vxgame)$/i.test(u.pathname)) { const [o, r0] = p; const r = r0.replace(/\.git$/, ''); const br = p[2] === 'tree' && p[3] ? p.slice(3).join('/') : null; return { kind: 'repo', owner: o, repo: r, branch: br, zips: br ? [`https://codeload.github.com/${o}/${r}/zip/refs/heads/${br}`] : [`https://codeload.github.com/${o}/${r}/zip/refs/heads/main`, `https://codeload.github.com/${o}/${r}/zip/refs/heads/master`], url }; }
      if (p[2] === 'blob') return { kind: 'file', url: `https://raw.githubusercontent.com/${p[0]}/${p[1]}/${p.slice(3).join('/')}` };
    }
    return { kind: 'file', url };
  }
  const safePath = (p) => { const s = String(p).replace(/\\/g, '/').replace(/^\/+/, ''); if (!s || s.split('/').some((x) => x === '..' || x === '')) return null; return s; };
  const b64ToU8 = (b) => VX.archive.fromB64(b);
  const isZip = (u8) => u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b;

  /** Fetch + analyse a link. Returns { type:'game'|'website'|'index', name, ... } without installing anything. */
  lib.inspect = async function (input) {
    const n = normalize(input); let bytes = null, text = null, finalUrl = n.url;
    if (n.kind === 'repo') { let err; for (const z of n.zips) { try { bytes = b64ToU8(await window.native.httpDownload(z)); finalUrl = z; break; } catch (e) { err = e; } } if (!bytes) throw new Error('Could not download the repository (' + (err && err.message) + ').'); }
    else if (/\.(zip)(\?|$)/i.test(n.url)) bytes = b64ToU8(await window.native.httpDownload(n.url));
    else { const r = await window.native.http({ method: 'GET', url: n.url }); if (r.status !== 200) throw new Error(r.status === 404 ? 'Not found (404).' : 'The server answered HTTP ' + r.status + '.'); text = r.body; }
    if (!bytes && text && /^PK/.test(text.slice(0, 2))) bytes = b64ToU8(await window.native.httpDownload(n.url));
    const host = new URL(finalUrl).hostname;
    if (bytes) {
      if (!isZip(bytes)) throw new Error('That file is not a ZIP archive.'); const entries = (await VX.archive.unzip(bytes)).filter((e) => !e.dir && safePath(e.path) && !/(^|\/)(__MACOSX|\.git)(\/|$)/.test(e.path));
      if (!entries.length) throw new Error('The ZIP is empty.'); if (entries.length > MAX_FILES) throw new Error('The ZIP has too many files.');
      const tops = new Set(entries.map((e) => e.path.split('/')[0])); const strip = tops.size === 1 && entries.every((e) => e.path.includes('/')) ? [...tops][0] + '/' : ''; const files = entries.map((e) => ({ path: e.path.slice(strip.length), data: e.data })).filter((f) => f.path);
      const gf = files.find((f) => /\.vxgame$/i.test(f.path)); if (gf) { const proj = JSON.parse(new TextDecoder().decode(gf.data)); return { type: 'game', host, name: (proj.settings && proj.settings.title) || gf.path.replace(/\.vxgame$/i, ''), project: proj, dim: (proj.scenes && proj.scenes[0] && proj.scenes[0].dim) || '2d', size: bytes.length };
      }
      if (!files.some((f) => /(^|\/)index\.html?$/i.test(f.path) || /\.html?$/i.test(f.path))) throw new Error('This ZIP has no .vxgame file or HTML page, so it is not a Vextra game or website.');
      return { type: 'website', host, name: (n.repo || strip.replace(/\/$/, '') || 'website'), files, size: bytes.length };
    }
    const t = String(text || '').trim();
    if (t.startsWith('{')) { let j; try { j = JSON.parse(t); } catch { throw new Error('This link is not valid JSON.'); }
      if (j.format === 'vextra-game' || j.scenes) return { type: 'game', host, name: (j.settings && j.settings.title) || 'Imported game', project: j, dim: (j.scenes && j.scenes[0] && j.scenes[0].dim) || '2d', size: t.length };
      if (Array.isArray(j.items)) return { type: 'index', host, name: j.name || host, items: j.items.filter((i) => i && i.name && /^https:\/\//.test(String(i.url || ''))).map((i) => ({ name: String(i.name).slice(0, 80), desc: String(i.desc || '').slice(0, 200), type: ['website', 'game2d', 'game3d'].includes(i.type) ? i.type : 'website', url: i.url })) };
      throw new Error('This JSON file is neither a Vextra game nor a library index.'); }
    if (/<(html|!doctype|body|head)/i.test(t.slice(0, 2000))) return { type: 'website', host, name: new URL(finalUrl).pathname.split('/').pop().replace(/\.html?$/i, '') || 'page', files: [{ path: 'index.html', data: new TextEncoder().encode(t) }], size: t.length };
    throw new Error('Could not tell what this link is. Use a .vxgame, .zip, .html, GitHub repository or library index link.');
  };

  /* ---------- installing ---------- */
  async function chooseParent() { if (window.native.isDesktop) return window.native.openFolder(); return '/projects'; }
  async function writeSite(name, files, nameHint) {
    const parent = await chooseParent(); if (!parent) return false; const nm = String(name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'website'; const dir = VX.path.join(parent, nm);
    if (await window.native.exists(dir) && !(await VX.ui.confirm(`${nm} already exists in that folder. Add the files to it anyway?`, 'Continue'))) return false;
    for (const f of files) { const rel = safePath(f.path); if (!rel) continue; const isText = /\.(html?|css|js|mjs|json|txt|md|php|sql|xml|svg|conf|htaccess|ya?ml|csv|ini|env|ts|tsx|jsx|vue|scss|less|map|webmanifest)$/i.test(rel) || !/\./.test(rel.split('/').pop()) || /^\./.test(rel.split('/').pop());
      if (isText) await window.native.writeFile(VX.path.join(dir, rel), typeof f.data === 'string' ? f.data : new TextDecoder().decode(f.data)); else await window.native.writeBase64(VX.path.join(dir, rel), VX.archive.toB64(f.data)); }
    await VX.tabs.closeAll(); await VX.app.openRoot(dir); const idx = files.find((f) => /^index\.html?$/i.test(f.path)); if (idx) await VX.tabs.open({ path: VX.path.join(dir, idx.path) }); return dir;
  }
  lib.installGame = async function (project, name, url) {
    const proj = VX.GameProject.normalize(project); const t = await VX.tabs.open({ kind: 'game', key: VX.uid('game'), title: String(name || 'game').replace(/[^\w .-]+/g, '') + '.vxgame', text: JSON.stringify(proj, null, 2), startDirty: true }); if (t) { VX.sidebar.show('create'); VX.ui.toast('Game opened – press Ctrl+S to save it somewhere', 'ok'); if (url) remember({ name, url, type: proj.scenes[0].dim === '3d' ? 'game3d' : 'game2d' }); } return t;
  };
  /** Full flow for a URL: inspect → confirm → install. */
  lib.installUrl = async function (input, opts) {
    opts = opts || {}; let info; const stop = VX.ui.toast('Checking ' + input + ' …', 'info');
    try { info = await lib.inspect(input); } catch (e) { VX.ui.toast(e.message, 'error'); throw e; }
    if (info.type === 'index') { lib.index.set(input, info); VX.emit('library'); VX.ui.toast(`Added “${info.name}” – ${info.items.length} items`, 'ok'); if (!lib.sources().includes(input) && opts.addSource !== false) VX.app.set('librarySources', [...lib.sources(), input]); return info; }
    const what = info.type === 'game' ? `the ${info.dim === '3d' ? '3D' : '2D'} game “${info.name}”` : `the website “${info.name}” (${info.files.length} file${info.files.length === 1 ? '' : 's'})`;
    if (!opts.trusted && !(await VX.ui.confirm(`Install ${what} from ${info.host}?\n\nOnly install things from people you trust: games and websites can run scripts. Website previews run in a sandbox, and nothing is run until you press Play or Preview.`, 'Install'))) return null;
    if (info.type === 'game') { await lib.installGame(info.project, info.name, input); return info; }
    const dir = await writeSite(info.name, info.files); if (dir) { remember({ name: info.name, url: input, type: 'website' }); VX.ui.toast('Installed to ' + dir, 'ok'); } return info;
  };
  lib.installDefault = async function (it) {
    if (it.template) { return VX.app.newProject(it.template); }
    const p = it.build(); return lib.installGame(p, it.name);
  };
  lib.loadSource = async function (url, force) {
    if (!force && lib.index.has(url)) return lib.index.get(url); if (lib.loading.has(url)) return null; lib.loading.add(url);
    try { const info = await lib.inspect(url); if (info.type === 'index') lib.index.set(url, info); } catch (e) { lib.index.set(url, { type: 'index', name: new URL(url).hostname, items: [], error: e.message }); } finally { lib.loading.delete(url); VX.emit('library'); }
    return lib.index.get(url);
  };

  /* ---------- UI ---------- */
  const card = (it, onInstall, tag) => h('div', { class: 'lib-card' }, h('div', { class: 'lib-ic' }, it.type === 'website' ? '🌐' : it.type === 'game3d' ? '🧊' : '🎮'), h('div', { class: 'lib-tx' }, h('b', {}, it.name), h('span', {}, it.desc || '')), h('button', { class: 'btn sm primary', onclick: onInstall }, tag || 'Install'));
  SB_view();
  function SB_view() {
    VX.sidebar.views.library = { title: 'Library', actions: () => [VX.h('button', { title: 'Refresh sources', onclick: () => { lib.index.clear(); VX.sidebar.refresh(); } }, VX.icon('refresh', 15))], render(c) { renderPanel(c); } };
  }
  function renderPanel(c) {
    const url = h('input', { class: 'search-input', placeholder: 'https://…  .vxgame / .zip / .html / GitHub repo / index.json', onkeydown: (e) => { if (e.key === 'Enter') go(); } });
    const go = async () => { const v = url.value.trim(); if (!v) return url.focus(); try { await lib.installUrl(v); url.value = ''; } catch { /* toast shown */ } VX.sidebar.refresh(); };
    c.append(h('div', { class: 'lib-top' }, h('div', { class: 'group-title' }, 'Install from a link'), h('div', { class: 'lib-row' }, url, h('button', { class: 'btn sm primary', onclick: go }, 'Install')), h('div', { class: 'lib-note' }, 'Websites, 2D and 3D games. GitHub repository links work too. Only install from sources you trust.')));
    const d = lib.defaults(); const sec = (t, items, fn, tag) => { c.append(h('div', { class: 'group-title' }, t)); const box = h('div', { class: 'lib-list' }); items.forEach((it) => box.append(card(it, () => fn(it), tag))); c.append(box); };
    sec('Website templates', d.websites, (it) => lib.installDefault(it), 'Use');
    sec('2D games', d.games.filter((g) => g.type === 'game2d'), (it) => lib.installDefault(it), 'Open'); sec('3D games', d.games.filter((g) => g.type === 'game3d'), (it) => lib.installDefault(it), 'Open');
    for (const src of lib.sources()) { const info = lib.index.get(src); if (!info) { lib.loadSource(src); c.append(h('div', { class: 'group-title' }, 'Loading ' + (() => { try { return new URL(src).hostname; } catch { return src; } })() + ' …')); continue; }
      c.append(h('div', { class: 'group-title' }, info.name, h('span', { class: 'lib-x', title: 'Remove this source', onclick: () => { VX.app.set('librarySources', lib.sources().filter((s) => s !== src)); lib.index.delete(src); VX.sidebar.refresh(); } }, '✕')));
      if (info.error) { c.append(h('div', { class: 'lib-note' }, 'Could not load: ' + info.error)); continue; } if (!info.items.length) c.append(h('div', { class: 'lib-note' }, 'This source has no items yet.'));
      const box = h('div', { class: 'lib-list' }); info.items.forEach((it) => box.append(card(it, () => lib.installUrl(it.url).then(() => VX.sidebar.refresh()).catch(() => {})))); c.append(box); }
    c.append(h('div', { class: 'group-title' }, 'Add a library source'), h('div', { class: 'lib-row' }, (() => { const i = h('input', { class: 'search-input', placeholder: 'https://…/index.json' }); i.onkeydown = (e) => { if (e.key === 'Enter') add(i); }; return i; })(), h('button', { class: 'btn sm', onclick: (e) => add(e.target.previousSibling) }, 'Add')));
    const inst = lib.installed(); if (inst.length) { c.append(h('div', { class: 'group-title' }, 'Installed from links', h('span', { class: 'lib-x', title: 'Clear this list', onclick: () => { VX.app.set('libraryInstalled', []); VX.sidebar.refresh(); } }, 'Clear'))); const box = h('div', { class: 'lib-list' }); inst.forEach((r) => box.append(h('div', { class: 'lib-card slim', title: r.url }, h('div', { class: 'lib-ic' }, r.type === 'website' ? '🌐' : r.type === 'game3d' ? '🧊' : '🎮'), h('div', { class: 'lib-tx' }, h('b', {}, r.name), h('span', {}, new URL(r.url).hostname)), h('button', { class: 'btn sm', title: 'Install again', onclick: () => lib.installUrl(r.url, { trusted: true }).catch(() => {}) }, '↻'), h('button', { class: 'btn sm', title: 'Forget', onclick: () => { VX.app.set('libraryInstalled', lib.installed().filter((x) => x.url !== r.url)); VX.sidebar.refresh(); } }, '✕')))); c.append(box); }
  }
  async function add(inp) { const v = inp.value.trim(); if (!v) return; try { const info = await lib.installUrl(v); if (info && info.type !== 'index') VX.ui.toast('That link is a ' + info.type + ', not an index – installed instead', 'warn'); inp.value = ''; } catch { /* toast */ } VX.sidebar.refresh(); }
  VX.on('library', () => { if (VX.sidebar.current === 'library') VX.sidebar.refresh(); });
})();
