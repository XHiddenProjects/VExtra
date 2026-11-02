/* Vextra game editor – extra asset studios: keyframe Animation editor, Material editor, Shader file editor. */
(function () {
  const { h, uid } = VX;
  const EASES = ['linear', 'step', ...VXRT.ease.names];
  const PROP_LABEL = { x: 'X', y: 'Y', z: 'Z', rot: 'Rotation (2D)', rx: 'Rotate X', ry: 'Rotate Y', rz: 'Rotate Z', w: 'Width', h: 'Height', d: 'Depth', alpha: 'Opacity', color: 'Colour', frame: 'Sprite frame' };
  const fmt = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);

  /* ======================= Animation (timeline) ======================= */
  class AnimEditor {
    constructor(asset, project, onChange) {
      this.a = asset; this.onChange = onChange; asset.tracks = asset.tracks || []; asset.duration = asset.duration || 1; asset.loop = asset.loop || 'once'; this.t = 0; this.playing = false; this.zoom = 160; this.sel = null; this.fps = 30; this.allowVars = true;
      this.el = h('div', { class: 'anm' }); this.init && this.init(); this.build();
    }
    ch() { this.onChange && this.onChange(); }
    snap(t) { return Math.max(0, Math.min(this.a.duration, Math.round(t * this.fps) / this.fps)); }
    value(tr, t) { return VXRT.trackValue(tr, t); }
    build() {
      const a = this.a, el = this.el; el.textContent = '';
      const name = h('input', { value: a.name, oninput: (e) => { a.name = e.target.value; this.ch(); } });
      const dur = h('input', { type: 'number', min: 0.1, step: 0.1, value: a.duration, class: 'n', onchange: (e) => { a.duration = Math.max(0.1, parseFloat(e.target.value) || 1); this.drawLanes(); this.ch(); } });
      const loop = h('select', { onchange: (e) => { a.loop = e.target.value; this.ch(); } }, [['once', 'Once'], ['loop', 'Loop'], ['pingpong', 'Ping-pong']].map(([v, l]) => h('option', { value: v, selected: v === a.loop }, l)));
      const rel = h('label', { class: 'mini', title: 'Values are added to where the object already is' }, h('input', { type: 'checkbox', checked: !!a.relative, onchange: (e) => { a.relative = e.target.checked; this.ch(); } }), ' Relative');
      this.playBtn = h('button', { class: 'btn primary', onclick: () => this.toggle() }, '▶ Play');
      const fps = h('select', { onchange: (e) => { this.fps = +e.target.value; } }, [12, 24, 30, 60].map((f) => h('option', { value: f, selected: f === this.fps }, f + ' fps snap')));
      const zoom = h('input', { type: 'range', min: 60, max: 600, value: this.zoom, oninput: (e) => { this.zoom = +e.target.value; this.drawLanes(); } });
      const presets = h('select', { onchange: (e) => { if (!e.target.value) return; this.applyPreset(e.target.value); e.target.value = ''; } }, h('option', { value: '' }, 'Add from preset…'), ...(VX.defaultAssets ? VX.defaultAssets.catalog('animations').map((c) => h('option', { value: c.key }, c.name)) : []));
      const head = h('div', { class: 'row g6 wrap' }, h('label', { class: 'mini' }, 'Name'), name, h('label', { class: 'mini' }, 'Length (s)'), dur, loop, rel, fps, h('span', { class: 'mini' }, 'Zoom'), zoom, h('span', { class: 'sp' }), presets, this.playBtn, h('button', { class: 'btn', onclick: () => { this.stop(); this.setTime(0); } }, '⏹'));
      const addSel = h('select', {}, this.propOptions().map(([p, l]) => h('option', { value: p }, l)), this.allowVars ? h('option', { value: 'var:' }, 'Object variable…') : null);
      const add = h('button', { class: 'btn sm primary', onclick: async () => { let p = addSel.value; if (p === 'var:') { const n = await VX.ui.ask('Object variable name'); if (!n) return; p = 'var:' + n; } if (a.tracks.some((t) => t.prop === p)) return VX.ui.toast('That property already has a track', 'warn'); a.tracks.push({ prop: p, keys: [{ t: 0, v: this.defaultValue(p) }] }); this.ch(); this.drawLanes(); } }, '＋ Track');
      this.stage = this.makeStage();
      this.lanes = h('div', { class: 'anm-lanes' }); this.keyPane = h('div', { class: 'anm-key' });
      el.append(head, h('div', { class: 'row g6' }, h('b', {}, 'Tracks'), addSel, add, h('span', { class: 'mini' }, 'Double-click a lane to add a key • drag keys to move • click the ruler to scrub')), h('div', { class: 'anm-body' }, this.lanes, h('div', { class: 'anm-side' }, this.stage, this.keyPane)));
      this.drawLanes(); this.drawStage(); this.drawKeyPane();
    }
    propOptions() { return VXRT.CLIP_PROPS.map((p) => [p, PROP_LABEL[p] || p]); }
    label(p) { return PROP_LABEL[p] || p; }
    defaultValue(p) { return p === 'color' ? '#ffffff' : p === 'alpha' ? 1 : 0; }
    makeStage() { return h('canvas', { class: 'anm-stage', width: 220, height: 150 }); }
    applyPreset(key) { const e = VX.defaultAssets.catalog('animations').find((c) => c.key === key); if (!e) return; const c = e.make(); const a = this.a; a.duration = c.duration; a.loop = c.loop; a.relative = c.relative; a.tracks = c.tracks; this.sel = null; this.build(); this.ch(); }
    drawLanes() {
      const a = this.a, W = Math.max(300, a.duration * this.zoom + 40), box = this.lanes; box.textContent = '';
      const ruler = h('div', { class: 'anm-ruler', style: `width:${W}px` }); for (let s = 0; s <= a.duration + 1e-6; s += a.duration > 6 ? 1 : 0.25) ruler.append(h('span', { style: `left:${s * this.zoom}px` }, (+s.toFixed(2)) + 's'));
      ruler.addEventListener('pointerdown', (e) => { const mv = (ev) => { const r = ruler.getBoundingClientRect(); this.setTime(this.snap((ev.clientX - r.left) / this.zoom)); }; mv(e); ruler.setPointerCapture(e.pointerId); ruler.onpointermove = mv; ruler.onpointerup = () => { ruler.onpointermove = null; }; });
      this.head = h('div', { class: 'anm-head', style: `left:${this.t * this.zoom}px` }); const rows = h('div', { class: 'anm-rows', style: `width:${W}px` }, this.head);
      a.tracks.forEach((tr, ti) => {
        const lane = h('div', { class: 'anm-lane' }); const label = h('div', { class: 'anm-name' }, h('b', {}, this.label(tr.prop)), this.valueInput(tr), h('button', { class: 'btn sm', title: 'Remove track', onclick: () => { a.tracks.splice(ti, 1); this.sel = null; this.ch(); this.drawLanes(); this.drawKeyPane(); } }, '✕'));
        const strip = h('div', { class: 'anm-strip', style: `width:${W}px` });
        strip.addEventListener('dblclick', (e) => { if (e.target !== strip) return; const r = strip.getBoundingClientRect(); const t = this.snap((e.clientX - r.left) / this.zoom); this.addKey(tr, t, this.value(tr, t)); });
        for (const k of tr.keys) { const kb = h('div', { class: 'anm-k' + (this.sel && this.sel.k === k ? ' on' : ''), style: `left:${k.t * this.zoom}px`, title: `${fmt(k.t)}s = ${fmt(k.v)}` });
          kb.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.sel = { tr, k }; kb.setPointerCapture(e.pointerId); const sx = e.clientX, t0 = k.t; kb.onpointermove = (ev) => { k.t = this.snap(t0 + (ev.clientX - sx) / this.zoom); kb.style.left = k.t * this.zoom + 'px'; this.drawKeyPane(); this.drawStage(); }; kb.onpointerup = () => { kb.onpointermove = null; tr.keys.sort((p, q) => p.t - q.t); this.ch(); this.drawLanes(); this.drawKeyPane(); }; this.drawKeyPane(); box.querySelectorAll('.anm-k.on').forEach((n) => n.classList.remove('on')); kb.classList.add('on'); }); strip.append(kb); }
        lane.append(label, strip); rows.append(lane);
      });
      box.append(ruler, rows); if (!a.tracks.length) box.append(h('div', { class: 'as-empty' }, 'No tracks yet. Pick a property above and press ＋ Track, or add a preset.'));
    }
    valueInput(tr) { const cur = this.value(tr, this.t); const i = h('input', { class: 'n anm-v', type: tr.prop === 'color' ? 'color' : 'number', step: 'any', value: tr.prop === 'color' ? (cur || '#ffffff') : fmt(cur ?? 0), title: 'Type a value to set a key at the playhead' }); i.onchange = () => { const v = tr.prop === 'color' ? i.value : parseFloat(i.value) || 0; this.addKey(tr, this.snap(this.t), v); }; tr._input = i; return i; }
    addKey(tr, t, v) { const ex = tr.keys.find((k) => Math.abs(k.t - t) < 1e-4); if (ex) ex.v = v; else tr.keys.push({ t, v: v ?? 0 }); tr.keys.sort((p, q) => p.t - q.t); this.ch(); this.drawLanes(); this.drawStage(); }
    setTime(t) { this.t = Math.max(0, Math.min(this.a.duration, t)); if (this.head) this.head.style.left = this.t * this.zoom + 'px'; for (const tr of this.a.tracks) if (tr._input) { const v = this.value(tr, this.t); if (document.activeElement !== tr._input && v !== undefined) tr._input.value = tr.prop === 'color' ? v : fmt(v); } this.drawStage(); }
    drawKeyPane() { const p = this.keyPane; p.textContent = ''; if (!this.sel) return p.append(h('div', { class: 'mini' }, 'Select a key to edit its time, value and easing.')); const { tr, k } = this.sel;
      const t = h('input', { type: 'number', step: 0.01, class: 'n', value: fmt(k.t), onchange: (e) => { k.t = this.snap(parseFloat(e.target.value) || 0); tr.keys.sort((a, b) => a.t - b.t); this.ch(); this.drawLanes(); } });
      const v = h('input', { class: 'n', type: tr.prop === 'color' ? 'color' : 'number', step: 'any', value: tr.prop === 'color' ? k.v : fmt(k.v), onchange: (e) => { k.v = tr.prop === 'color' ? e.target.value : parseFloat(e.target.value) || 0; this.ch(); this.drawStage(); } });
      const ez = h('select', { onchange: (e) => { k.e = e.target.value === 'linear' ? undefined : e.target.value; this.ch(); this.drawStage(); } }, EASES.map((n) => h('option', { value: n, selected: (k.e || 'linear') === n }, n)));
      p.append(h('b', {}, this.label(tr.prop) + ' key'), h('div', { class: 'row g6' }, h('span', { class: 'mini' }, 'time'), t), h('div', { class: 'row g6' }, h('span', { class: 'mini' }, 'value'), v), h('div', { class: 'row g6' }, h('span', { class: 'mini' }, 'ease →'), ez), h('button', { class: 'btn sm', onclick: () => { tr.keys.splice(tr.keys.indexOf(k), 1); this.sel = null; this.ch(); this.drawLanes(); this.drawKeyPane(); } }, 'Delete key')); }
    /** little 2D stage that shows what the clip does to a box (position, size, rotation, opacity, colour) */
    drawStage() { const c = this.stage.getContext('2d'), W = 220, H = 150; c.clearRect(0, 0, W, H); c.fillStyle = '#10131a'; c.fillRect(0, 0, W, H); c.strokeStyle = '#2a3047'; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
      const v = {}; for (const tr of this.a.tracks) v[tr.prop] = this.value(tr, this.t); const rel = this.a.relative; const g = (p, d) => (v[p] === undefined ? d : typeof v[p] === 'number' ? (rel ? d + v[p] : v[p]) : v[p]);
      c.save(); c.translate(W / 2 + (v.x === undefined ? 0 : v.x) * 0.5, H / 2 + (v.y === undefined ? 0 : v.y) * 0.5); c.rotate(((v.rot ?? v.rz ?? 0) * Math.PI) / 180); c.globalAlpha = Math.max(0, Math.min(1, v.alpha ?? 1)); const w = Math.max(2, g('w', 40)), hh = Math.max(2, g('h', 40)); c.fillStyle = typeof v.color === 'string' ? v.color : '#6c8cff'; c.fillRect(-w / 2, -hh / 2, w, hh); c.restore();
      c.fillStyle = '#8b93a1'; c.font = '10px system-ui'; c.fillText(this.t.toFixed(2) + 's', 6, 12); }
    toggle() { this.playing ? this.stop() : this.play(); }
    play() { if (this.t >= this.a.duration && this.a.loop === 'once') this.setTime(0); this.playing = true; this.playBtn.textContent = '⏸ Pause'; let last = performance.now(); const step = (now) => { if (!this.playing || !this.el.isConnected) return this.stop(); const dt = (now - last) / 1000; last = now; let t = this.t + dt; if (t >= this.a.duration) { if (this.a.loop === 'loop') t = 0; else if (this.a.loop === 'pingpong') { t = 0; } else { this.setTime(this.a.duration); return this.stop(); } } this.setTime(t); this._raf = requestAnimationFrame(step); }; this._raf = requestAnimationFrame(step); }
    stop() { this.playing = false; cancelAnimationFrame(this._raf); if (this.playBtn) this.playBtn.textContent = '▶ Play'; }
    dispose() { this.stop(); }
  }
  VX.AnimEditor = AnimEditor; VX.AnimEditorBase = { EASES, fmt, PROP_LABEL };

  /* ======================= Material ======================= */
  class MaterialEditor {
    constructor(asset, project, onChange) { this.a = asset; this.project = project; this.onChange = onChange; this.shape = 'sphere'; this.el = h('div', { class: 'mat' }); this.preview = new VX.ModelPreview(300, 260); this.build(); }
    ch() { this.onChange && this.onChange(); this.refresh(); }
    refresh() { const a = this.a; this.preview.set({ id: 'pv', kind: 'group', parts: [{ type: this.shape, x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, rx: 0, ry: 0, rz: 0, color: '#ffffff', matAsset: a.id }] }, this.project); }
    mounted() { this.refresh(); }
    build() {
      const a = this.a, el = this.el; el.textContent = ''; const set = (k, v) => { a[k] = v; this.ch(); };
      const row = (l, c) => h('div', { class: 'row g6' }, h('label', { class: 'mini', style: 'width:110px' }, l), c);
      const num = (k, min, max, step) => h('input', { type: 'range', min, max, step, value: a[k] ?? 0, oninput: (e) => { set(k, parseFloat(e.target.value)); e.target.nextSibling.textContent = fmt(a[k]); } });
      const rng = (k, l, min, max, step) => row(l, h('div', { class: 'row g6', style: 'flex:1' }, num(k, min, max, step), h('span', { class: 'mini' }, fmt(a[k] ?? 0))));
      const col = (k, l) => row(l, h('input', { type: 'color', value: a[k] || '#cccccc', oninput: (e) => set(k, e.target.value) }));
      const chk = (k, l) => h('label', { class: 'mini' }, h('input', { type: 'checkbox', checked: !!a[k], onchange: (e) => set(k, e.target.checked) }), ' ' + l);
      const sprites = Object.values(this.project.assets.sprites || {}); const spr = (k, l) => row(l, h('select', { onchange: (e) => set(k, e.target.value) }, h('option', { value: '' }, '— none —'), sprites.map((s) => h('option', { value: s.id, selected: a[k] === s.id }, s.name))));
      const pat = row('Pattern', h('select', { onchange: (e) => set('pattern', e.target.value) }, ['none', 'checker', 'stripes', 'bricks', 'noise', 'wood', 'grass', 'dots', 'grid'].map((p) => h('option', { value: p, selected: (a.pattern || 'none') === p }, p))));
      const shape = h('select', { onchange: (e) => { this.shape = e.target.value; this.refresh(); } }, ['sphere', 'cube', 'cylinder', 'torus', 'capsule'].map((s) => h('option', { value: s }, s)));
      const left = h('div', { class: 'mat-form' }, row('Name', h('input', { value: a.name, oninput: (e) => { a.name = e.target.value; this.onChange && this.onChange(); } })), col('color', 'Colour'), pat, col('color2', 'Pattern colour'), spr('texture', 'Texture (sprite)'), row('Repeat', h('div', { class: 'row g6' }, h('input', { type: 'number', class: 'n', step: 0.5, value: a.repeatX ?? 1, onchange: (e) => set('repeatX', parseFloat(e.target.value) || 1) }), h('input', { type: 'number', class: 'n', step: 0.5, value: a.repeatY ?? 1, onchange: (e) => set('repeatY', parseFloat(e.target.value) || 1) }))),
        rng('metalness', 'Metalness', 0, 1, 0.01), rng('roughness', 'Roughness', 0, 1, 0.01), col('emissive', 'Glow colour'), rng('emissiveIntensity', 'Glow strength', 0, 4, 0.05), rng('opacity', 'Opacity', 0, 1, 0.01), spr('bump', 'Bump map (sprite)'), rng('bumpScale', 'Bump strength', 0, 5, 0.05),
        h('div', { class: 'row g6' }, chk('wireframe', 'Wireframe'), chk('flat', 'Flat shading'), chk('doubleSided', 'Double sided')),
        h('div', { class: 'row g6' }, h('button', { class: 'btn sm', onclick: () => this.importFile() }, 'Import .vxmat / .mtl…'), h('button', { class: 'btn sm', onclick: () => VX.download((a.name || 'material') + '.vxmat', JSON.stringify(Object.assign({ format: 'vextra-material' }, a, { id: undefined }), null, 2)) }, 'Export .vxmat')));
      el.append(h('div', { class: 'mat-wrap' }, left, h('div', { class: 'mat-prev' }, this.preview.el, h('div', { class: 'row g6' }, h('span', { class: 'mini' }, 'Preview shape'), shape), h('div', { class: 'mini' }, 'Drag to orbit. Use it on a 3D object (Inspector → Material), a model or part (Model editor), or with the Material block.'))));
    }
    async importFile() { const f = (await VX.pickBrowserFile('.vxmat,.json,.mtl', false))[0]; if (!f) return; const txt = await VX.readFileAsText(f); try { Object.assign(this.a, VX.parseMaterialFile(txt, f.name)); this.build(); this.ch(); } catch (e) { VX.ui.toast('Could not read material: ' + e.message, 'error'); } }
    dispose() { this.preview.dispose(); }
  }
  VX.MaterialEditor = MaterialEditor;
  /** .vxmat / .json (our format) or a Wavefront .mtl (first material) → material fields. */
  VX.parseMaterialFile = function (text, name) {
    if (/\.mtl$/i.test(name || '') || /^\s*(newmtl|Kd|Ka)\b/m.test(text)) {
      const o = {}; const hex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(1, +x)) * 255).toString(16).padStart(2, '0')).join('');
      for (const ln of text.split(/\r?\n/)) { const p = ln.trim().split(/\s+/); if (p[0] === 'newmtl' && o.name) break; if (p[0] === 'newmtl') o.name = p.slice(1).join(' '); else if (p[0] === 'Kd') o.color = hex(p[1], p[2], p[3]); else if (p[0] === 'Ke' && (+p[1] || +p[2] || +p[3])) { o.emissive = hex(p[1], p[2], p[3]); o.emissiveIntensity = 1; } else if (p[0] === 'Ns') o.roughness = Math.max(0, Math.min(1, 1 - Math.sqrt(+p[1] / 1000))); else if (p[0] === 'Ks') o.metalness = Math.max(0, Math.min(1, (+p[1] + +p[2] + +p[3]) / 3 - 0.2)); else if (p[0] === 'd') o.opacity = +p[1]; }
      return o;
    }
    const j = JSON.parse(text); const out = {}; for (const k of ['name', 'color', 'color2', 'pattern', 'metalness', 'roughness', 'emissive', 'emissiveIntensity', 'opacity', 'repeatX', 'repeatY', 'wireframe', 'flat', 'doubleSided', 'bumpScale']) if (j[k] !== undefined) out[k] = j[k]; return out;
  };

  /* ======================= Shader file ======================= */
  const TEMPLATE = '// Custom shader – runs over the whole screen, a layer, or one object.\n// Available: sampler2D uTex, vec2 uRes, vUv (0–1), float uTime, uAmount (0–1), uSize, uA, uB, vec4 uColor, vec2 uPos.\n// Helpers: T(uv) samples the image, luma(rgb), hash(vec2), uPx = 1 pixel in uv units.\nvoid main() {\n  vec4 c = T(vUv);\n  vec3 inv = 1.0 - c.rgb;\n  gl_FragColor = vec4(mix(c.rgb, inv, uAmount), c.a);\n}\n';
  VX.SHADER_TEMPLATE = TEMPLATE;
  class ShaderEditor {
    constructor(asset, project, onChange) { this.a = asset; this.onChange = onChange; this.el = h('div', { class: 'shd' }); this.canvas = h('canvas', { class: 'shd-prev', width: 320, height: 220 }); this.src = document.createElement('canvas'); this.src.width = 320; this.src.height = 220; this.eng = new VXRT.FxEngine(true); this.status = h('div', { class: 'lg-status' }); this.build(); }
    build() {
      const a = this.a; a.code = a.code || TEMPLATE;
      this.ta = h('textarea', { class: 'me-obj shd-code', spellcheck: 'false', oninput: (e) => { a.code = e.target.value; this.onChange && this.onChange(); this.compile(); } }, a.code);
      const name = h('input', { value: a.name, oninput: (e) => { a.name = e.target.value; this.onChange && this.onChange(); } });
      const params = h('div', { class: 'row g6' }, ...['amount:70', 'size:8', 'a:0', 'b:0'].map((s) => { const [k, d] = s.split(':'); this._p = this._p || {}; this._p[k] = +d; return h('label', { class: 'mini' }, k + ' ', h('input', { class: 'n', type: 'number', value: d, step: 'any', onchange: (e) => { this._p[k] = parseFloat(e.target.value) || 0; } })); }));
      this.el.append(h('div', { class: 'row g6' }, h('label', { class: 'mini' }, 'Name'), name, h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => { VX.download((a.name || 'shader') + '.glsl', a.code); } }, 'Export .glsl'), h('button', { class: 'btn sm', onclick: async () => { const f = (await VX.pickBrowserFile('.glsl,.frag,.vxshader,.txt', false))[0]; if (!f) return; a.code = await VX.readFileAsText(f); this.ta.value = a.code; this.onChange && this.onChange(); this.compile(); } }, 'Replace from file…')),
        h('div', { class: 'shd-wrap' }, h('div', { class: 'shd-left' }, this.ta, this.status), h('div', { class: 'shd-right' }, this.canvas, h('div', { class: 'mini' }, 'Preview settings (the Shader block sets these in a game)'), params)));
      this.compile(); this.loop();
    }
    compile() { const key = 'edit' + Date.now(); const frag = VXRT.fxCustomFrag(this.a.code); this.frag = frag; this.key = key; if (!this.eng.ok) { this.status.textContent = 'WebGL is not available here, so shaders cannot be previewed.'; this.status.className = 'lg-status err'; return; } let err = ''; this.eng.failed.clear(); const rec = this.eng.program(key, frag, (m) => { err = m; }); this.ok = !!rec; this.status.className = 'lg-status ' + (rec ? 'ok' : 'err'); this.status.textContent = rec ? '✓ Compiles. Save it, then pick it in a Shader block (Type → Custom shader file).' : err.replace(/^Shader "[^"]*" failed: /, '⚠ '); }
    loop() { const c = this.src.getContext('2d'); const draw = (now) => { if (!this.el.isConnected) { this._stop = true; return; } if (this.ok) { const W = 320, H = 220; const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#4f7cff'); g.addColorStop(0.5, '#ff4d6d'); g.addColorStop(1, '#ffd23f'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = '#10131a'; c.fillRect(30, 30, 90, 90); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(220, 100, 50, 0, 6.3); c.fill(); c.fillStyle = '#3fb950'; c.fillRect(120, 150, 150, 40);
        const p = this._p || {}; const chain = [{ fx: { passes: 1 }, frag: this.frag, key: this.key, p: { amount: p.amount, size: p.size, a: p.a, b: p.b, color: '#6c8cff', x: 0.5, y: 0.5 }, t: now / 1000, scale: 1 }]; if (this.eng.run(this.src, chain, now / 1000, () => {})) { const o = this.canvas.getContext('2d'); o.clearRect(0, 0, 320, 220); o.drawImage(this.eng.canvas, 0, 0); } } this._raf = requestAnimationFrame(draw); }; this._raf = requestAnimationFrame(draw); }
    dispose() { cancelAnimationFrame(this._raf); }
  }
  VX.ShaderEditor = ShaderEditor;
})();
