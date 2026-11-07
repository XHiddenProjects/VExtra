/* Five 3D example games for Library → Games: first-person mic hunt, third-person parkour, hyper-real garage, arena defence, bowling lanes. */
(function () {
  const K = VX.exKit, PH = K.PH, BEH = K.beh, S = (fn) => '(' + fn.toString() + ')();';
  const add = (p, ...a) => K.add(p, '3d', ...a);
  const stat = (e) => PH('static', Object.assign({ friction: 0.4 }, e));

  /* ---------------------------------------------------------------- 1 · Echo Maze (first person, the stalker hears you) */
  VX.gameExamples.push({ id: 'ex3d-echomaze', name: 'Echo Maze (3D)', type: 'game3d', desc: 'First-person maze: collect the gems, but the Stalker hunts by sound – footsteps, and your real voice if you allow the microphone (hold M to shout when you have no mic).', build() {
    const p = K.proj('Echo Maze', '3d', '#0b1020'); K.sky(p, 0.5, 0.9); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -25, z: 0 }; sc.camera3d = { mode: 'fps', fov: 75, pos: { x: 0, y: 1.7, z: 0 }, target: { x: 0, y: 1.7, z: -5 } };
    K.synth(p, 'gem', 'square', 700, 1400, 0.2, 0.3); K.synth(p, 'growl', 'saw', 120, 50, 0.5, 0.4); K.synth(p, 'win', 'square', 392, 1568, 0.9, 0.3);
    const wallMat = K.mat(p, 'Maze wall', { color: '#3a4a6b', roughness: 0.9, metalness: 0, pattern: 'bricks', color2: '#26324d' }), floorMat = K.mat(p, 'Maze floor', { color: '#1a2236', roughness: 1, metalness: 0 });
    const MAP = ['###########', '#S..#.....#', '#.#.#.###.#', '#.#...#...#', '#.#####.#.#', '#...#...#.#', '###.#.###.#', '#...#...#.#', '#.#####.#.#', '#........G#', '###########'], C = 4;
    const at = (c, r) => [(c - 5) * C, (r - 5) * C]; const gems = []; let start = [0, 0];
    MAP.forEach((row, r) => [...row].forEach((ch, c) => { const [x, z] = at(c, r); if (ch === '#') add(p, 'cube', 'Wall', x, 2, { z, w: C, h: 4, d: C, color: '#3a4a6b', matAsset: wallMat, physics: stat({ friction: 0 }), tags: ['wall'] }); else if (ch === 'S') start = [x, z]; else if (ch === 'G') gems.push([x, z]); else if (ch === '.' && (r + c) % 4 === 1) gems.push([x, z]); }));
    add(p, 'cube', 'Floor', 0, -0.5, { z: 0, w: 60, h: 1, d: 60, color: '#1a2236', matAsset: floorMat, physics: stat({ friction: 0 }) }); add(p, 'cube', 'Ceiling', 0, 4.5, { z: 0, w: 60, h: 1, d: 60, color: '#0e1424', physics: stat() });
    gems.forEach(([x, z], i) => add(p, 'sphere', 'Gem ' + i, x, 1.2, { z, w: 0.6, h: 0.6, d: 0.6, color: '#5be4ff', tags: ['gem'], material: { emissive: '#1b8ea8', metalness: 0.4, roughness: 0.2 } }));
    add(p, 'sphere', 'Stalker', at(9, 9)[0], 1.2, { z: at(9, 9)[1], w: 1.6, h: 1.6, d: 1.6, color: '#ff3b57', material: { emissive: '#a0102a', roughness: 0.3, metalness: 0.2 }, tags: ['enemy'], behaviors: [BEH(p, 'Echo Maze – stalker', S(function () {
      const me = self; let player = null, tx = null, tz = null, wander = 0, lastGrowl = 0; vars.alert = 'calm';
      on('update', (dt) => {
        player = player || game.find('Player'); if (vars.state !== 'play' || !player) { me.vx = me.vz = 0; return; }
        let best = null, bd = 1e9; for (const n of VXRT.sense.noises(game)) { const d = Math.hypot(n.x - me.x, n.z - me.z); if (d < n.radius && d < bd) { bd = d; best = n; } }
        if (best) { tx = best.x; tz = best.z; vars.alert = 'hunting'; if (game.time - lastGrowl > 4) { lastGrowl = game.time; try { game.audio.play('snd_growl'); } catch (e) { /* sound off */ } } } else if (tx === null) vars.alert = 'calm';
        if (tx !== null) { const dx = tx - me.x, dz = tz - me.z, d = Math.hypot(dx, dz); if (d < 1.2) { tx = null; wander = 1.5; } else { const sp = vars.alert === 'hunting' ? 4.2 : 2.6; me.vx = dx / d * sp; me.vz = dz / d * sp; } } else { wander -= dt; me.vx *= 0.9; me.vz *= 0.9; }
        if (Math.hypot(player.x - me.x, player.z - me.z) < 1.7) { vars.state = 'dead'; vars.msg = 'The Stalker heard you.  Click to try again'; }
      });
    }))] });
    add(p, 'cube', 'Player', start[0], 1.2, { z: start[1], w: 0.8, h: 1.6, d: 0.8, color: '#ffffff', visible: false, tags: ['player'], physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true, mass: 1 }), behaviors: [BEH(p, 'Echo Maze – player & voice', S(function () {
      const me = self; game.cam3d.yaw = 180; vars.gems = 0; vars.state = 'play'; vars.msg = ''; vars.alert = 'calm'; vars.mic = 'asking for the microphone …'; const total = game.findByTag('gem').length; vars.total = total;
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Gems {gems} / {total}', 'topLeft', 24, '#9fe8ff', 14); hud('alert', 'Stalker: {alert}', 'topRight', 20, '#ff9aa8', 14); hud('msg', '{msg}', 'center', 30, '#ffffff', 0); hud('help', 'WASD move · Shift sneak · mouse look (click to capture) · M shout · mic = your voice', 'bottom', 14, '#7c8db5', 10);
      block('once', { when: 'start' }).to(block('camera', { action: 'mode3d', mode: 'fps', target: 'Player', eye: 0.55, distance: 0 })); block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.12 }));
      let micOk = false; try { VXRT.sense.micAcquire(game).then(() => { micOk = true; vars.mic = 'microphone on – your voice is heard'; }, (e) => { vars.mic = 'no microphone (' + (e && e.message ? e.message.slice(0, 40) : 'off') + ') – hold M'; }); } catch (e) { vars.mic = 'no microphone – hold M'; }
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      on('click', () => { if (vars.state !== 'play') game.restart(true); }); let step = 0;
      on('update', (dt) => {
        if (vars.state !== 'play') { me.vx = me.vz = 0; return; }
        const yw = game.cam3d.yaw * Math.PI / 180, f = (input.isDown('w') || input.isDown('up') ? 1 : 0) - (input.isDown('s') || input.isDown('down') ? 1 : 0), s = (input.isDown('d') || input.isDown('right') ? 1 : 0) - (input.isDown('a') || input.isDown('left') ? 1 : 0), sneak = input.isDown('shift'), sp = sneak ? 2.2 : 5, l = Math.hypot(f, s) || 1;
        me.vx = (-Math.sin(yw) * f + Math.cos(yw) * s) / l * sp; me.vz = (-Math.cos(yw) * f - Math.sin(yw) * s) / l * sp;
        step -= dt; if ((f || s) && !sneak && step <= 0) { step = 0.45; VXRT.sense.makeNoise(game, me.x, me.y, me.z, 9, 'steps'); } else if ((f || s) && sneak && step <= 0) { step = 0.6; VXRT.sense.makeNoise(game, me.x, me.y, me.z, 2.5, 'steps'); }
        const m = micOk ? VXRT.sense.micRead(game, 1.2) : null; if (m && m.level > 0.12) VXRT.sense.makeNoise(game, me.x, me.y, me.z, 6 + m.level * 40, 'voice'); if (input.isDown('m') && step <= 0.3) { VXRT.sense.makeNoise(game, me.x, me.y, me.z, 30, 'voice'); step = 0.3; }
        for (const g of game.findByTag('gem')) { g.rot += 90 * dt; if (Math.hypot(g.x - me.x, g.z - me.z) < 1.1) { game.removeObject(g); vars.gems++; play('gem'); VXRT.emitParticles(game, { x: g.x, y: g.y, z: g.z, count: 14, color: '#5be4ff', speed: 4, spread: 360, angle: 0, life: 0.5, size: 0.15, gravity: 0, shrink: true }); if (vars.gems >= vars.total) { vars.state = 'won'; vars.msg = 'All gems collected – you escaped!  Click to play again'; play('win'); } } }
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 2 · Sky Parkour (third person, kinematic moving platforms, crumbling tiles, checkpoints) */
  VX.gameExamples.push({ id: 'ex3d-parkour', name: 'Sky Parkour (3D)', type: 'game3d', desc: 'Third-person parkour above the clouds: moving platforms (kinematic), crumbling tiles that fall with kinematic gravity, checkpoints and coins. WASD, Space to jump, mouse to turn the camera.', build() {
    const p = K.proj('Sky Parkour', '3d', '#9ad7ff'); K.sky(p, 1.2, 0.8); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -28, z: 0 }; sc.camera3d = { mode: 'follow', fov: 65, pos: { x: 0, y: 4, z: 9 }, target: { x: 0, y: 1, z: 0 } };
    K.synth(p, 'coin', 'square', 880, 1760, 0.15, 0.25); K.synth(p, 'jump', 'triangle', 260, 520, 0.14, 0.3); K.synth(p, 'check', 'triangle', 392, 784, 0.4, 0.3); K.synth(p, 'fall', 'saw', 500, 60, 0.6, 0.3); K.synth(p, 'win', 'square', 523, 1568, 0.9, 0.3); K.synth(p, 'crumble', 'noise', 300, 60, 0.4, 0.3);
    const grass = K.mat(p, 'Grass', { color: '#5fb86a', roughness: 0.9 }), stone = K.mat(p, 'Stone', { color: '#aab4c4', roughness: 0.8, pattern: 'checker', color2: '#8e99ab' });
    const plat = (n, x, y, z, w, d, extra) => add(p, 'cube', n, x, y, Object.assign({ z, w, h: 1, d, color: '#aab4c4', matAsset: stone, physics: stat({ friction: 0 }) }, extra));
    plat('Start', 0, 0, 0, 7, 7, { matAsset: grass, tags: ['checkpoint'] }); plat('Step 1', 0, 1.2, -9, 4, 4); plat('Step 2', 5, 2.4, -15, 4, 4); plat('Step 3', 10, 3.6, -21, 4, 4, { tags: ['checkpoint'] });
    [['Mover A', 14, 4.6, -28, 'x', 5], ['Mover B', 22, 5.2, -28, 'z', 5], ['Mover C', 28, 6.4, -35, 'x', 4]].forEach(([n, x, y, z, axis, r]) => plat(n, x, y, z, 4, 4, { color: '#ffb84d', matAsset: undefined, physics: PH('kinematic', { friction: 0 }), tags: ['mover'], vars: { axis, r, ox: x, oz: z, ph: Math.random() * 6 } }));
    plat('Rest', 34, 7, -40, 5, 5, { tags: ['checkpoint'], matAsset: grass });
    for (let i = 0; i < 5; i++) plat('Tile ' + i, 34 - (i + 1) * 3.4 + 0.0, 7.4 + i * 0.5, -46 - i * 3.2, 3, 3, { color: '#ff6b6b', matAsset: undefined, physics: PH('kinematic', { friction: 0, gravityScale: 1, kgravity: false }), tags: ['crumble'], vars: { t: -1 } });
    plat('Top', 14, 11.4, -66, 8, 8, { matAsset: grass, tags: ['checkpoint'] }); add(p, 'cone', 'Goal', 14, 14, { z: -66, w: 1.6, h: 3, d: 1.6, color: '#ffd23f', material: { emissive: '#aa8800', metalness: 0.6, roughness: 0.2 }, tags: ['goal'] });
    [[0, 1.4, -9], [5, 2.6, -15], [10, 3.8, -21], [14, 5.4, -28], [22, 6, -28], [28, 7.2, -35], [34, 8, -40], [31, 8.8, -49], [24, 10, -56], [14, 12, -66]].forEach(([x, y, z], i) => add(p, 'cylinder', 'Coin ' + i, x, y + 0.4, { z, w: 0.7, h: 0.1, d: 0.7, color: '#ffd23f', rx: 90, tags: ['coin'], material: { emissive: '#aa8800', metalness: 0.8, roughness: 0.2 } }));
    for (let i = 0; i < 18; i++) add(p, 'sphere', 'Cloud ' + i, -30 + (i * 17) % 90, -6 + (i % 4) * -2, { z: -(i * 13) % 100 + 10, w: 8 + (i % 3) * 3, h: 3, d: 6, color: '#ffffff', alpha: 0.9, tags: ['decor'] });
    add(p, 'cube', 'Player', 0, 1.2, { z: 0, w: 0.9, h: 1.6, d: 0.9, color: '#6c8cff', tags: ['player'], material: { metalness: 0.2, roughness: 0.4 }, physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true, mass: 1 }), behaviors: [BEH(p, 'Sky Parkour – player', S(function () {
      const me = self; let spawn = { x: 0, y: 1.2, z: 0 }, t0 = 0; vars.coins = 0; vars.state = 'play'; vars.msg = ''; vars.time = 0; vars.cp = 'Start';
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Coins {coins} / 10      Time {time}s', 'topLeft', 24, '#12304f', 14); hud('cp', 'Checkpoint: {cp}', 'topRight', 18, '#12304f', 16); hud('msg', '{msg}', 'center', 30, '#12304f', 0); hud('help', 'WASD move · Space jump · mouse turns the camera (click to capture)', 'bottom', 14, '#12304f', 10);
      block('once', { when: 'start' }).to(block('camera', { action: 'mode3d', mode: 'follow', target: 'Player', distance: 9, height: 3, lerp: 0.12 })); block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.15 }));
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      on('click', () => { if (vars.state !== 'play') game.restart(true); });
      on('key:space', () => { if (vars.state === 'play' && (me.grounded || Math.abs(me.vy) < 0.3)) { me.vy = 11; play('jump'); } });
      let carry = { x: 0, z: 0 }, hadCp = new Set(); const done = new Set();
      on('update', (dt) => {
        if (vars.state !== 'play') { me.vx = me.vz = 0; return; }
        t0 += dt; vars.time = Math.floor(t0);
        const T = game.time;
        for (const m of game.findByTag('mover')) { const v = m.vars, s = Math.sin(T * 0.7 + v.ph) * v.r, nx = v.ox + (v.axis === 'x' ? s : 0), nz = v.oz + (v.axis === 'z' ? s : 0); m.vx = (nx - m.x) / Math.max(dt, 1e-3); m.vz = (nz - m.z) / Math.max(dt, 1e-3); }
        carry.x = carry.z = 0; for (const m of game.findByTag('mover')) if (Math.abs(me.x - m.x) < 2.2 && Math.abs(me.z - m.z) < 2.2 && me.y - m.y > 0.9 && me.y - m.y < 2.2) { carry.x = m.vx; carry.z = m.vz; }
        for (const c of game.findByTag('crumble')) { const v = c.vars; if (v.t < 0 && Math.abs(me.x - c.x) < 1.8 && Math.abs(me.z - c.z) < 1.8 && me.y - c.y > 0.9 && me.y - c.y < 2.2) { v.t = 0.7; play('crumble'); } if (v.t > 0) { v.t -= dt; c.x += (Math.random() - 0.5) * 0.03; if (v.t <= 0) { v.t = -2; c.physics.kgravity = true; } } if (c.y < -20) { game.removeObject(c); } }
        const yw = game.cam3d.yaw * Math.PI / 180, f = (input.isDown('w') || input.isDown('up') ? 1 : 0) - (input.isDown('s') || input.isDown('down') ? 1 : 0), s = (input.isDown('d') || input.isDown('right') ? 1 : 0) - (input.isDown('a') || input.isDown('left') ? 1 : 0), l = Math.hypot(f, s) || 1;
        me.vx = (-Math.sin(yw) * f + Math.cos(yw) * s) / l * 7 + carry.x; me.vz = (-Math.cos(yw) * f - Math.sin(yw) * s) / l * 7 + carry.z; if (f || s) me.ry = Math.atan2(-me.vx, -me.vz) * 180 / Math.PI;
        for (const c of game.findByTag('checkpoint')) if (!done.has(c.id) && Math.abs(me.x - c.x) < c.w / 2 && Math.abs(me.z - c.z) < c.d / 2 && me.y - c.y > 0.8 && me.y - c.y < 2) { done.add(c.id); spawn = { x: c.x, y: c.y + 1.4, z: c.z }; vars.cp = c.name; play('check'); }
        for (const c of game.findByTag('coin')) { c.rz += 120 * dt; if (Math.hypot(c.x - me.x, c.y - me.y, c.z - me.z) < 1.2) { game.removeObject(c); vars.coins++; play('coin'); VXRT.emitParticles(game, { x: c.x, y: c.y, z: c.z, count: 10, color: '#ffd23f', speed: 3, spread: 360, angle: 0, life: 0.4, size: 0.12, gravity: 0, shrink: true }); } }
        const goal = game.find('Goal'); if (goal) { goal.ry += 60 * dt; if (Math.hypot(goal.x - me.x, goal.z - me.z) < 2 && Math.abs(goal.y - me.y) < 5) { vars.state = 'won'; vars.msg = 'You made it in ' + Math.floor(t0) + 's with ' + vars.coins + ' coins!  Click to play again'; play('win'); } }
        if (me.y < -15) { me.x = spawn.x; me.y = spawn.y; me.z = spawn.z; me.vy = 0; play('fall'); }
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 3 · Showroom (hyper-real PBR materials, Realism effect, turntables) */
  VX.gameExamples.push({ id: 'ex3d-showroom', name: 'Hyper-Real Showroom (3D)', type: 'game3d', desc: 'Walk around a night showroom lit with the Realism look: clear-coat car paint, brushed steel, glass and wet asphalt on turntables. Keys 1-3 change the light, P is photo mode.', build() {
    const p = K.proj('Hyper-Real Showroom', '3d', '#05060a'); K.sky(p, 0.35, 0.25); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -25, z: 0 }; sc.camera3d = { mode: 'fps', fov: 62, pos: { x: 0, y: 1.7, z: 12 }, target: { x: 0, y: 1, z: 0 } };
    const R = (n, o) => K.mat(p, n, Object.assign({ realism: true, envIntensity: 1.2, detail: 0.5 }, o));
    const paints = [R('Car paint red', { color: '#b3121b', metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, detail: 0.15, envIntensity: 1.6 }), R('Car paint blue', { color: '#0b2a7a', metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, detail: 0.15, envIntensity: 1.6 }), R('Car paint pearl', { color: '#e9e6df', metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, detail: 0.15, envIntensity: 1.5 })];
    const steel = R('Brushed steel', { color: '#b9bec6', metalness: 1, roughness: 0.38, clearcoat: 0.2 }), glass = R('Glass', { color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 0.95, ior: 1.5, thickness: 0.2, opacity: 1 }), rubber = R('Rubber', { color: '#1c1c1c', metalness: 0, roughness: 0.85 }), asphalt = R('Wet asphalt', { color: '#262626', metalness: 0, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, detail: 1, envIntensity: 1.3 }), leather = R('Leather', { color: '#5a3522', metalness: 0, roughness: 0.55, sheen: 0.35, detail: 1 });
    add(p, 'cube', 'Floor', 0, -0.5, { z: 0, w: 70, h: 1, d: 70, color: '#262626', matAsset: asphalt, physics: stat({ friction: 0 }) });
    for (const [x, z, w, d] of [[0, -22, 60, 1], [-30, 0, 1, 50], [30, 0, 1, 50], [0, 22, 60, 1]]) add(p, 'cube', 'Wall', x, 4, { z, w, h: 8, d, color: '#14161c', physics: stat({ friction: 0 }) });
    for (let i = -2; i <= 2; i++) add(p, 'cube', 'Light panel ' + i, i * 10, 7.8, { z: -8, w: 6, h: 0.2, d: 1, color: '#ffffff', material: { emissive: '#ffffff', emissiveIntensity: 2 } });
    const car = (n, x, z, paint, ry) => { const base = add(p, 'cube', n + ' turntable', x, 0.15, { z, w: 8, h: 0.3, d: 8, color: '#2a2d36', matAsset: steel, physics: stat({ friction: 0 }), tags: ['turn'], vars: { speed: 8 } });
      const part = (type, nm, dx, dy, dz, w, h, d, mat, extra) => add(p, type, n + ' ' + nm, x + dx, 0.3 + dy, Object.assign({ z: z + dz, w, h, d, color: '#ffffff', matAsset: mat, tags: ['carpart'], vars: { dx, dz, dy, cx: x, cz: z } }, extra));
      part('cube', 'body', 0, 0.75, 0, 4.4, 0.7, 1.9, paint); part('cube', 'cabin', -0.2, 1.35, 0, 2.3, 0.65, 1.7, glass); part('cube', 'roof', -0.2, 1.72, 0, 2.0, 0.08, 1.6, paint); part('cube', 'seat', -0.5, 1.0, 0, 0.8, 0.5, 1.1, leather);
      for (const [dx, dz] of [[1.4, 1], [1.4, -1], [-1.4, 1], [-1.4, -1]]) { part('cylinder', 'tyre', dx, 0.45, dz * 0.95, 0.9, 0.35, 0.9, rubber, { rx: 90 }); part('cylinder', 'rim', dx, 0.45, dz * 1.1, 0.55, 0.1, 0.55, steel, { rx: 90 }); }
      for (const dz of [0.6, -0.6]) part('sphere', 'lamp', 2.2, 0.9, dz, 0.35, 0.25, 0.3, steel, { material: { emissive: '#fff6d8', emissiveIntensity: 3 } }); };
    car('Red coupe', -12, -2, paints[0]); car('Blue coupe', 0, -6, paints[1]); car('Pearl coupe', 12, -2, paints[2]);
    add(p, 'cube', 'Player', 0, 1.2, { z: 14, w: 0.8, h: 1.6, d: 0.8, color: '#ffffff', visible: false, tags: ['player'], physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true }), behaviors: [BEH(p, 'Showroom – player & lights', S(function () {
      const me = self; game.cam3d.yaw = 0; let light = 'Night', photo = false; const HELP = 'WASD walk · mouse look (click to capture) · 1 Night · 2 Dusk · 3 Studio · P photo mode';
      const refresh = () => { vars.ui1 = photo ? '' : 'Light: ' + light; vars.ui2 = photo ? '' : HELP; }; refresh();
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y }); block('once', { when: 'start' }).to(l); return l; };
      hud('hud', '{ui1}', 'topLeft', 22, '#e6ecff', 14); hud('help', '{ui2}', 'bottom', 14, '#9aa7c7', 10);
      block('once', { when: 'start' }).to(block('camera', { action: 'mode3d', mode: 'fps', target: 'Player', eye: 0.55, distance: 0 })); block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.12 }));
      block('once', { when: 'start' }).to(block('shader', { effect: 'realism', amount: 100 }));
      const sun = game.find('Sun'), sky = game.find('Sky light'); const set = (name, s, k) => { light = name; sun.props.intensity = s; sky.props.intensity = k; refresh(); };
      on('key:1', () => set('Night', 0.35, 0.25)); on('key:2', () => set('Dusk', 0.8, 0.5)); on('key:3', () => set('Studio', 1.6, 1.0)); on('key:p', () => { photo = !photo; refresh(); });
      on('update', (dt) => {
        const yw = game.cam3d.yaw * Math.PI / 180, f = (input.isDown('w') || input.isDown('up') ? 1 : 0) - (input.isDown('s') || input.isDown('down') ? 1 : 0), s = (input.isDown('d') || input.isDown('right') ? 1 : 0) - (input.isDown('a') || input.isDown('left') ? 1 : 0), l = Math.hypot(f, s) || 1;
        me.vx = (-Math.sin(yw) * f + Math.cos(yw) * s) / l * 5; me.vz = (-Math.cos(yw) * f - Math.sin(yw) * s) / l * 5;
        for (const t of game.findByTag('turn')) t.ry += t.vars.speed * dt;
        for (const c of game.findByTag('carpart')) { const tt = game.find(c.name.split(' ')[0] + ' ' + c.name.split(' ')[1] + ' turntable'); if (!tt) continue; const a = tt.ry * Math.PI / 180, v = c.vars; c.x = v.cx + v.dx * Math.cos(a) + v.dz * Math.sin(a); c.z = v.cz - v.dx * Math.sin(a) + v.dz * Math.cos(a); c.ry = tt.ry; }
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 4 · Core Defender (first-person arena defence, hitscan turret) */
  VX.gameExamples.push({ id: 'ex3d-defender', name: 'Core Defender (3D)', type: 'game3d', desc: 'Stand beside the glowing core and shoot the crawlers before they reach it. Waves get bigger, mouse aims, click fires, R repairs the core with scrap.', build() {
    const p = K.proj('Core Defender', '3d', '#120a1e'); K.sky(p, 0.7, 0.6); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -25, z: 0 }; sc.camera3d = { mode: 'fps', fov: 72, pos: { x: 0, y: 1.7, z: 4 }, target: { x: 0, y: 1.7, z: 0 } };
    K.synth(p, 'shot', 'saw', 900, 200, 0.12, 0.25); K.synth(p, 'hit', 'noise', 600, 100, 0.2, 0.3); K.synth(p, 'core', 'square', 150, 60, 0.4, 0.4); K.synth(p, 'wave', 'triangle', 330, 660, 0.5, 0.3); K.synth(p, 'lose', 'saw', 300, 40, 1, 0.4);
    const floor = K.mat(p, 'Arena floor', { color: '#2b2440', roughness: 0.9, pattern: 'checker', color2: '#221c33' }), coreMat = K.mat(p, 'Core', { color: '#44e0ff', emissive: '#22a8d0', metalness: 0.4, roughness: 0.2 });
    add(p, 'cube', 'Floor', 0, -0.5, { z: 0, w: 60, h: 1, d: 60, color: '#2b2440', matAsset: floor, physics: stat({ friction: 0 }) });
    for (const [x, z, w, d] of [[0, -30, 60, 1], [0, 30, 60, 1], [-30, 0, 1, 60], [30, 0, 1, 60]]) add(p, 'cube', 'Wall', x, 2, { z, w, h: 4, d, color: '#3b2f5c', physics: stat({ friction: 0 }) });
    add(p, 'sphere', 'Core', 0, 1.6, { z: 0, w: 2.2, h: 2.2, d: 2.2, color: '#44e0ff', matAsset: coreMat, tags: ['core'] });
    add(p, 'sphere', 'Crawler', 0, 0.7, { z: 0, w: 1.1, h: 1.1, d: 1.1, color: '#ff5a7a', prefab: true, tags: ['enemy'], material: { emissive: '#661428', roughness: 0.5 } });
    add(p, 'cube', 'Player', 0, 1, { z: 5, w: 0.8, h: 1.6, d: 0.8, color: '#ffffff', visible: false, tags: ['player'], physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true }), behaviors: [BEH(p, 'Core Defender – player & waves', S(function () {
      const me = self; game.cam3d.yaw = 0; vars.core = 100; vars.wave = 0; vars.score = 0; vars.scrap = 0; vars.state = 'play'; vars.msg = '';
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Core {core}%   Wave {wave}   Score {score}   Scrap {scrap}', 'topLeft', 22, '#bff3ff', 14); hud('msg', '{msg}', 'center', 30, '#ffffff', -110); hud('cross', '+', 'center', 28, '#ffffff', 0); hud('help', 'WASD move · mouse aim (click to capture) · click shoot · R repair (3 scrap)', 'bottom', 14, '#b9a9e0', 10);
      block('once', { when: 'start' }).to(block('camera', { action: 'mode3d', mode: 'fps', target: 'Player', eye: 0.6, distance: 0 })); block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.12 }));
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      let cool = 0, toSpawn = 0, spawnT = 0, between = 1.5;
      const shoot = () => {
        const c = game.cam3d, yw = c.yaw * Math.PI / 180, pt = c.pitch * Math.PI / 180, d = { x: -Math.sin(yw) * Math.cos(pt), y: Math.sin(pt), z: -Math.cos(yw) * Math.cos(pt) }, o = { x: me.x, y: me.y + 0.6, z: me.z };
        let best = null, bt = 1e9; for (const e of game.findByTag('enemy')) { const vx = e.x - o.x, vy = e.y - o.y, vz = e.z - o.z, t = vx * d.x + vy * d.y + vz * d.z; if (t < 0 || t > 60) continue; const px = vx - d.x * t, py = vy - d.y * t, pz = vz - d.z * t; if (Math.hypot(px, py, pz) < 0.75 && t < bt) { bt = t; best = e; } }
        play('shot'); VXRT.emitParticles(game, { x: o.x + d.x * 1.2, y: o.y + d.y * 1.2 - 0.2, z: o.z + d.z * 1.2, count: 4, color: '#ffe38a', speed: 3, spread: 30, angle: 0, life: 0.15, size: 0.06, gravity: 0, shrink: true });
        if (best) { best.vars.hp--; play('hit'); if (best.vars.hp <= 0) { VXRT.emitParticles(game, { x: best.x, y: best.y, z: best.z, count: 16, color: '#ff5a7a', speed: 4, spread: 360, angle: 0, life: 0.5, size: 0.14, gravity: 0, shrink: true }); game.removeObject(best); vars.score += 10; vars.scrap++; } }
      };
      on('click', () => { if (vars.state !== 'play') game.restart(true); }); on('mousedown', () => { if (vars.state === 'play' && cool <= 0) { cool = 0.22; shoot(); } });
      on('key:r', () => { if (vars.state === 'play' && vars.scrap >= 3 && vars.core < 100) { vars.scrap -= 3; vars.core = Math.min(100, vars.core + 15); play('wave'); } });
      on('update', (dt) => {
        if (vars.state !== 'play') { me.vx = me.vz = 0; return; }
        cool -= dt; const yw = game.cam3d.yaw * Math.PI / 180, f = (input.isDown('w') || input.isDown('up') ? 1 : 0) - (input.isDown('s') || input.isDown('down') ? 1 : 0), s = (input.isDown('d') || input.isDown('right') ? 1 : 0) - (input.isDown('a') || input.isDown('left') ? 1 : 0), l = Math.hypot(f, s) || 1;
        me.vx = (-Math.sin(yw) * f + Math.cos(yw) * s) / l * 6; me.vz = (-Math.cos(yw) * f - Math.sin(yw) * s) / l * 6;
        if (input.mouse.down && cool <= 0) { cool = 0.22; shoot(); }
        const en = game.findByTag('enemy');
        if (toSpawn <= 0 && en.length === 0) { between -= dt; if (between <= 0) { vars.wave++; toSpawn = 4 + vars.wave * 3; between = 3; play('wave'); vars.msg = 'Wave ' + vars.wave; after(1.5, () => { if (vars.state === 'play') vars.msg = ''; }); } }
        spawnT -= dt; if (toSpawn > 0 && spawnT <= 0) { spawnT = Math.max(0.35, 1.1 - vars.wave * 0.07); toSpawn--; const a = Math.random() * Math.PI * 2, e = game.spawn('Crawler', { x: Math.cos(a) * 26, y: 0.7, z: Math.sin(a) * 26 }); e.vars.hp = 1 + Math.floor(vars.wave / 3); e.vars.spd = 2.2 + vars.wave * 0.25 + Math.random(); }
        for (const e of en) { const dx = -e.x, dz = -e.z, dd = Math.hypot(dx, dz) || 1; e.x += dx / dd * e.vars.spd * dt; e.z += dz / dd * e.vars.spd * dt; e.y = 0.7 + Math.abs(Math.sin(game.time * 6 + e.x)) * 0.25; if (dd < 2) { game.removeObject(e); vars.core -= 8; play('core'); game.cam3d.shake = 0.3; } }
        const core = game.find('Core'); if (core) { core.ry += 30 * dt; core.y = 1.6 + Math.sin(game.time * 2) * 0.12; }
        if (vars.core <= 0) { vars.core = 0; vars.state = 'lost'; vars.msg = 'The core fell on wave ' + vars.wave + ' – score ' + vars.score + '.  Click to retry'; play('lose'); }
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 5 · Marble Lanes (bowling with real physics) */
  VX.gameExamples.push({ id: 'ex3d-lanes', name: 'Marble Lanes (3D)', type: 'game3d', desc: 'Bowling with real physics: A/D aim, hold Space to charge the throw and release to roll. Six frames, two rolls each; strikes and spares score bonus points.', build() {
    const p = K.proj('Marble Lanes', '3d', '#1a1020'); K.sky(p, 0.9, 0.6); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -22, z: 0 }; sc.camera3d = { mode: 'follow', fov: 55, pos: { x: 0, y: 3, z: 12 }, target: { x: 0, y: 0.5, z: -8 } };
    K.synth(p, 'roll', 'noise', 200, 120, 0.5, 0.2); K.synth(p, 'crash', 'noise', 900, 80, 0.7, 0.45); K.synth(p, 'strike', 'square', 523, 1568, 0.7, 0.3); K.synth(p, 'tick', 'triangle', 600, 600, 0.05, 0.2);
    const wood = K.mat(p, 'Lane wood', { color: '#d9a766', roughness: 0.25, metalness: 0, pattern: 'checker', color2: '#cf9a58' }), ballMat = K.mat(p, 'Ball', { color: '#3b6dff', roughness: 0.15, metalness: 0.3 });
    add(p, 'cube', 'Lane', 0, -0.25, { z: -12, w: 4, h: 0.5, d: 40, color: '#d9a766', matAsset: wood, physics: stat({ friction: 0.05 }) });
    add(p, 'cube', 'Gutter L', -2.6, -0.45, { z: -12, w: 1.2, h: 0.5, d: 40, color: '#222', physics: stat({ friction: 0.3 }) }); add(p, 'cube', 'Gutter R', 2.6, -0.45, { z: -12, w: 1.2, h: 0.5, d: 40, color: '#222', physics: stat({ friction: 0.3 }) });
    add(p, 'cube', 'Backstop', 0, 1, { z: -33, w: 7, h: 3, d: 1, color: '#2a2036', physics: stat({}) }); add(p, 'cube', 'Pit floor', 0, -0.6, { z: -32, w: 7, h: 0.4, d: 3, color: '#111', physics: stat({}) });
    add(p, 'cylinder', 'Pin', 0, 0.55, { z: 0, w: 0.5, h: 1.1, d: 0.5, color: '#ffffff', prefab: true, tags: ['pin'], physics: PH('dynamic', { shape: 'box', friction: 0.2, mass: 0.6, bounce: 0.1 }) });
    add(p, 'sphere', 'Ball', 0, 0.45, { z: 8, w: 0.9, h: 0.9, d: 0.9, color: '#3b6dff', matAsset: ballMat, tags: ['ball'], physics: PH('dynamic', { shape: 'sphere', friction: 0.05, mass: 4, bounce: 0.1 }) });
    K.rules(p, '3d', S(function () {
      vars.frame = 1; vars.roll = 1; vars.score = 0; vars.aim = 0; vars.power = 0; vars.state = 'aim'; vars.msg = ''; vars.last = ''; vars.total = 6;
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Frame {frame}/{total}   Roll {roll}   Score {score}', 'topLeft', 24, '#ffe9c4', 14); hud('last', '{last}', 'topRight', 20, '#ffe9c4', 14); hud('msg', '{msg}', 'center', 30, '#ffffff', 0); hud('help', 'A / D aim · hold Space to charge · release to roll', 'bottom', 15, '#d9c3e8', 10); hud('pow', 'Power {power}%', 'bottomLeft', 18, '#ffe9c4', 40);
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      const rack = () => { for (const o of game.findByTag('pin')) game.removeObject(o); const rows = [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]]; rows.forEach((r, i) => r.forEach((dx) => { const q = game.spawn('Pin', { x: dx * 0.62, y: 0.55, z: -26 - i * 0.62 }); q.vars.hx = q.x; q.vars.hz = q.z; })); };
      const downed = () => game.findByTag('pin').filter((q) => Math.abs(q.x - q.vars.hx) > 0.35 || Math.abs(q.z - q.vars.hz) > 0.35 || q.y < 0.3).length;
      const ballHome = () => { const b = game.find('Ball'); b.x = vars.aim * 0.6; b.y = 0.45; b.z = 8; b.vx = b.vy = b.vz = 0; return b; };
      let pins = 10, standing0 = 10, charge = 0, charging = false, settle = 0;
      rack(); ballHome();
      const sum = []; let knocked1 = 0;
      const finishRoll = () => {
        const d = downed(); const n = Math.min(10, d) - (vars.roll === 2 ? knocked1 : 0); vars.score += Math.max(0, n);
        if (vars.roll === 1 && d >= 10) { vars.score += 10; vars.last = 'Strike!  +10 bonus'; play('strike'); vars.frame++; vars.roll = 1; knocked1 = 0; next(); }
        else if (vars.roll === 1) { knocked1 = d; vars.last = d + ' down'; vars.roll = 2; for (const q of game.findByTag('pin').slice()) if (Math.abs(q.x - q.vars.hx) > 0.35 || Math.abs(q.z - q.vars.hz) > 0.35 || q.y < 0.3) game.removeObject(q); ballHome(); vars.state = 'aim'; }
        else { if (d >= 10) { vars.score += 5; vars.last = 'Spare!  +5 bonus'; play('strike'); } else vars.last = d + ' down in total'; vars.frame++; vars.roll = 1; knocked1 = 0; next(); }
      };
      const next = () => { if (vars.frame > vars.total) { vars.state = 'over'; vars.msg = 'Game over – score ' + vars.score + '.  Click to play again'; return; } rack(); ballHome(); vars.state = 'aim'; };
      on('click', () => { if (vars.state === 'over') game.restart(true); });
      on('key:space', () => { if (vars.state === 'aim') { charging = true; charge = 0; } }); on('keyup', (e) => { if (e.key === 'space' && vars.state === 'aim' && charging) { charging = false; const b = game.find('Ball'), sp = 12 + charge * 20; b.vz = -sp; b.vx = vars.aim * 0.8; vars.state = 'roll'; settle = 0; play('roll'); vars.power = 0; } });
      on('update', (dt) => {
        const b = game.find('Ball'); if (!b) return;
        if (vars.state === 'aim') { const s = (input.isDown('d') || input.isDown('right') ? 1 : 0) - (input.isDown('a') || input.isDown('left') ? 1 : 0); vars.aim = Math.max(-1.4, Math.min(1.4, vars.aim + s * dt * 1.4)); b.x = vars.aim * 0.6; b.z = 8; b.vx = b.vz = 0; if (charging) { charge = Math.min(1, charge + dt * 0.9); vars.power = Math.round(charge * 100); } }
        if (vars.state === 'roll') { settle += dt; if (b.z < -27 && !vars._crash) { vars._crash = true; play('crash'); } if ((b.z < -31 || b.y < -3 || settle > 7) && settle > 2.5) { vars._crash = false; finishRoll(); } }
        const cam = game.cam3d; cam.pos.x = b.x * 0.5; cam.pos.y = 2.6; cam.pos.z = vars.state === 'roll' ? Math.max(b.z + 6, -18) : 13; cam.target.x = 0; cam.target.y = 0.6; cam.target.z = vars.state === 'roll' ? Math.max(b.z - 10, -30) : -24;
      });
    }));
    return p; } });
})();
