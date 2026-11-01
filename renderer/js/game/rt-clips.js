/* Vextra game runtime – keyframe animation clips (assets.animations). Works for 2D and 3D objects.
 * clip: { id, name, duration, loop:'once'|'loop'|'pingpong', tracks:[{ prop, keys:[{ t, v, e }] }] }   (e = easing name, default "linear")
 * Numeric tracks: x y z rot rx ry rz w h d alpha frame + any object variable written as var:name. Colour tracks use "#rrggbb" values. */
(function () {
  const VXRT = window.VXRT, U = VXRT.util;
  const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
  const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const toHex = (a) => '#' + a.map((x) => Math.round(U.clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
  /** Value of one track at time t. */
  VXRT.trackValue = function (tr, t) {
    const k = tr.keys || []; if (!k.length) return undefined; if (t <= k[0].t) return k[0].v; const last = k[k.length - 1]; if (t >= last.t) return last.v;
    let i = 0; while (i < k.length - 2 && t >= k[i + 1].t) i++; const a = k[i], b = k[i + 1]; const span = b.t - a.t || 1e-6; let f = (t - a.t) / span; const e = a.e || 'linear';
    if (e === 'step') f = 0; else if (e !== 'linear') f = VXRT.ease.get(e)(f);
    if (isColor(a.v) && isColor(b.v)) { const ca = hex(a.v), cb = hex(b.v); return toHex(ca.map((x, j) => x + (cb[j] - x) * f)); }
    return U.num(a.v) + (U.num(b.v) - U.num(a.v)) * f;
  };
  /** Fold a time into the clip's range according to its loop mode. Returns { t, done }. */
  function fold(c, time, mode) {
    const D = Math.max(0.001, c.duration || 1); if (mode === 'loop') return { t: ((time % D) + D) % D, done: false };
    if (mode === 'pingpong') { const m = ((time % (2 * D)) + 2 * D) % (2 * D); return { t: m > D ? 2 * D - m : m, done: false }; }
    return { t: Math.min(time, D), done: time >= D };
  }
  const APPLY = (g, o, prop, v, rel, base) => {
    if (v === undefined) return;
    if (prop === 'color') { o.color = v; if (o.material) o.material.color = v; return; }
    if (prop === 'frame') { o.anim.playing = false; o.anim.frame = Math.round(U.num(v)); return; }
    if (prop.startsWith('var:')) { o.vars[prop.slice(4)] = v; return; }
    if (typeof o[prop] === 'number' || o[prop] === undefined) o[prop] = (rel && typeof v === 'number' ? (base[prop] ?? 0) : 0) + (typeof v === 'number' ? v : U.num(v)); if (prop === 'rx' || prop === 'ry' || prop === 'rz') o.dirty3dRot = true;
  };
  /** Start a clip on an object. opts: { speed, mode (clip default if empty), relative, onDone } */
  VXRT.playClip = function (g, o, clip, opts) {
    if (!clip) return null; opts = opts || {}; o.clips = o.clips || []; const base = {}; for (const tr of clip.tracks || []) if (typeof o[tr.prop] === 'number') base[tr.prop] = o[tr.prop];
    const rec = { clip, time: 0, speed: opts.speed || 1, mode: opts.mode || clip.loop || 'once', relative: !!(opts.relative || clip.relative), base, onDone: opts.onDone, paused: false, id: opts.id || clip.id };
    o.clips = o.clips.filter((c) => c.id !== rec.id); o.clips.push(rec); return rec;
  };
  VXRT.stopClip = (o, id) => { if (!o.clips) return; o.clips = id ? o.clips.filter((c) => c.id !== id) : []; };
  VXRT.stepClips = function (g, dt) {
    for (const o of g.objects) {
      if (!o.clips || !o.clips.length || !o.alive) continue;
      for (const r of [...o.clips]) {
        if (r.paused) continue; r.time += dt * r.speed; const f = fold(r.clip, r.time, r.mode);
        for (const tr of r.clip.tracks || []) APPLY(g, o, tr.prop, VXRT.trackValue(tr, f.t), r.relative, r.base);
        if (f.done) { o.clips = o.clips.filter((c) => c !== r); try { r.onDone && r.onDone(o); } catch (e) { g.log('error', e.message); } }
      }
    }
  };
  VXRT.CLIP_PROPS = ['x', 'y', 'z', 'rot', 'rx', 'ry', 'rz', 'w', 'h', 'd', 'alpha', 'color', 'frame'];
})();
