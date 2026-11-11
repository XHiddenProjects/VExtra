/* Block demo framework – injected into the Vextra editor page by build.js.  Each recipe builds a tiny real game that uses the block, plus the data the clip needs. */
(function () {
  const K = VX.exKit, PH = K.PH, R = (window.__demos = {});
  const SPACE = [[700, 'key', 'Space'], [2300, 'key', 'Space']];
  /** def(id, caption, graphFn, options) – options: dim '3d', scene (graph on the scene, not on Box), gravity, setup(p, add), script [[ms, op, ...]], ms (length), box {…} */
  const def = (id, cap, graph, o) => { R[id] = Object.assign({ cap, graph, script: SPACE, ms: 4200 }, o || {}); };
  window.__def = def;
  window.__mk = function (id) {
    const s = R[id], d3 = s.dim === '3d', p = K.proj('Demo ' + id, d3 ? '3d' : '2d', d3 ? '#0b1020' : '#0f172a'); const sc = p.scenes[0];
    sc.gravity = d3 ? { x: 0, y: s.gravity === undefined ? 0 : -9.8, z: 0 } : { x: 0, y: s.gravity || 0, z: 0 };
    if (d3) sc.camera3d = { mode: 'fixed', pos: { x: 0, y: 2.2, z: 7 }, target: { x: 0, y: 0.6, z: 0 }, fov: 55, yaw: 0 };
    if (d3) K.sky(p, 0.6, 0.5);
    if (s.touch) p.settings.touch = { mode: 'on' };
    K.synth(p, 'demo', 'triangle', 440, 880, 0.25, 0.3);
    let aux = [];
    const bid = K.bhv(p, 'Demo', (api) => {
      const { block, gv, lab, put } = api; let hud = null, val = null;
      const mark = (h) => { h.node.aux = true; return h; };
      const H = {
        fire(h, port, text) { if (!hud) { mark(gv('n', 'set', 0, 0)); hud = mark(lab('hud', text || 'Fired: {n}', 'topRight', 30, '#ffd23f', 14, 16)); } const e = mark(block('emit', { target: 'self', count: 20, color: '#ffd23f', speed: d3 ? 3 : 200, spread: 360, life: 0.7, size: d3 ? 0.08 : 7, gravity: 0 })); h.to(e, port || 'out', 'emit'); const pu = put('n', 'add', 1); mark(pu); pu.gv.node.aux = true; h.to(pu, port || 'out'); return e; },
        show(h, port, text) { if (!val) val = mark(lab('val', text || 'Value: {value}', 'bottom', 34, '#7ee787', 24, 0)); h.to(val, port || 'out', 'in'); return val; },
        aux: mark
      };
      s.graph(Object.assign({}, api, { H, fire: H.fire, show: H.show, mark }), H);
    });
    const add = (type, name, x, y, extra) => K.add(p, d3 ? '3d' : '2d', type, name, x, y, extra);
    const bx = s.box || {};
    if (d3) { add('cube', 'Floor', 0, -0.25, Object.assign({ z: 0, w: 14, h: 0.5, d: 14, color: '#27324f', tags: ['floor'], physics: s.gravity ? PH('static') : undefined })); }
    const boxExtra = Object.assign(d3 ? { z: 0, w: 1.2, h: 1.2, d: 1.2, color: '#4db8ff', tags: ['box'] } : { w: 90, h: 90, color: '#4db8ff', tags: ['box'] }, bx);
    if (!s.scene) boxExtra.behaviors = [bid];
    if (s.phys) boxExtra.physics = PH('dynamic', Object.assign({ shape: d3 ? 'box' : 'box', friction: 0.4, bounce: 0.2 }, s.phys));
    if (s.pre) s.pre(p, add);
    add(d3 ? 'cube' : 'rect', 'Box', d3 ? 0 : 300, d3 ? 0.6 : 300, boxExtra);
    if (s.scene) K.scene(p, [bid]);
    if (s.setup) s.setup(p, add, PH);
    let g = p.behaviors[bid].graph; if (s.diagram === 'inner') { const bn = g.nodes.find((n) => n.type === 'bundle'); if (bn && bn.graph) g = bn.graph; }
    const nodes = g.nodes.map((n) => ({ id: n.id, type: n.type, params: n.params, label: n.label, x: n.x, y: n.y, aux: !!n.aux }));
    for (const n of nodes) { const d = VXRT.blocks[n.type]; if (!d) continue; const dp = VXRT.paramDefaults(d); n.title = n.label || d.label; n.cat = d.cat; const ch = []; for (const k of Object.keys(n.params || {})) { const v = n.params[k]; if (String(v) !== String(dp[k]) && v !== '' && v !== undefined) ch.push(k + ': ' + String(v).replace(/\n/g, ' ').slice(0, 22)); } n.sum = ch.slice(0, 4); }
    return { project: p, graph: { nodes, wires: g.wires }, cap: s.cap, script: s.script, ms: d3 ? s.ms + 1800 : s.ms, id };
  };
})();
