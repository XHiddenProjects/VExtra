/* Vextra blocks – 4. Properties (15): read and change the attributes of an object. */
(function () {
  const VXRT = window.VXRT, U = VXRT.util, B = VXRT.registerBlock, P = VXRT.P, each = VXRT.each;
  const is3 = (g) => g.dim === '3d';
  const blank = (s) => s === '' || s === undefined || s === null || (typeof s === 'string' && Number.isNaN(parseFloat(s)));
  const pv = (s) => (blank(s) ? null : parseFloat(s));
  const TW = [P.num('duration', 'Transition time (s, 0 = instant)', 0, { min: 0, step: 0.1 }), P.sel('ease', 'Easing', VXRT.ease.names, 'quadOut')];
  const SRC = (xs) => P.sel('source', 'Values come from', [['params', 'The fields below'], ...xs]);
  const setv = (n, o, key, mode, v) => { const cur = o[key]; VXRT.tween(o, key, mode === 'add' ? cur + v : mode === 'multiply' ? cur * v : v, U.num(n.p.duration), n.p.ease); };
  const pos = (o) => ({ x: o.x, y: o.y, z: o.z });

  B({ id: 'position', cat: 'properties', label: 'Position', desc: 'Sets or moves an object\'s position. Leave a field empty to keep that axis. Y points down in 2D and up in 3D. Can take the values from the incoming signal.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set to'], ['add', 'Move by']]), P.text('x', 'X', ''), P.text('y', 'Y', ''), P.text('z', 'Z (3D)', ''), SRC([['signalX', 'Signal → X'], ['signalY', 'Signal → Y'], ['signalZ', 'Signal → Z'], ['signalXY', 'Signal {x,y,z} object']]), ...TW],
    onInput(n, port, v, g) { each(n, g, (o) => { const s = n.p.source; const val = { x: pv(n.p.x), y: pv(n.p.y), z: pv(n.p.z) }; if (s === 'signalX') val.x = U.num(v); else if (s === 'signalY') val.y = U.num(v); else if (s === 'signalZ') val.z = U.num(v); else if (s === 'signalXY' && v && typeof v === 'object') { val.x = v.x ?? null; val.y = v.y ?? null; val.z = v.z ?? null; } for (const k of ['x', 'y', 'z']) if (val[k] !== null) setv(n, o, k, n.p.mode, val[k]); if (o.vx !== undefined && n.p.mode === 'set' && U.num(n.p.duration) === 0) { /* teleport keeps velocity */ } g.send(n, 'out', pos(o)); }); } });

  B({ id: 'rotation', cat: 'properties', label: 'Rotation', desc: 'Sets or adds to rotation in degrees. 2D rotates around the centre; in 3D pick the axis (Y = turning left/right).',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set to'], ['add', 'Rotate by']]), P.num('angle', 'Angle (°)', 90), P.sel('axis', '3D axis', ['y', 'x', 'z']), SRC([['signal', 'The incoming number']]), ...TW],
    onInput(n, port, v, g) { each(n, g, (o) => { const a = n.p.source === 'signal' ? U.num(v) : U.num(n.p.angle); setv(n, o, is3(g) ? 'r' + n.p.axis : 'rot', n.p.mode, a); g.send(n, 'out', is3(g) ? o.ry : o.rot); }); } });

  B({ id: 'alpha', cat: 'properties', label: 'Alpha', desc: 'Transparency: 1 = solid, 0 = invisible. Fade things in and out with a transition time.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set to'], ['add', 'Add'], ['multiply', 'Multiply by']]), P.num('value', 'Value', 0.5, { min: -1, max: 1, step: 0.05 }), SRC([['signal', 'The incoming number']]), ...TW],
    onInput(n, port, v, g) { each(n, g, (o) => { const a = n.p.source === 'signal' ? U.num(v) : U.num(n.p.value); setv(n, o, 'alpha', n.p.mode, a); g.send(n, 'out', o.alpha); }); } });

  B({ id: 'size', cat: 'properties', label: 'Size', desc: 'Changes width / height (and depth in 3D). Leave empty to keep an axis. "Multiply by" scales relative to the current size.',
    inputs: ['in'], outputs: ['out', 'w', 'h', 'd'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set to'], ['add', 'Add'], ['multiply', 'Multiply by']]), P.text('w', 'Width', ''), P.text('h', 'Height', ''), P.text('d', 'Depth (3D)', ''), P.bool('uniform', 'Use the Width value for all axes', false), SRC([['signal', 'The incoming number (all axes)']]), ...TW],
    onInput(n, port, v, g) { each(n, g, (o) => { let w = pv(n.p.w), h = pv(n.p.h), d = pv(n.p.d); if (n.p.source === 'signal') w = h = d = U.num(v); else if (n.p.uniform && w !== null) h = d = w; if (w !== null) setv(n, o, 'w', n.p.mode, w); if (h !== null) setv(n, o, 'h', n.p.mode, h); if (d !== null && is3(g)) setv(n, o, 'd', n.p.mode, d); g.send(n, 'w', o.w); g.send(n, 'h', o.h); g.send(n, 'd', o.d); g.send(n, 'out', { w: o.w, h: o.h, d: o.d }); }); } });

  B({ id: 'enabled', cat: 'properties', label: 'Enabled', desc: 'Turns an object on or off. Visible = drawn; Active = takes part in physics and movement. Its blocks keep running so something can switch it back on.',
    inputs: ['in', 'enable', 'disable', 'toggle'], outputs: ['out'], params: [P.target(), P.sel('state', 'When "in" arrives', [['enable', 'Enable'], ['disable', 'Disable'], ['toggle', 'Toggle'], ['signal', 'Follow the signal (true/false)']]), P.sel('what', 'Affects', [['all', 'Visible and active'], ['visible', 'Visible only'], ['active', 'Active only']])],
    onInput(n, port, v, g) { const st = port === 'in' ? n.p.state : port; each(n, g, (o) => { const cur = n.p.what === 'active' ? o.enabled : o.visible; const on = st === 'enable' ? true : st === 'disable' ? false : st === 'toggle' ? !cur : U.truthy(v); if (n.p.what !== 'active') o.visible = on; if (n.p.what !== 'visible') o.enabled = on; g.send(n, 'out', on); }); } });

  const FX = { bounce: (t, a, g) => ({ y: (is3(g) ? 1 : -1) * Math.sin(t * Math.PI) * a }), pulse: (t, a) => ({ sx: 1 + Math.sin(t * Math.PI) * a * 0.01, sy: 1 + Math.sin(t * Math.PI) * a * 0.01 }), shake: (t, a) => ({ x: Math.sin(t * 70) * a * (1 - t) }), spin: (t) => ({ rot: 360 * VXRT.ease.curves.quadInOut(t) }), fadeOut: (t) => ({ alpha: 1 - t }), fadeIn: (t) => ({ alpha: t }), wobble: (t, a) => ({ rot: Math.sin(t * Math.PI * 6) * a * (1 - t) }), jelly: (t, a) => ({ sx: 1 + Math.sin(t * Math.PI * 4) * a * 0.01 * (1 - t), sy: 1 - Math.sin(t * Math.PI * 4) * a * 0.01 * (1 - t) }) };
  /* ---- the one Animation block: sprite frame animations, 3D model poses, keyframe clips, automatic movement animation and effect presets ---- */
  const ROLE = { idle: /idle|stand|rest|breath|wait|default/i, walk: /walk|run|move|jog|sprint|step/i, jump: /jump|rise|up|leap|hop/i, fall: /fall|drop|down|land|air/i };
  const spriteOf = (g, o) => o.type === 'sprite' && g.data.assets?.sprites?.[o.props.sprite], modelOf = (g, o) => o.type === 'model' && g.data.assets?.models?.[o.props.model];
  /** every animation name this object can play: its sprite's, its model's, and the project's keyframe clips */
  VXRT.animsOf = function (g, o) {
    const out = [], sp = spriteOf(g, o), md = modelOf(g, o), cl = (g.data.assets && g.data.assets.animations) || {};
    if (sp) for (const k of Object.keys(sp.anims || {})) out.push({ name: k, kind: 'sprite' }); if (md) for (const k of Object.keys(md.anims || {})) out.push({ name: k, kind: 'model' });
    for (const c of Object.values(cl)) out.push({ name: c.name, id: c.id, kind: 'clip' }); return out;
  };
  /** find what a name refers to for this object ("clip:<id>" forces a keyframe clip) */
  VXRT.resolveAnim = function (g, o, name) {
    const cl = (g.data.assets && g.data.assets.animations) || {}; name = name || '';
    if (name.startsWith('clip:')) { const c = cl[name.slice(5)]; return c ? { kind: 'clip', clip: c, name: c.name } : null; }
    const sp = spriteOf(g, o), md = modelOf(g, o);
    if (!name) return sp && sp.frames && sp.frames.length > 1 ? { kind: 'sprite', name: null } : null;
    if (sp && sp.anims && sp.anims[name]) return { kind: 'sprite', name }; if (md && md.anims && md.anims[name]) return { kind: 'model', name };
    const c = Object.values(cl).find((x) => x.name === name || x.id === name); return c ? { kind: 'clip', clip: c, name: c.name } : null;
  };
  /** automatic choice for a role (idle / walk / jump / fall) from the names the object actually has */
  VXRT.pickAnim = function (g, o, role, explicit) {
    if (explicit) return explicit; const list = VXRT.animsOf(g, o); const own = list.filter((a) => a.kind !== 'clip'), pool = own.length ? own : list;
    const hit = (r) => pool.find((a) => ROLE[r].test(a.name)); const a = hit(role) || (role === 'fall' ? hit('jump') : null); return a ? (a.kind === 'clip' ? 'clip:' + a.id : a.name) : '';
  };
  const stopAll = (o, name) => { o.anim.playing = false; if (o.clips && o.clips.length) o.clips = []; };
  function playOn(n, g, o, name, restart) {
    const r = VXRT.resolveAnim(g, o, name); if (!r) { if (name) g.log('warn', `Animation block: “${name}” was not found on ${o.name} (sprite/model animations or keyframe clips).`); return false; }
    const key = r.kind + ':' + (r.name || ''); if (!restart && o._animKey === key && (o.anim.playing || (o.clips || []).length)) return true; o._animKey = key;
    const mode = n.p.mode || '', speed = U.num(n.p.speed, 1) || 1, done = () => g.send(n, 'done', o.name);
    if (r.kind === 'clip') { o.anim.playing = false; VXRT.playClip(g, o, r.clip, { speed, mode, relative: !!n.p.relative, id: r.clip.id, onDone: done }); }
    else { o.clips = []; Object.assign(o.anim, { name: r.name, t: 0, frame: 0, playing: true, mode, loop: mode !== 'once', speed, fps: U.num(n.p.fps) || undefined, onDone: done }); }
    return true;
  }
  const FXLIST = Object.keys(FX);
  B({ id: 'animation', cat: 'properties', label: 'Animation', icon: '🎞️', desc: 'The one block for every kind of animation. It looks at its target and offers what that object can play: sprite frame animations, 3D model poses and keyframe clips. Actions: Auto (plays idle / walk / jump / fall by itself from how the object moves – no wiring), Play, Pause, Resume, Stop, Show frame and quick Effect presets. A held key can trigger it every frame: a running animation is never restarted unless "Restart" is on. Outputs: out, done (when it ends), state (Auto: idle / walk / jump / fall).',
    inputs: ['in', 'stop', 'pause', 'resume', 'speed'], outputs: ['out', 'done', 'state'],
    params: [P.target(), P.sel('action', 'Action', [['play', 'Play animation'], ['auto', 'Auto (idle / walk / jump from movement)'], ['pause', 'Pause'], ['resume', 'Resume'], ['stop', 'Stop'], ['frame', 'Show a specific frame'], ['preset', 'Effect preset']]),
      P.anim('anim', 'Animation (synced with the target)'), P.sel('mode', 'When it ends', [['', 'Animation default'], ['loop', 'Loop'], ['once', 'Play once'], ['pingpong', 'Ping-pong']], ''), P.num('speed', 'Speed (×)', 1, { step: 0.1 }), P.num('fps', 'Frames per second (0 = animation default)', 0), P.bool('restart', 'Restart if already playing', false), P.bool('relative', 'Keyframe clips: relative to where the object is', false), P.num('frame', 'Frame', 0),
      P.text('idle', 'Auto: idle animation (empty = detect)', ''), P.text('walk', 'Auto: walking animation (empty = detect)', ''), P.text('jump', 'Auto: jump animation (empty = detect)', ''), P.text('fall', 'Auto: falling animation (empty = detect)', ''), P.num('moveSpeed', 'Auto: counts as moving above (0 = auto)', 0, { min: 0 }), P.bool('face', 'Auto: face the way it moves', true),
      P.sel('preset', 'Preset', FXLIST), P.num('duration', 'Effect time (s)', 0.5, { step: 0.1 }), P.num('amount', 'Effect amount', 20)],
    onInput(n, port, v, g) {
      const a = port === 'in' ? n.p.action : port;
      if (port === 'speed') { each(n, g, (o) => { o.anim.speed = U.num(v, 1); (o.clips || []).forEach((c) => { c.speed = U.num(v, 1); }); }); return; }
      if (a === 'stop') { each(n, g, (o) => { stopAll(o); o._animKey = null; o.fxo = null; }); n.st.fx = null; return; }
      if (a === 'auto') { n.st.auto = true; return; }
      each(n, g, (o) => {
        if (a === 'play') playOn(n, g, o, n.p.anim, n.p.restart);
        else if (a === 'pause') { o.anim.playing = false; (o.clips || []).forEach((c) => { c.paused = true; }); }
        else if (a === 'resume') { if (o.anim.name !== undefined && o._animKey && o._animKey.startsWith('clip:') === false) o.anim.playing = true; (o.clips || []).forEach((c) => { c.paused = false; }); }
        else if (a === 'frame') { stopAll(o); o.anim.frame = U.num(n.p.frame); }
      });
      if (a === 'preset') { n.st.fx = { t: 0, dur: Math.max(0.05, U.num(n.p.duration, 0.5)), f: FX[n.p.preset] || FX.bounce }; } g.send(n, 'out', 1); },
    init(n) { if (n.p.action === 'auto') n.st.auto = true; },
    update(n, dt, g) {
      const fx = n.st.fx; if (fx) { fx.t += dt; const t = Math.min(1, fx.t / fx.dur); const r = fx.f(t, U.num(n.p.amount, 20), g); each(n, g, (o) => { o.fxo = t >= 1 ? null : r; }); if (t >= 1) { n.st.fx = null; g.send(n, 'done', 1); } }
      if (!n.st.auto || g.paused) return; const is3 = g.dim === '3d';
      each(n, g, (o) => {
        if (!o.alive || !o.anim) return; const thr = U.num(n.p.moveSpeed) || (is3 ? 0.4 : 20), sp = is3 ? Math.hypot(o.vx || 0, o.vz || 0) : Math.abs(o.vx || 0);
        o.air = o.grounded ? 0 : (o.air || 0) + dt; const air = o.air > 0.08, vy = o.vy || 0, rising = is3 ? vy > 0.5 : vy < -30;
        const st = air ? (rising ? 'jump' : 'fall') : sp > thr ? 'walk' : 'idle';
        if (n.p.face && sp > thr) { if (is3) o.ry = (Math.atan2(o.vx || 0, o.vz || 0) * 180) / Math.PI; else o.flipX = (o.vx || 0) < 0; }
        if (o._maState === st) return; o._maState = st;
        const name = VXRT.pickAnim(g, o, st, n.p[st]) || (st === 'fall' ? VXRT.pickAnim(g, o, 'jump', n.p.jump) : '') || VXRT.pickAnim(g, o, 'idle', n.p.idle);
        if (name) playOn(n, g, o, name, true); g.send(n, 'state', st);
      });
    } });

  B({ id: 'velocity', cat: 'properties', label: 'Velocity', desc: 'Sets, adds to, scales or stops an object\'s velocity (units per second). Use "Facing" to move along the way the object points, "Camera" for first-person movement in 3D.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set to'], ['add', 'Add'], ['multiply', 'Multiply by'], ['stop', 'Stop (all zero)']]), P.text('x', 'X', ''), P.text('y', 'Y', ''), P.text('z', 'Z (3D)', ''), P.sel('space', 'Directions are', [['world', 'World'], ['facing', 'Relative to facing'], ['camera', 'Relative to camera (3D)']]), SRC([['signalX', 'Signal → X'], ['signalY', 'Signal → Y'], ['signalZ', 'Signal → Z']])],
    onInput(n, port, v, g) { each(n, g, (o) => { if (n.p.mode === 'stop') { o.vx = o.vy = o.vz = 0; return g.send(n, 'out', 0); } let x = pv(n.p.x), y = pv(n.p.y), z = pv(n.p.z); const s = n.p.source; if (s === 'signalX') x = U.num(v); else if (s === 'signalY') y = U.num(v); else if (s === 'signalZ') z = U.num(v);
      if (n.p.space !== 'world') { const yaw = n.p.space === 'camera' && is3(g) ? U.rad(g.cam3d.yaw) : is3(g) ? U.rad(o.ry) : U.rad(o.rot); if (is3(g)) { const lx = x ?? 0, lz = z ?? 0; x = lx * Math.cos(yaw) + lz * Math.sin(yaw); z = -lx * Math.sin(yaw) + lz * Math.cos(yaw); } else { const lx = x ?? 0, ly = y ?? 0; x = lx * Math.cos(yaw) - ly * Math.sin(yaw); y = lx * Math.sin(yaw) + ly * Math.cos(yaw); } }
      const ap = (k, val) => { if (val === null) return; o[k] = n.p.mode === 'add' ? o[k] + val : n.p.mode === 'multiply' ? o[k] * val : val; }; ap('vx', x); ap('vy', y); ap('vz', z); g.send(n, 'out', g.getProp(o, 'speed')); }); } });

  B({ id: 'spin', cat: 'properties', label: 'Spin', desc: 'Sets the continuous rotation speed in degrees per second (set 0 to stop).',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set to'], ['add', 'Add']]), P.num('speed', 'Speed (°/s)', 180), P.sel('axis', '3D axis', ['y', 'x', 'z']), SRC([['signal', 'The incoming number']])],
    onInput(n, port, v, g) { each(n, g, (o) => { const s = n.p.source === 'signal' ? U.num(v) : U.num(n.p.speed); o.spinAxis = n.p.axis; o.spin = n.p.mode === 'add' ? o.spin + s : s; g.send(n, 'out', o.spin); }); } });

  B({ id: 'material', cat: 'properties', label: 'Material', desc: 'Surface look. 3D: colour, metalness, roughness, glow (emissive), opacity, wireframe and a texture from your Sprite assets. 2D: colour and sprite swap. Leave a field empty to keep it.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.text('color', 'Color (#hex)', ''), P.text('metalness', 'Metalness 0–1', ''), P.text('roughness', 'Roughness 0–1', ''), P.text('emissive', 'Glow color (#hex)', ''), P.text('opacity', 'Opacity 0–1', ''), P.sel('wireframe', 'Wireframe', [['keep', 'Keep'], ['on', 'On'], ['off', 'Off']]), P.sprite('texture', 'Texture / sprite'), P.num('repeatX', 'Texture repeat X', 1), P.num('repeatY', 'Texture repeat Y', 1), SRC([['signalColor', 'Signal is a colour']])],
    onInput(n, port, v, g) { each(n, g, (o) => { o.material = o.material || {}; const m = o.material; let col = n.p.color; if (n.p.source === 'signalColor' && typeof v === 'string') col = v; if (col) { o.color = col; m.color = col; } const mt = pv(n.p.metalness), rg = pv(n.p.roughness), op = pv(n.p.opacity); if (mt !== null) m.metalness = U.clamp(mt, 0, 1); if (rg !== null) m.roughness = U.clamp(rg, 0, 1); if (op !== null) m.opacity = U.clamp(op, 0, 1); if (n.p.emissive) m.emissive = n.p.emissive; if (n.p.wireframe !== 'keep') m.wireframe = n.p.wireframe === 'on';
      if (n.p.texture) { if (is3(g)) { m.texture = n.p.texture; m.repeatX = U.num(n.p.repeatX, 1); m.repeatY = U.num(n.p.repeatY, 1); o.dirty3d = true; } else { o.props.sprite = n.p.texture; if (o.type !== 'sprite') o.type = 'sprite'; } } g.send(n, 'out', o.color); }); } });

  B({ id: 'flip', cat: 'properties', label: 'Flip', desc: 'Mirrors an object horizontally and/or vertically – turn a character to face the way it walks.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('x', 'Flip horizontally', [['keep', 'Keep'], ['on', 'On'], ['off', 'Off'], ['toggle', 'Toggle'], ['signal', 'On when signal < 0']]), P.sel('y', 'Flip vertically', [['keep', 'Keep'], ['on', 'On'], ['off', 'Off'], ['toggle', 'Toggle'], ['signal', 'On when signal < 0']])],
    onInput(n, port, v, g) { const f = (m, cur) => (m === 'on' ? true : m === 'off' ? false : m === 'toggle' ? !cur : m === 'signal' ? U.num(v) < 0 : cur); each(n, g, (o) => { o.flipX = f(n.p.x, o.flipX); o.flipY = f(n.p.y, o.flipY); g.send(n, 'out', o.flipX); }); } });

  B({ id: 'extractor', cat: 'properties', label: 'Extractor', desc: 'Reads a value from an object when it receives a signal. Pick a property or type an object variable as var:name. "position" sends an {x,y,z} object. Outputs x, y, z separately too.',
    inputs: ['in'], outputs: ['out', 'x', 'y', 'z'], params: [P.target(), P.text('property', 'Property', 'x', { hint: 'x y z rotation alpha width height depth vx vy vz speed angle screenX screenY name tags age position, or var:name, or global:name' })],
    onInput(n, port, v, g) { const o = g.targets(n.p.target, n.owner, n.owner.lastOther)[0]; if (!o) return; const pr = String(n.p.property).trim(); if (pr === 'position') { g.send(n, 'x', o.x); g.send(n, 'y', o.y); g.send(n, 'z', o.z); return g.send(n, 'out', pos(o)); } const r = pr.startsWith('var:') ? o.vars[pr.slice(4)] : pr.startsWith('global:') ? g.vars[pr.slice(7)] : g.getProp(o, pr); g.send(n, 'out', r); } });

  B({ id: 'displayOrder', cat: 'properties', label: 'Display Order', desc: 'Controls which objects are drawn in front (higher order = in front). Bring to front, send to back, or set a number.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('action', 'Action', [['set', 'Set order to'], ['front', 'Bring to front'], ['back', 'Send to back'], ['up', 'Up one'], ['down', 'Down one']]), P.num('value', 'Order', 0)],
    onInput(n, port, v, g) { const all = g.objects.map((o) => o.order); each(n, g, (o) => { const a = n.p.action; o.order = a === 'set' ? U.num(n.p.value) : a === 'front' ? Math.max(...all) + 1 : a === 'back' ? Math.min(...all) - 1 : a === 'up' ? o.order + 1 : o.order - 1; if (o.obj3d) o.obj3d.renderOrder = o.order; g.send(n, 'out', o.order); }); } });

  B({ id: 'blending', cat: 'properties', label: 'Blending', desc: 'How an object combines with what is behind it: Normal, Add (glow/light), Multiply (shadow), Screen (soft light).',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Blend mode', ['normal', 'add', 'multiply', 'screen'])],
    onInput(n, port, v, g) { each(n, g, (o) => { o.blend = n.p.mode; if (o.obj3d) o.obj3d.traverse((m) => { if (m.isMesh && m.material) { m.material.blending = { normal: 1, add: 2, multiply: 4, screen: 1 }[n.p.mode] || 1; m.material.transparent = n.p.mode !== 'normal' || m.material.transparent; m.material.needsUpdate = true; } }); g.send(n, 'out', n.p.mode); }); } });

  const toRGB = (h) => { const c = String(h || '#000000').replace('#', ''); const f = c.length === 3 ? c.split('').map((x) => x + x).join('') : c; return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0]; };
  const fromRGB = (r) => '#' + r.map((x) => Math.round(U.clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
  B({ id: 'light', cat: 'properties', label: 'Light', desc: '3D only. Changes a light object (Sun, lamp, spot…): its brightness and/or colour, live. Brightness is the same number as in the light\'s Properties panel (the Sun is 1.2 by default). Use it for day / night switches, flickering lamps or a torch that dies.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set to'], ['add', 'Add']]), P.text('intensity', 'Brightness', '1'), P.text('color', 'Colour (blank = keep)', ''), SRC([['signal', 'Brightness = the incoming number']])],
    onInput(n, port, v, g) { each(n, g, (o) => { if (o.type !== 'light') return; const cur = U.num((o.props || {}).intensity, 1); const raw = n.p.source === 'signal' ? U.num(v) : parseFloat(n.p.intensity); const val = Number.isNaN(raw) ? cur : (n.p.mode === 'add' ? cur + raw : raw); o.props = o.props || {}; o.props.intensity = Math.max(0, val); if (n.p.color) o.color = n.p.color;
      const L = o.obj3d; if (L && L.isLight) { const k = L.isDirectionalLight ? 2 : L.isSpotLight ? 60 : L.isPointLight ? 120 : 1; L.intensity = o.props.intensity * k; if (n.p.color && L.color) L.color.set(n.p.color); } g.send(n, 'out', o.props.intensity); }); } });

  B({ id: 'colors', cat: 'properties', label: 'Colors', desc: 'Changes an object\'s colour: set it, blend toward another colour, set the hue from a number (0–360) or pick a random hue. For text objects this is the text colour; for 3D objects the surface colour.',
    inputs: ['in'], outputs: ['out'], params: [P.target(), P.sel('mode', 'Mode', [['set', 'Set colour'], ['lerp', 'Blend toward colour'], ['hue', 'Hue from number'], ['random', 'Random colour']]), P.color('color', 'Colour', '#ff5577'), P.num('amount', 'Blend amount 0–1', 0.5, { min: 0, max: 1, step: 0.05 }), SRC([['signalColor', 'Signal is a colour / hue number']])],
    onInput(n, port, v, g) { each(n, g, (o) => { const m = n.p.mode; let c; if (m === 'random') c = U.hsl(Math.random() * 360); else if (m === 'hue' || (n.p.source === 'signalColor' && typeof v === 'number')) c = U.hsl(U.num(v)); else { c = n.p.source === 'signalColor' && typeof v === 'string' ? v : n.p.color; if (m === 'lerp') { const a = toRGB(o.color), b = toRGB(c), k = U.num(n.p.amount, 0.5); c = fromRGB(a.map((x, i) => x + (b[i] - x) * k)); } }
      if (/^hsl/.test(c)) { const t = document.createElement('canvas').getContext('2d'); t.fillStyle = c; c = t.fillStyle; } o.color = c; if (o.material) o.material.color = c; g.send(n, 'out', c); }); } });

  /* Shader: post-process effects (see rt-fx.js). The Type list is generated from VXRT.FX so docs and editor always match. */
  const CLASSIC = [['sepia', 'Sepia (classic)', '2D warm brown tone – This object only'], ['tint', 'Tint (classic)', '2D multiply colour – This object only'], ['brightness', 'Brightness (classic)', '2D brighten / darken – This object only'], ['pixelate', 'Pixelate (classic)', '2D coarse blocks – This object only'], ['glow', 'Glow (classic)', '2D soft halo – This object only'], ['outline', 'Outline (classic)', '2D coloured outline – This object only'], ['shadow', 'Shadow (classic)', '2D drop shadow – This object only'],
    ['toon', 'Toon (3D material)', 'cel shading for 3D objects – This object only'], ['wireframe', 'Wireframe (3D material)', 'draws 3D objects as wire – This object only'], ['unlit', 'Unlit (3D material)', 'ignores lights – This object only'], ['glass', 'Glass (3D material)', 'see-through glass – This object only'], ['hologram', 'Hologram (3D material)', 'scanline hologram – This object only'], ['fresnel', 'Fresnel (3D material)', 'rim light – This object only'], ['gradient', 'Gradient (3D material)', 'vertical colour gradient – This object only'], ['custom3d', 'Custom 3D code (classic)', 'your own GLSL fragment code – This object only']];
  const LEGACY = new Set(CLASSIC.map((c) => c[0]));
  const effectOptions = () => [['none', 'None', 'removes the effect'], ...VXRT.FX.map((f) => [f.id, f.label, f.desc.replace(/<\/?i>/g, '')]), ['custom', 'Custom shader file', 'pick one of your shader files (Assets → Shaders) from the list that appears below. Works on the screen, a layer, 2D sprites and 3D objects'], ['custommat', 'Custom material file (3D)', 'pick one of your material files (Assets → Materials) from the list that appears below – This object only'], ...CLASSIC];
  B({ id: 'shader', cat: 'properties', label: 'Shader', desc: 'Visual effects for the whole game, a layer, or one object. Pick a Type and a Mode. Inputs: "in" applies it, "on" / "off" switch it, and the numeric inputs amount, size, a, b, x, y, xpos, ypos change its settings live (ramp "amount" from 0 to 100 for Dissolve, Scatter or Color Shift). Add your own effects as shader files in Assets → Shaders and choose them with Type = Custom shader file.',
    inputs: ['in', 'on', 'off', 'amount', 'size', 'a', 'b', 'x', 'y', 'xpos', 'ypos'], outputs: ['out'],
    params: [P.sel('effect', 'Type', effectOptions(), 'grayscale'), P.sel('mode', 'Mode', VXRT.FX_MODES, 'all'), P.target('target', 'Object (This object only)'), P.shader('file', 'Custom shader', { showIf: { key: 'effect', is: 'custom' }, hint: 'Your shader files – create or import them in Assets → Shaders' }), P.material('matfile', 'Custom material', { showIf: { key: 'effect', is: 'custommat' }, hint: 'Your material files – create or import them in Assets → Materials' }),
      P.num('amount', 'Amount 0–100', 100, { min: 0, max: 100, step: 1 }), P.num('size', 'Size / radius / speed', 8, { step: 0.5 }), P.num('a', 'Extra A (threshold, vertical blur, angle, width…)', 0, { step: 0.05 }), P.num('b', 'Extra B (contrast, duration…)', 0, { step: 0.05 }), P.color('color', 'Colour', '#6c8cff'), P.color('color2', 'Second colour (3D styles)', '#34e1c5'),
      P.num('x', 'X / xpos (0–1 across the screen)', 0.5, { step: 0.05 }), P.num('y', 'Y / ypos (0–1 down the screen)', 0.5, { step: 0.05 }), P.bool('auto', 'Apply when the game starts', true), P.code('code', 'Custom 3D fragment code (classic 3D style)', 'void main(){\n  float p = 0.5 + 0.5 * sin(vUv.x * 20.0 + uTime * 3.0);\n  gl_FragColor = vec4(uColor * p, 1.0);\n}', { showIf: { key: 'effect', is: 'custom3d' } })],
    init(n, g) { n.st.on = !!n.p.auto; n.st.p = { amount: n.p.amount, size: n.p.size, a: n.p.a, b: n.p.b, color: n.p.color, x: n.p.x, y: n.p.y }; if (n.st.on) apply(n, g); n.cleanups.push(() => { if (n.p.effect === 'realism' && VXRT.realism) VXRT.realism.enable(g, false); if (VXRT.fx && g.fxState) { const st = g.fxState; for (const k of VXRT.fx.layers) st[k] = st[k].filter((e) => e.id !== n.id); VXRT.fx.sync(g); } }); },
    onInput(n, port, v, g) {
      const s = n.st; s.p = s.p || {}; const num = ['amount', 'size', 'a', 'b', 'x', 'y'];
      if (port === 'off') { s.on = false; apply(n, g); } else if (port === 'on') { s.on = true; s.fresh = true; apply(n, g); } else if (num.includes(port) || port === 'xpos' || port === 'ypos') { s.p[port === 'xpos' ? 'x' : port === 'ypos' ? 'y' : port] = U.num(v); if (s.on) apply(n, g, true); } else { s.on = true; s.fresh = true; apply(n, g); }
      g.send(n, 'out', n.p.effect);
    } });
  /** create / update the effect entry that rt-fx renders */
  function apply(n, g, live) {
    const s = n.st, eff = n.p.effect; let mode = n.p.mode; const p = Object.assign({}, s.p || {}, { color: n.p.color });
    if (eff === 'sphere' || LEGACY.has(eff) || eff === 'custommat') mode = 'object';
    if (eff === 'custommat') { for (const o of g.targets(n.p.target, n.owner, n.owner.lastOther)) { if (!o.alive || g.dim !== '3d') continue; o.matAsset = s.on === false ? undefined : (n.p.matfile || undefined); o.dirty3d = true; } return; }
    const is3d = g.dim === '3d';
    if (mode === 'object') {
      for (const o of g.targets(n.p.target, n.owner, n.owner.lastOther)) { if (!o.alive) continue;
        if (LEGACY.has(eff)) { const nm = eff === 'custom3d' ? 'custom' : eff; o.shader = s.on === false || eff === 'none' ? null : { name: nm, color: n.p.color, color2: n.p.color2, amount: U.clamp(U.num(p.amount, 100) / 100, 0, 1), value: U.num(p.size, 6), code: n.p.code }; o.shaderDirty = true; continue; }
        if (is3d && eff === 'custom') { o.shader = s.on === false ? null : { name: 'custom', file: n.p.file, color: n.p.color, color2: n.p.color2, amount: U.clamp(U.num(p.amount, 100) / 100, 0, 1), size: U.num(p.size, 8), a: U.num(p.a, 0), b: U.num(p.b, 0) }; o.shaderDirty = true; continue; }
        if (live && o.fx && o.fx[0] && o.fx[0].owner === n.id) { Object.assign(o.fx[0].p, p); continue; }
        VXRT.fx.set(g, { id: n.id, owner: n.id, mode: 'object', object: o, effect: s.on === false ? 'none' : eff, file: n.p.file, p: Object.assign({}, p), on: true }); }
      return;
    }
    if (eff === 'realism' && VXRT.realism) VXRT.realism.enable(g, s.on !== false, { exposure: 1 });
    if (live && s.entry) { Object.assign(s.entry.p, p); return; }
    s.entry = { id: n.id, mode, effect: s.on === false ? 'none' : eff, file: n.p.file, p, on: true }; VXRT.fx.set(g, s.entry); if (s.entry.effect === 'none') s.entry = null;
  }
})();
