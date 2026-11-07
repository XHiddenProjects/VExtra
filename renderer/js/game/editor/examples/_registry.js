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
    add(p, dim, type, name, x, y, extra) { const o = Object.assign(GP().newObject(type, dim, x, y, (extra && extra.z) || 0, []), { name }, extra || {}); if (typeof o.script === 'string') { VX.exKit.toBehavior(p, o); } p.scenes[0].objects.push(o); return o; },
    /** turns an inline script into a project behaviour ("Player script") that shows up in the Logic tab and can be edited, reused or attached elsewhere */
    toBehavior(p, o) { const code = o.script; delete o.script; if (!code || !code.trim()) return; const base = 'b_' + String(o.name).toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, ''); let id = base, n = 2; while (p.behaviors[id]) id = base + '_' + n++; p.behaviors[id] = { id, name: o.name + ' script', mode: 'code', code }; o.behaviors = (o.behaviors || []).concat(id); },
    /** sun + sky light for a 3D scene */
    sky(p, sun, sky) { const k = VX.exKit; k.add(p, '3d', 'light', 'Sun', 8, 14, 6, { props: { kind: 'directional', intensity: sun === undefined ? 1.2 : sun, shadows: true, angle: 40, range: 0 } }); k.add(p, '3d', 'light', 'Sky light', 0, 6, 0, { props: { kind: 'hemisphere', intensity: sky === undefined ? 0.6 : sky, shadows: false, angle: 40, range: 0 } }); },
    /** a material asset: returns its id, use it as { matAsset: id } */
    mat(p, name, props) { const id = 'mat_' + name.replace(/\W+/g, '_').toLowerCase(); p.assets.materials = p.assets.materials || {}; p.assets.materials[id] = Object.assign({ id, name, color: '#cccccc', metalness: 0.1, roughness: 0.7, emissive: '#000000', emissiveIntensity: 1, opacity: 1, pattern: 'none', color2: '#444444', repeatX: 1, repeatY: 1, wireframe: false, flat: false, doubleSided: false }, props); return id; },
    /** an invisible object that carries the game's rules as a script */
    rules(p, dim, script) { return VX.exKit.add(p, dim, 'empty', 'Game rules', 0, 0, { script }); },
  };
})();
