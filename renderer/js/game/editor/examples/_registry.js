/* Vextra game editor – example games shown in Library → Games. examples-2d.js / examples-3d.js push entries:
 *   VX.gameExamples.push({ id, name, desc, type: 'game2d' | 'game3d', build: () => project })
 * VX.exKit has the small helpers they share (project, objects, synth sounds, scripts). */
(function () {
  VX.gameExamples = VX.gameExamples || [];
  const GP = () => VX.GameProject;
  const PH = (body, extra) => Object.assign({ body, shape: 'box', bounce: 0, friction: 0.2, gravityScale: 1, mass: 1 }, extra || {});
  VX.exKit = {
    PH,
    /** new project; dim '2d' | '3d' */
    proj(title, dim, bg) { const p = GP().blank({ name: title, dim }); p.settings.title = title; p.settings.bg = bg; p.scenes[0].bg = bg; p.scenes[0].name = 'Main'; if (dim === '2d') p.scenes[0].gravity = { x: 0, y: 980, z: 0 }; return p; },
    /** a synthesised sound: kit.synth(p, 'hit', 'noise', 800, 90, 0.25, 0.4) */
    synth(p, id, wave, f0, f1, dur, vol) { p.assets.sounds['snd_' + id] = { id: 'snd_' + id, name: id, kind: 'synth', params: { wave, freq: f0, freqEnd: f1, dur, attack: 0.002, decay: dur * 0.3, sustain: 0.4, release: dur * 0.4, vol: vol || 0.35 } }; },
    /** add an object: kit.add(p, '2d', 'rect', 'Wall', x, y, { w, h, color, physics, tags, script … }) – z (3D) goes in extra.z */
    add(p, dim, type, name, x, y, extra) { const o = Object.assign(GP().newObject(type, dim, x, y, (extra && extra.z) || 0, []), { name }, extra || {}); if (typeof o.script === 'string') { VX.exKit.toBehavior(p, o); } (p.scenes[p.cur || 0]).objects.push(o); return o; },
    /** turns an inline script into a project behaviour ("Player script") that shows up in the Logic tab and can be edited, reused or attached elsewhere */
    toBehavior(p, o) { const code = o.script; delete o.script; if (!code || !code.trim()) return; const base = 'b_' + String(o.name).toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, ''); let id = base, n = 2; while (p.behaviors[id]) id = base + '_' + n++; p.behaviors[id] = { id, name: o.name + ' script', mode: 'code', code }; o.behaviors = (o.behaviors || []).concat(id); },

    /** Build a block graph with a tiny DSL (the same block(...).to(...) calls the code view understands) and lay it out in columns:
     *    K.graph(({ block, gv, ex, lab }) => { block('keyboard', { key: 'space' }).to(gv('score', 'add', 1)); })
     *  Returns { nodes, wires } for a behaviour (mode 'graph'). Handles also take  .to(next, 'outPort', 'inPort'). */
    graph(fn) {
      const nodes = [], wires = []; let c = 0;
      const wrap = (node) => ({ id: node.id, node, to(next, out, inp) { wires.push({ from: node.id, out: out || 'out', to: next.id, in: inp || 'in' }); return next; } });
      const block = (type, params, label) => { const node = { id: 'n' + ++c + '_' + type, type, params: params || {}, x: 0, y: 0 }; if (label) node.label = label; nodes.push(node); return wrap(node); };
      const api = {
        block,
        gv: (name, op, amount, initial, label) => block('globalVariable', { name, op: op || 'set', amount: amount === undefined ? 1 : amount, initial: initial === undefined ? 0 : initial }, label),
        /** change a global variable by a fixed amount: a Number block feeds the Global Variable (so whatever signal triggers it, the amount is what you typed) */
        put: (name, op, amount, label) => { const num = block('number', { value: amount === undefined ? 1 : amount }), g = block('globalVariable', { name, op: op || 'add', amount: 1, initial: 0 }, label); num.to(g); return { id: num.id, node: num.node, to: (next, out, inp) => g.to(next, out, inp), gv: g }; },
        ex: (expr, label, trigger) => block('expression', { expr, trigger: trigger || 'any' }, label),
        lab: (id, text, anchor, size, color, y, x) => block('label', { id, text, anchor: anchor || 'topLeft', size: size || 22, color: color || '#ffffff', y: y === undefined ? 12 : y, x: x === undefined ? 16 : x }),
        start: (delay) => block('once', { when: 'start', delay: delay || 0 }),
        key: (k, mode) => block('keyboard', { key: k, mode: mode || 'down' }),
        snd: (id, vol) => block('sound', { sound: 'snd_' + id, volume: vol || 1 }),
        flt: (op, value, value2) => block('filter', { op, value: String(value === undefined ? 0 : value), value2: String(value2 === undefined ? 1 : value2) }),
      };
      fn(api);
      /* layout: columns by longest path from the sources, each connected group stacked under the previous one */
      const byId = new Map(nodes.map((n) => [n.id, n])), inc = new Map(nodes.map((n) => [n.id, []])), outg = new Map(nodes.map((n) => [n.id, []]));
      for (const w of wires) { inc.get(w.to).push(w.from); outg.get(w.from).push(w.to); }
      const comp = new Map(); let nc = 0; const walk = (id, k) => { if (comp.has(id)) return; comp.set(id, k); for (const x of [...inc.get(id), ...outg.get(id)]) walk(x, k); };
      for (const n of nodes) if (!comp.has(n.id)) walk(n.id, nc++);
      const lvl = new Map(); const depth = (id, seen) => { if (lvl.has(id)) return lvl.get(id); if (seen.has(id)) return 0; seen.add(id); const d = inc.get(id).length ? 1 + Math.max(...inc.get(id).map((x) => depth(x, seen))) : 0; seen.delete(id); lvl.set(id, d); return d; };
      for (const n of nodes) depth(n.id, new Set());
      let yOff = 0;
      for (let k = 0; k < nc; k++) { const g = nodes.filter((n) => comp.get(n.id) === k), cols = {}; for (const n of g) (cols[lvl.get(n.id)] = cols[lvl.get(n.id)] || []).push(n); let rows = 1; for (const [l, list] of Object.entries(cols)) { rows = Math.max(rows, list.length); list.forEach((n, i) => { n.x = 40 + l * 300; n.y = 40 + yOff + i * 190; }); } yOff += rows * 190 + 50; }
      return { nodes, wires };
    },
    /** registers a block-graph behaviour in project.behaviors; returns its id */
    bhv(p, name, fn) { const base = 'b_' + String(name).toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, ''); let id = base, n = 2; while (p.behaviors[id]) id = base + '_' + n++; p.behaviors[id] = { id, name, mode: 'graph', graph: VX.exKit.graph(fn), code: '' }; return id; },
    /** add another scene (level); everything K.add / K.scene does afterwards goes into it */
    newScene(p, name, bg, dim) { const sc = GP().blankScene(dim || '2d'); sc.name = name; sc.bg = bg || p.settings.bg; if ((dim || '2d') === '2d') sc.gravity = Object.assign({}, p.scenes[0].gravity); p.scenes.push(sc); p.cur = p.scenes.length - 1; return sc; },
    /** attach behaviours to the scene itself (game rules, HUD …) */
    scene(p, ids) { const sc = p.scenes[p.cur || 0]; sc.behaviors = (sc.behaviors || []).concat(ids); },
    /** sun + sky light for a 3D scene */
    sky(p, sun, sky) { const k = VX.exKit; k.add(p, '3d', 'light', 'Sun', 8, 14, { z: 6, props: { kind: 'directional', intensity: sun === undefined ? 1.2 : sun, shadows: true, angle: 40, range: 0 } }); k.add(p, '3d', 'light', 'Sky light', 0, 6, { z: 0, props: { kind: 'hemisphere', intensity: sky === undefined ? 0.6 : sky, shadows: false, angle: 40, range: 0 } }); },
    /** a material asset: returns its id, use it as { matAsset: id } */
    mat(p, name, props) { const id = 'mat_' + name.replace(/\W+/g, '_').toLowerCase(); p.assets.materials = p.assets.materials || {}; p.assets.materials[id] = Object.assign({ id, name, color: '#cccccc', metalness: 0.1, roughness: 0.7, emissive: '#000000', emissiveIntensity: 1, opacity: 1, pattern: 'none', color2: '#444444', repeatX: 1, repeatY: 1, wireframe: false, flat: false, doubleSided: false }, props); return id; },
    /** an invisible object that carries the game's rules as a script */
    rules(p, dim, code) { return VX.exKit.add(p, dim, 'empty', 'Game rules', 0, 0, { behaviors: [VX.exKit.beh(p, p.name + ' – game rules', code)] }); },
    /** registers a code behaviour in project.behaviors (the same shape the Logic tab creates) and returns its id so an object can list it in `behaviors` */
    beh(p, name, code) { const base = 'b_' + String(name).toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, ''); let id = base, n = 2; while (p.behaviors[id]) id = base + '_' + n++; p.behaviors[id] = { id, name, mode: 'code', graph: { nodes: [], wires: [] }, code }; return id; },
  };
})();
