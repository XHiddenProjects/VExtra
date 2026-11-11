#!/usr/bin/env node
/* Records one short demo clip per block.   node tools/block-demos/build.js [id id …]   (needs the dev server: node scripts/dev-server.js) – writes renderer/docs/clips/<id>.webm and manifest.js */
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'renderer/docs/clips'), TMP = '/tmp/clips-raw', URL = process.env.VX_URL || 'http://localhost:5173/';
const W = 960, H = 540, GX = 484, GY = 54, GW = 464, GH = 261; // game frame inside the clip
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const wrapper = (d, title, html) => `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:${W}px;height:${H}px;background:#0b1220;font:14px system-ui,sans-serif;color:#e6edf7;overflow:hidden;position:relative}
.top{position:absolute;left:0;top:0;width:${W}px;height:44px;background:#131c31;border-bottom:1px solid #26334f;display:flex;align-items:center;padding:0 16px;gap:10px}
.top b{font-size:17px}.top .cat{background:#25406f;border-radius:999px;padding:2px 10px;font-size:12px;color:#bcd4ff}.top .tag{margin-left:auto;color:#7f93b5;font-size:12px}
#dia{position:absolute;left:10px;top:54px;width:466px;height:${H - 54 - 112}px;display:flex;gap:30px;align-items:center;justify-content:center}
#dia .col{display:flex;flex-direction:column;gap:12px;z-index:2}
.card{width:128px;background:#17223a;border:1.5px solid #324468;border-radius:9px;padding:6px 8px;box-shadow:0 2px 8px #0006}
.card .t{font-weight:700;font-size:13px;line-height:1.2}.card .s{font-size:10.5px;color:#9db0d0;margin-top:2px;line-height:1.25}
.card.focus{border-color:#ffd23f;box-shadow:0 0 0 3px #ffd23f33,0 0 18px #ffd23f55}.card.focus .t{color:#ffd23f}
.card.pulse{background:#22345c;transition:background .1s}
svg#w{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;z-index:1}
#gf{position:absolute;left:${GX}px;top:${GY}px;width:${GW}px;height:${GH}px;border:2px solid #324468;border-radius:6px;overflow:hidden;background:#000}
#gf iframe{width:100%;height:100%;border:0}
#cap{position:absolute;left:10px;right:10px;bottom:10px;height:92px;background:#131c31;border:1px solid #26334f;border-radius:10px;padding:10px 16px;font-size:20px;line-height:1.3;display:flex;align-items:center}
#cap span{color:#ffd23f;font-weight:700;margin-right:10px;white-space:nowrap}
#lbl{position:absolute;left:${GX}px;top:${GY + GH + 6}px;font-size:12px;color:#7f93b5}
</style>
<div class="top"><b>${title}</b><span class="cat">${d.cat || ''}</span><span class="tag">Vextra Studio · block demo</span></div>
<div id="dia"></div><svg id="w"></svg><div id="gf"><iframe id="g" allow="autoplay; camera; microphone; clipboard-read; clipboard-write; fullscreen"></iframe></div><div id="lbl">Live game (this block running for real)</div>
<div id="cap"><span>How to use ▸</span><div>${d.cap.replace(/</g, '&lt;')}</div></div>
<script>
const D=${JSON.stringify(d.graph).replace(/</g, '\\u003c')},ID=${JSON.stringify(d.id)};
const dia=document.getElementById('dia'),svg=document.getElementById('w');
const vis=D.nodes.filter(n=>!n.aux),cols=[...new Set(vis.map(n=>Math.round(n.x/10)))].sort((a,b)=>a-b);
const hasAux=D.nodes.some(n=>n.aux)&&D.wires.some(w=>D.nodes.find(n=>n.id===w.to&&n.aux)&&D.nodes.find(n=>n.id===w.from&&!n.aux));
const els={};cols.forEach(c=>{const col=document.createElement('div');col.className='col';vis.filter(n=>Math.round(n.x/10)===c).sort((a,b)=>a.y-b.y).forEach(n=>{const e=document.createElement('div');e.className='card'+(n.type===ID?' focus':'');e.innerHTML='<div class="t"></div><div class="s"></div>';e.firstChild.textContent=n.title;e.lastChild.textContent=(n.sum||[]).join(' · ');col.appendChild(e);els[n.id]=e;});dia.appendChild(col);});
const fit=()=>{const r=dia.getBoundingClientRect(),w=dia.scrollWidth,h=dia.scrollHeight;const k=Math.min(1,r.width/w,r.height/h);if(k<1){dia.style.transform='scale('+k+')';dia.style.transformOrigin='center center';}};
function wires(){svg.innerHTML='';const NS='http://www.w3.org/2000/svg';const dk=document.createElementNS(NS,'defs');dk.innerHTML='<marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#7aa2ff"/></marker>';svg.appendChild(dk);
const seen={};for(const w of D.wires){const tn=D.nodes.find(n=>n.id===w.to);const wt=tn&&tn.aux?'__fx':w.to;const wf=D.nodes.find(n=>n.id===w.from);if(wf&&wf.aux)continue;const key=w.from+'>'+wt+(wt==='__fx'?'':w.out+w.in);if(seen[key])continue;seen[key]=1;const a=els[w.from],b=els[wt],pa=a&&a.getBoundingClientRect(),pb=b&&b.getBoundingClientRect();let x1,y1,x2,y2,lab='';
 if(a&&b){x1=pa.right;y1=pa.top+pa.height/2;x2=pb.left;y2=pb.top+pb.height/2;lab=(w.out&&w.out!=='out'?w.out:'')+(w.in&&w.in!=='in'?' → '+w.in:'');}else continue;
 const p=document.createElementNS(NS,'path');const mx=(x1+x2)/2;p.setAttribute('d','M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2);p.setAttribute('stroke','#7aa2ff');p.setAttribute('stroke-width','2');p.setAttribute('fill','none');p.setAttribute('marker-end','url(#a)');svg.appendChild(p);
 if(lab){const t=document.createElementNS(NS,'text');t.setAttribute('x',mx);t.setAttribute('y',(y1+y2)/2-5);t.setAttribute('fill','#9db0d0');t.setAttribute('font-size','10');t.setAttribute('text-anchor','middle');t.textContent=lab;svg.appendChild(t);}}}
if(hasAux){const col=document.createElement('div');col.className='col';const e=document.createElement('div');e.className='card';e.style.borderStyle='dashed';e.innerHTML='<div class="t">Effect in the game</div><div class="s">burst + counter (just for this demo)</div>';col.appendChild(e);dia.appendChild(col);els.__fx=e;}
fit();wires();
document.getElementById('g').srcdoc=${JSON.stringify(html).replace(/</g, '\\u003c')};
</script>`;
(async () => {
  let ids = process.argv.slice(2); const flags = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  const br = await chromium.launch({ args: flags });
  const ed = await (await br.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await ed.goto(URL); await ed.waitForTimeout(1500);
  await ed.addScriptTag({ path: path.join(__dirname, 'core.js') }); for (const f of fs.readdirSync(__dirname).filter((x) => /^recipes-.*\.js$/.test(x)).sort()) await ed.addScriptTag({ path: path.join(__dirname, f) });
  if (ids[0] === '--manifest') { const caps = await ed.evaluate(() => Object.fromEntries(Object.entries(window.__demos).map(([k, v]) => [k, v.cap]))); const have = Object.keys(caps).filter((k) => fs.existsSync(path.join(OUT, k + '.webm'))).sort(); fs.writeFileSync(path.join(OUT, 'manifest.js'), '/* generated by tools/block-demos/build.js – block id → caption of its demo clip */\nwindow.VX = window.VX || {};\nVX.docClips = ' + JSON.stringify(Object.fromEntries(have.map((k) => [k, caps[k]]))) + ';\n'); console.log('manifest:', have.length, 'clips; missing:', Object.keys(caps).filter((k) => !have.includes(k)).join(', ') || 'none'); await br.close(); return; }
  if (!ids.length) ids = await ed.evaluate(() => Object.keys(window.__demos)); const manifestPath = path.join(OUT, 'manifest.json'); const man = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const fails = [];
  for (const id of ids) {
    try {
      const d = await ed.evaluate(async (id) => { const m = window.__mk(id); m.html = await VX.gameExport.toHTML(m.project); delete m.project; m.cat = (VXRT.blocks[id] || {}).label ? VXRT.CATEGORIES.find((c) => c.id === VXRT.blocks[id].cat)?.label : ''; m.title = (VXRT.blocks[id] || {}).label || id; return m; }, id);
      const dir = path.join(TMP, id); fs.rmSync(dir, { recursive: true, force: true });
      const ctx = await br.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } }, permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'] });
      await ctx.addInitScript(() => { window.__pad = { b: [], a: [0, 0, 0, 0] }; const mk = () => ({ id: 'Demo pad', index: 0, connected: true, mapping: 'standard', axes: window.__pad.a, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!window.__pad.b[i], touched: !!window.__pad.b[i], value: window.__pad.b[i] ? 1 : 0 })) }); navigator.getGamepads = () => [mk(), null, null, null]; });
      await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ zen: 'Keep it logically awesome.' }) }));
      if (process.env.DUMP) fs.writeFileSync('/tmp/wrap-' + id + '.html', wrapper(Object.assign(d, { id }), d.title, d.html)); const pg = await ctx.newPage(); pg.on('console', (m) => process.env.DUMP && console.log('  C:', m.text().slice(0, 150))); pg.on('pageerror', (e) => console.log('  E:', e.message.slice(0, 200))); const t0 = Date.now(); await ctx.route('http://localhost:5173/__demo.html', (r) => r.fulfill({ contentType: 'text/html', body: wrapper(Object.assign(d, { id }), d.title, d.html) })); await pg.goto('http://localhost:5173/__demo.html'); await pg.waitForTimeout(2600);
      const t1 = Date.now(); const fr = pg.frames().find((f) => f !== pg.mainFrame()); try { await fr.evaluate(() => window.focus()); } catch {}
      const pt = (gx, gy, css) => (css ? { x: GX + gx, y: GY + gy } : { x: GX + (gx / 960) * GW, y: GY + (gy / 540) * GH }); const cs = (op) => op.startsWith('c') && op.length > 3 ? op.slice(1) : op; const start = Date.now();
      for (const st of d.script || []) {
        const [t, op0, a, b, c, e] = st; const css = op0.startsWith('c') && ['cclick', 'cdrag', 'cmdown', 'cmove'].includes(op0), op = css ? op0.slice(1) : op0; const wait = t - (Date.now() - start); if (wait > 0) await pg.waitForTimeout(wait);
        if (op === 'key') await pg.keyboard.press(a, { delay: b || 90 }); else if (op === 'down') await pg.keyboard.down(a); else if (op === 'up') await pg.keyboard.up(a);
        else if (op === 'move') { const q = pt(a, b, css); await pg.mouse.move(q.x, q.y, { steps: c || 8 }); }
        else if (op === 'click') { const q = pt(a, b, css); await pg.mouse.move(q.x, q.y); await pg.mouse.down(); await pg.waitForTimeout(80); await pg.mouse.up(); }
        else if (op === 'mdown') { const q = pt(a, b, css); await pg.mouse.move(q.x, q.y); await pg.mouse.down(); } else if (op === 'mup') await pg.mouse.up();
        else if (op === 'drag') { const q = pt(a, b, css), z = pt(c, e, css); await pg.mouse.move(q.x, q.y); await pg.mouse.down(); await pg.mouse.move(z.x, z.y, { steps: 12 }); await pg.mouse.up(); }
        else if (op === 'wheel') { const q = pt(480, 270); await pg.mouse.move(q.x, q.y); await pg.mouse.wheel(0, a); }
        else if (op === 'pad') await fr.evaluate(([i, v]) => { window.__pad.b[i] = v; }, [a, b]); else if (op === 'axis') await fr.evaluate(([i, v]) => { window.__pad.a[i] = v; }, [a, b]);
        else if (op === 'eval') await fr.evaluate(a);
        else if (op === 'text') await pg.keyboard.type(a);
      }
      const rest = d.ms - (Date.now() - start); if (rest > 0) await pg.waitForTimeout(rest);
      const vid = await pg.video().path(); await ctx.close(); const raw = vid; const ss = Math.max(0, (t1 - t0) / 1000 - 0.45);
      const out = path.join(OUT, id + '.webm'); cp.execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', ss.toFixed(2), '-i', raw, '-t', (d.ms / 1000 + 0.6).toFixed(1), '-vf', 'scale=640:-2,fps=15', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-an', out]);
      man[id] = { cap: d.cap, kb: Math.round(fs.statSync(out).size / 1024) }; console.log('ok', id, man[id].kb + ' KB');
    } catch (e) { fails.push(id); console.log('FAIL', id, (e && e.message || e).slice(0, 200)); }
    fs.writeFileSync(manifestPath, JSON.stringify(man, null, 1));
  }
  const ids2 = Object.keys(man).sort(); fs.writeFileSync(path.join(OUT, 'manifest.js'), '/* generated by tools/block-demos/build.js – block id → caption of its demo clip */\nwindow.VX = window.VX || {};\nVX.docClips = ' + JSON.stringify(Object.fromEntries(ids2.map((k) => [k, man[k].cap]))) + ';\n');
  await br.close(); console.log('failed:', fails.join(', ') || 'none');
})();
