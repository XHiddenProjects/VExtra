/* Vextra game editor – Animation studios.
 *  • SpriteAnimator – timeline for sprite frames: named animations, per-frame hold, fps, loop / once / ping-pong, a still-by-default preview.
 *  • ModelAnimator  – keyframe pose animation for 3D models (whole model or any part), previewed live in 3D.
 * Sprite data:  asset.animMeta[name] = { fps, loop, seq:[{ f, hold }] }   and   asset.anims[name] = expanded frame list (what the runtime plays).
 * Model data:   asset.anims[name]    = { id, name, duration, loop, tracks:[{ prop:'w.x'|'p2.ry'|…, keys:[{ t, v, e }] }] }                          */
(function () {
  const { h } = VX;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------------ shared sprite-animation data helpers */
  const SA = (VX.spriteAnims = {
    expand: (m) => (m.seq || []).flatMap((s) => Array(Math.max(1, s.hold | 0 || 1)).fill(s.f)),
    sync(a, name) { a.anims = a.anims || {}; a.anims[name] = SA.expand(a.animMeta[name]); },
    /** make sure every named animation has editable metadata (older projects only stored a frame list) */
    ensure(a) {
      a.anims = a.anims || {}; a.animMeta = a.animMeta || {}; const n = a.frames ? a.frames.length : 1;
      for (const [name, list] of Object.entries(a.anims)) {
        if (!a.animMeta[name]) { const seq = []; for (const f of list) { const l = seq[seq.length - 1]; if (l && l.f === f) l.hold++; else seq.push({ f, hold: 1 }); } a.animMeta[name] = { fps: a.fps || 8, loop: 'loop', seq }; }
        const m = a.animMeta[name]; m.seq = m.seq.filter((s) => s.f >= 0 && s.f < n); SA.sync(a, name);
      }
      for (const name of Object.keys(a.animMeta)) if (!a.anims[name]) delete a.animMeta[name];
    },
    /** keep animations pointing at the right pictures when frames are deleted / swapped / inserted in the draw tab */
    remap(a, op, i, j) {
      if (!a.animMeta) return; for (const [name, m] of Object.entries(a.animMeta)) {
        if (op === 'del') m.seq = m.seq.filter((s) => s.f !== i).map((s) => (s.f > i ? { ...s, f: s.f - 1 } : s));
        else if (op === 'swap') m.seq.forEach((s) => { if (s.f === i) s.f = j; else if (s.f === j) s.f = i; });
        else if (op === 'ins') m.seq.forEach((s) => { if (s.f >= i) s.f++; });
        SA.sync(a, name);
      }
    },
  });

  /* ================================================================== Sprite animator */
  class SpriteAnimator {
    constructor(se) {
      this.se = se; this.a = se.a; SA.ensure(this.a); this.sel = Object.keys(this.a.animMeta)[0] || null; this.k = 0; this.t = 0; this.playing = false; this.speed = 1; this.zoom = 0; this.selItem = -1;
      this.el = h('div', { class: 'sa' }); this.build();
    }
    changed() { this.se.changed(); }
    get frames() { return this.se.frames; }
    /** the animation being edited; "all frames" is a read-only stand-in when nothing is selected */
    get meta() { return this.sel ? this.a.animMeta[this.sel] : { fps: this.a.fps || 8, loop: 'loop', seq: this.frames.map((_, f) => ({ f, hold: 1 })), virtual: true }; }
    get list() { return SA.expand(this.meta); }
    build() {
      this.listBox = h('div', { class: 'sa-list' }); this.props = h('div', { class: 'sa-props' }); this.bin = h('div', { class: 'sa-bin' }); this.tl = h('div', { class: 'sa-tl' });
      this.cv = h('canvas', { class: 'sa-cv' }); this.stage = h('div', { class: 'sa-stage' }, this.cv); this.info = h('div', { class: 'sa-info' });
      this.playBtn = h('button', { class: 'btn primary sa-play', title: 'Play / pause (Space)', onclick: () => this.toggle() }, '▶ Play');
      const step = (d) => { this.pause(); const n = this.list.length; if (!n) return; this.k = (this.k + d + n) % n; this.show(); };
      const zoom = h('select', { title: 'Preview size', onchange: (e) => { this.zoom = +e.target.value; this.fit(); this.show(); } }, [[0, 'Fit'], [1, '1×'], [2, '2×'], [4, '4×'], [8, '8×'], [16, '16×']].map(([v, l]) => h('option', { value: v }, l)));
      const speed = h('select', { title: 'Preview speed', onchange: (e) => { this.speed = +e.target.value; } }, [[0.25, '¼×'], [0.5, '½×'], [1, '1×'], [2, '2×']].map(([v, l]) => h('option', { value: v, selected: v === 1 }, l)));
      const ctl = h('div', { class: 'sa-ctl' }, h('button', { class: 'btn sm', title: 'First frame', onclick: () => { this.pause(); this.k = 0; this.show(); } }, '⏮'), h('button', { class: 'btn sm', title: 'Previous frame', onclick: () => step(-1) }, '◀'), this.playBtn, h('button', { class: 'btn sm', title: 'Next frame', onclick: () => step(1) }, '▶'), h('button', { class: 'btn sm', title: 'Last frame', onclick: () => { this.pause(); this.k = Math.max(0, this.list.length - 1); this.show(); } }, '⏭'), h('span', { class: 'sp' }), h('span', { class: 'mini' }, 'Speed'), speed, h('span', { class: 'mini' }, 'Size'), zoom);
      this.el.append(h('div', { class: 'sa-left' }, h('div', { class: 'sa-h' }, h('b', {}, 'Animations'), h('span', { class: 'sp' }), h('button', { class: 'btn sm primary', onclick: () => this.add() }, '＋ New')), this.listBox),
        h('div', { class: 'sa-mid' }, this.stage, this.info, ctl, h('div', { class: 'sa-h' }, h('b', {}, 'Timeline'), h('span', { class: 'mini' }, 'Click a frame to scrub • drag to reorder • ± sets how long it is held'), h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => this.addSelected() }, '＋ Add current frame')), this.tl, h('div', { class: 'sa-h' }, h('b', {}, 'Frame bin'), h('span', { class: 'mini' }, 'Click a picture to add it to the timeline. Draw or edit pictures in the ✏ Draw tab.')), this.bin),
        h('div', { class: 'sa-right' }, this.props));
      this.keyH = (e) => { if (!this.el.isConnected || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.code === 'Space') { e.preventDefault(); this.toggle(); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } };
      document.addEventListener('keydown', this.keyH); this.refreshAll();
    }
    refreshAll() { this.renderList(); this.renderProps(); this.renderBin(); this.renderTimeline(); this.fit(); this.show(); }
    thumb(f, h2 = 48) { const c = h('canvas', { class: 'sa-thumb', width: this.a.w, height: this.a.h }); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; if (this.frames[f]) x.drawImage(this.frames[f], 0, 0); c.style.height = h2 + 'px'; c.style.width = Math.max(20, Math.round((this.a.w / this.a.h) * h2)) + 'px'; return c; }
    /* ---------- list of animations */
    renderList() {
      const box = this.listBox; box.textContent = '';
      const row = (name, label, sub) => h('div', { class: 'sa-item' + (this.sel === name ? ' on' : ''), onclick: () => { this.pause(); this.sel = name; this.k = 0; this.selItem = -1; this.refreshAll(); } }, h('b', {}, label), h('span', { class: 'mini' }, sub));
      box.append(row(null, 'All frames', `${this.frames.length} frame(s) • read-only`));
      for (const [n, m] of Object.entries(this.a.animMeta)) { const len = SA.expand(m).length; box.append(row(n, n, `${len} frame(s) • ${(len / (m.fps || 8)).toFixed(2)}s • ${m.loop}`)); }
      if (!Object.keys(this.a.animMeta).length) box.append(h('div', { class: 'mini sa-hint' }, 'No animations yet. Press ＋ New to build one (idle, walk, jump…). Use its name in the Animation block.'));
    }
    async add(dup) {
      const base = dup && this.sel ? this.a.animMeta[this.sel] : null; const n = await VX.ui.ask(dup ? 'Name for the copy' : 'Animation name (e.g. idle, walk, jump)', dup ? this.sel + ' copy' : ''); if (!n) return; if (this.a.animMeta[n]) return VX.ui.toast('That name is already used', 'warn');
      this.a.animMeta[n] = base ? JSON.parse(JSON.stringify(base)) : { fps: this.a.fps || 8, loop: 'loop', seq: this.frames.map((_, f) => ({ f, hold: 1 })) }; SA.sync(this.a, n); this.sel = n; this.k = 0; this.refreshAll(); this.changed();
    }
    async rename() { const o = this.sel; if (!o) return; const n = await VX.ui.ask('Rename animation', o); if (!n || n === o) return; if (this.a.animMeta[n]) return VX.ui.toast('That name is already used', 'warn'); const meta = {}, anims = {}; for (const [k, v] of Object.entries(this.a.animMeta)) { meta[k === o ? n : k] = v; } this.a.animMeta = meta; for (const k of Object.keys(this.a.animMeta)) anims[k] = SA.expand(this.a.animMeta[k]); this.a.anims = anims; this.sel = n; this.refreshAll(); this.changed(); }
    async del() { if (!this.sel || !(await VX.ui.confirm(`Delete the animation “${this.sel}”? Blocks that use its name will fall back to all frames.`, 'Delete', { danger: true }))) return; delete this.a.animMeta[this.sel]; delete this.a.anims[this.sel]; this.sel = Object.keys(this.a.animMeta)[0] || null; this.k = 0; this.refreshAll(); this.changed(); }
    /* ---------- properties */
    renderProps() {
      const p = this.props; p.textContent = ''; const m = this.meta;
      if (m.virtual) { p.append(h('b', {}, 'All frames'), h('div', { class: 'mini' }, 'This view plays every picture once, in order, at the sprite’s default speed. Make your own animation to choose frames, repeat them and set the timing.'), h('div', { class: 'row g6' }, h('span', { class: 'mini' }, 'Default speed'), h('input', { class: 'n', type: 'number', min: 1, max: 60, value: this.a.fps || 8, onchange: (e) => { this.a.fps = clamp(Math.round(+e.target.value) || 8, 1, 60); this.changed(); this.refreshAll(); } }), h('span', { class: 'mini' }, 'fps')), h('button', { class: 'btn primary block', onclick: () => this.add() }, '＋ New animation from all frames')); return; }
      const fps = h('input', { class: 'n', type: 'number', min: 1, max: 60, value: m.fps, onchange: (e) => { m.fps = clamp(Math.round(+e.target.value) || 8, 1, 60); this.changed(); this.renderProps(); this.renderList(); } });
      const loop = h('select', { onchange: (e) => { m.loop = e.target.value; this.changed(); this.renderList(); } }, [['loop', '🔁 Loop'], ['once', '➡ Play once'], ['pingpong', '↔ Ping-pong']].map(([v, l]) => h('option', { value: v, selected: m.loop === v }, l)));
      const total = SA.expand(m).length;
      p.append(h('b', {}, this.sel), h('div', { class: 'row g6' }, h('span', { class: 'mini' }, 'Speed'), fps, h('span', { class: 'mini' }, 'fps')), h('div', { class: 'row g6' }, h('span', { class: 'mini' }, 'When it ends'), loop),
        h('div', { class: 'sa-stat' }, h('div', {}, h('b', {}, total), ' frames'), h('div', {}, h('b', {}, (total / m.fps).toFixed(2) + ' s'), ' long')),
        h('div', { class: 'row g6 wrap' }, h('button', { class: 'btn sm', onclick: () => this.rename() }, 'Rename'), h('button', { class: 'btn sm', onclick: () => this.add(true) }, 'Duplicate'), h('button', { class: 'btn sm danger', onclick: () => this.del() }, 'Delete')),
        h('b', { class: 'sa-sub' }, 'Quick edits'), h('div', { class: 'row g6 wrap' }, h('button', { class: 'btn sm', onclick: () => { m.seq.reverse(); this.touch(); } }, '⇄ Reverse'), h('button', { class: 'btn sm', title: 'Append the frames backwards so the motion goes there and back', onclick: () => { m.seq.push(...m.seq.slice(1, -1).reverse().map((s) => ({ ...s }))); this.touch(); } }, '↔ Add return trip'), h('button', { class: 'btn sm', onclick: () => { m.seq.forEach((s) => { s.hold = Math.min(30, s.hold + 1); }); this.touch(); } }, 'Hold all +1'), h('button', { class: 'btn sm', onclick: () => { m.seq.forEach((s) => { s.hold = Math.max(1, s.hold - 1); }); this.touch(); } }, 'Hold all −1'), h('button', { class: 'btn sm', onclick: () => { m.seq = []; this.touch(); } }, 'Clear')),
        h('div', { class: 'mini sa-hint' }, 'In the Animation block, type this name. The loop mode set here is used automatically.'));
    }
    touch() { SA.sync(this.a, this.sel); this.k = Math.min(this.k, Math.max(0, this.list.length - 1)); this.changed(); this.renderList(); this.renderProps(); this.renderTimeline(); this.show(); }
    /* ---------- timeline + bin */
    renderTimeline() {
      const box = this.tl; box.textContent = ''; const m = this.meta; let start = 0; this.cards = [];
      m.seq.forEach((s, i) => {
        const card = h('div', { class: 'sa-card' + (i === this.selItem ? ' on' : ''), draggable: !m.virtual, 'data-i': i, title: `Frame ${s.f}` },
          this.thumb(s.f, 52), h('div', { class: 'sa-no' }, '#' + s.f),
          m.virtual ? null : h('div', { class: 'sa-hold' }, h('button', { class: 'btn sm', title: 'Hold shorter', onclick: (e) => { e.stopPropagation(); s.hold = Math.max(1, s.hold - 1); this.touch(); } }, '−'), h('span', { title: 'Held for this many ticks' }, '×' + s.hold), h('button', { class: 'btn sm', title: 'Hold longer', onclick: (e) => { e.stopPropagation(); s.hold = Math.min(30, s.hold + 1); this.touch(); } }, '+')),
          m.virtual ? null : h('button', { class: 'sa-x', title: 'Remove from timeline', onclick: (e) => { e.stopPropagation(); m.seq.splice(i, 1); this.selItem = -1; this.touch(); } }, '✕'));
        const st = start; card._start = st; card._len = s.hold; start += s.hold;
        card.addEventListener('click', () => { this.pause(); this.selItem = i; this.k = st; this.renderTimeline(); this.show(); });
        if (!m.virtual) { card.addEventListener('dragstart', (e) => { this._drag = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (x) { /* ignore */ } });
          card.addEventListener('dragover', (e) => { if (this._drag != null) { e.preventDefault(); card.classList.add('over'); } }); card.addEventListener('dragleave', () => card.classList.remove('over'));
          card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('over'); const from = this._drag; this._drag = null; if (from == null || from === i) return; const [it] = m.seq.splice(from, 1); m.seq.splice(i, 0, it); this.selItem = i; this.touch(); }); }
        this.cards.push(card); box.append(card);
      });
      if (!m.seq.length) box.append(h('div', { class: 'mini sa-hint' }, m.virtual ? 'This sprite has no frames.' : 'Empty timeline – click pictures in the frame bin below to add them.'));
    }
    renderBin() { const b = this.bin; b.textContent = ''; this.frames.forEach((_, f) => { const c = h('div', { class: 'sa-bf', title: 'Add frame ' + f + ' to the timeline', onclick: () => this.addFrame(f) }, this.thumb(f, 44), h('div', { class: 'sa-no' }, '#' + f)); b.append(c); }); }
    addFrame(f) { if (!this.sel) return VX.ui.toast('Create an animation first (＋ New), then add frames to it.', 'warn'); const m = this.meta; const at = this.selItem >= 0 ? this.selItem + 1 : m.seq.length; m.seq.splice(at, 0, { f, hold: 1 }); this.selItem = at; this.touch(); this.renderTimeline(); }
    addSelected() { this.addFrame(this.se.cur || 0); }
    /* ---------- stage + playback */
    fit() {
      const W = this.a.w, H = this.a.h; let z = this.zoom; if (!z) z = Math.max(1, Math.floor(Math.min(360 / W, 240 / H))); this.cv.width = W; this.cv.height = H; this.cv.style.width = W * z + 'px'; this.cv.style.height = H * z + 'px';
    }
    show() {
      const l = this.list, n = l.length, x = this.cv.getContext('2d'); x.clearRect(0, 0, this.cv.width, this.cv.height); x.imageSmoothingEnabled = false;
      const f = n ? l[Math.min(this.k, n - 1)] : null; if (f != null && this.frames[f]) x.drawImage(this.frames[f], 0, 0);
      const m = this.meta; this.info.textContent = n ? `Step ${Math.min(this.k, n - 1) + 1} / ${n}  •  picture #${f}  •  ${m.fps} fps  •  ${this.playing ? 'playing' : 'paused'}` : 'Nothing to show';
      if (this.cards) this.cards.forEach((c) => c.classList.toggle('now', n > 0 && this.k >= c._start && this.k < c._start + c._len));
    }
    toggle() { this.playing ? this.pause() : this.play(); }
    play() {
      if (!this.list.length) return; this.playing = true; this.playBtn.textContent = '⏸ Pause'; let last = performance.now(), acc = 0, dir = 1; const m = () => this.meta;
      const loop = (now) => { if (!this.playing || !this.el.isConnected) return this.pause(); acc += ((now - last) / 1000) * this.speed * (m().fps || 8); last = now; const n = this.list.length;
        while (acc >= 1 && n) { acc -= 1; const mode = m().virtual ? 'loop' : m().loop; let k = this.k + dir;
          if (k >= n) { if (mode === 'once') { this.k = n - 1; this.pause(); return; } if (mode === 'pingpong' && n > 1) { dir = -1; k = n - 2; } else k = 0; } else if (k < 0) { dir = 1; k = Math.min(1, n - 1); } this.k = k; }
        this.show(); this._raf = requestAnimationFrame(loop); };
      this._raf = requestAnimationFrame(loop); this.show();
    }
    pause() { this.playing = false; cancelAnimationFrame(this._raf); if (this.playBtn) this.playBtn.textContent = '▶ Play'; this.show && this.cv && this.show(); }
    dispose() { this.playing = false; cancelAnimationFrame(this._raf); document.removeEventListener('keydown', this.keyH); }
  }
  VX.SpriteAnimator = SpriteAnimator;

  /* ================================================================== Model animator */
  const MPROPS = [['x', 'Move X'], ['y', 'Move Y'], ['z', 'Move Z'], ['rx', 'Rotate X °'], ['ry', 'Rotate Y °'], ['rz', 'Rotate Z °'], ['sx', 'Scale X ×'], ['sy', 'Scale Y ×'], ['sz', 'Scale Z ×']];
  class ModelAnimator {
    constructor(me) {
      this.me = me; this.a = me.a; this.a.anims = this.a.anims || {}; this.sel = Object.keys(this.a.anims)[0] || null; this.editor = null;
      this.el = h('div', { class: 'ma' }); this.build();
    }
    ch() { this.me.ch(); }
    parts() { const a = this.a; if (a.kind === 'group') return (a.parts || []).map((p, i) => ({ i, name: `Part ${i + 1} (${p.type})` })); return []; }
    build() {
      const el = this.el; el.textContent = ''; if (this.prev) this.prev.dispose(); this.prev = new VX.ModelPreview(380, 280); this.prev.set(this.a, this.me.project);
      const list = h('div', { class: 'sa-list' }); const names = Object.keys(this.a.anims);
      for (const n of names) { const c = this.a.anims[n]; list.append(h('div', { class: 'sa-item' + (n === this.sel ? ' on' : ''), onclick: () => { this.sel = n; this.build(); } }, h('b', {}, n), h('span', { class: 'mini' }, `${(c.duration || 1).toFixed(2)}s • ${(c.tracks || []).length} track(s) • ${c.loop || 'loop'}`))); }
      if (!names.length) list.append(h('div', { class: 'mini sa-hint' }, 'No animations yet. Press ＋ New (e.g. idle, walk, open). Play it with the Animation block: Action “Play”, Animation name = its name.'));
      const left = h('div', { class: 'sa-left' }, h('div', { class: 'sa-h' }, h('b', {}, 'Animations'), h('span', { class: 'sp' }), h('button', { class: 'btn sm primary', onclick: () => this.add() }, '＋ New')), list,
        this.sel ? h('div', { class: 'row g6 wrap', style: 'padding:6px' }, h('button', { class: 'btn sm', onclick: () => this.rename() }, 'Rename'), h('button', { class: 'btn sm', onclick: () => this.dup() }, 'Duplicate'), h('button', { class: 'btn sm danger', onclick: () => this.del() }, 'Delete')) : null,
        h('div', { class: 'mini sa-hint' }, this.a.kind === 'group' ? 'Each part of this model can be moved, rotated and scaled over time.' : 'This model is a single mesh, so animations move, rotate or scale the whole model. Build it from primitive parts to animate pieces separately.'));
      const right = h('div', { class: 'ma-main' });
      if (this.sel) {
        const clip = this.a.anims[this.sel]; clip.tracks = clip.tracks || []; clip.duration = clip.duration || 1; clip.loop = clip.loop || 'loop'; clip.name = this.sel; const self = this;
        class Ed extends VX.AnimEditor {
          propOptions() { const o = []; for (const [k, l] of MPROPS) o.push(['w.' + k, 'Whole model – ' + l]); for (const p of self.parts()) for (const [k, l] of MPROPS) o.push([`p${p.i}.${k}`, `${p.name} – ${l}`]); return o; }
          label(p) { const m = /^(w|p(\d+))\.(\w+)$/.exec(p); if (!m) return p; const pl = MPROPS.find((x) => x[0] === m[3]); return (m[1] === 'w' ? 'Whole' : 'Part ' + (+m[2] + 1)) + ' · ' + (pl ? pl[1] : m[3]); }
          defaultValue(p) { return /\.s[xyz]$/.test(p) ? 1 : 0; }
          makeStage() { return self.prev.el; }
          drawStage() { const vals = {}; for (const tr of this.a.tracks) vals[tr.prop] = VXRT.trackValue(tr, this.t); VXRT.poseModel(self.prev.obj && self.prev.obj, vals); self.prev.draw(); }
        }
        Ed.prototype.allowVars = false;
        this.editor && this.editor.dispose && this.editor.dispose(); this.editor = new Ed(clip, this.me.project, () => this.ch()); this.editor.allowVars = false; this.editor.build(); right.append(this.editor.el);
        [...this.editor.el.querySelectorAll('select')].forEach((x) => { if (x.options[0] && /preset/i.test(x.options[0].textContent)) x.remove(); });
        /* relative makes no sense for poses – hide it */ const lab = [...this.editor.el.querySelectorAll('label.mini')].find((x) => /Relative/.test(x.textContent)); if (lab) lab.style.display = 'none';
      } else right.append(h('div', { class: 'as-empty' }, 'Create an animation to start posing the model.'), this.prev.el);
      el.append(left, right);
    }
    async add() { const n = await VX.ui.ask('Animation name (e.g. idle, walk, open)'); if (!n) return; if (this.a.anims[n]) return VX.ui.toast('That name is already used', 'warn'); this.a.anims[n] = { id: VX.uid ? VX.uid('an') : n, name: n, duration: 1, loop: 'loop', tracks: [] }; this.sel = n; this.ch(); this.build(); }
    async rename() { const o = this.sel, n = await VX.ui.ask('Rename animation', o); if (!n || n === o) return; if (this.a.anims[n]) return VX.ui.toast('That name is already used', 'warn'); const out = {}; for (const [k, v] of Object.entries(this.a.anims)) out[k === o ? n : k] = v; this.a.anims = out; this.sel = n; this.ch(); this.build(); }
    async dup() { const n = await VX.ui.ask('Name for the copy', this.sel + ' copy'); if (!n || this.a.anims[n]) return; this.a.anims[n] = JSON.parse(JSON.stringify(this.a.anims[this.sel])); this.a.anims[n].name = n; this.sel = n; this.ch(); this.build(); }
    async del() { if (!(await VX.ui.confirm(`Delete the animation “${this.sel}”?`, 'Delete', { danger: true }))) return; delete this.a.anims[this.sel]; this.sel = Object.keys(this.a.anims)[0] || null; this.ch(); this.build(); }
    dispose() { this.editor && this.editor.dispose && this.editor.dispose(); this.prev && this.prev.dispose(); }
  }
  VX.ModelAnimator = ModelAnimator;
})();
