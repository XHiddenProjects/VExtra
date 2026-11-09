/* Five 3D example games for Library → Games: first-person mic hunt, third-person parkour, hyper-real garage, arena defence, bowling lanes. */
(function () {
  const K = VX.exKit, PH = K.PH;
  const add = (p, ...a) => K.add(p, '3d', ...a);
  const stat = (e) => PH('static', Object.assign({ friction: 0.4 }, e));

  /* ---------------------------------------------------------------- 1 · Echo Maze (first person, the stalker hears you) */
  VX.gameExamples.push({ id: 'ex3d-echomaze', name: 'Echo Maze (3D)', type: 'game3d', desc: 'First-person maze: collect the gems, but the Stalker hunts by sound – footsteps, and your real voice if you allow the microphone (hold M to shout when you have no mic).', build() {
    const p = K.proj('Echo Maze', '3d', '#0b1020'); p.settings.touch = { buttons: [{ label: 'Shout', key: 'm' }, { label: 'Sneak', key: 'shift' }] }; K.sky(p, 0.5, 0.9); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -25, z: 0 }; sc.camera3d = { mode: 'fps', yaw: 180, fov: 75, pos: { x: 0, y: 1.7, z: 0 }, target: { x: 0, y: 1.7, z: -5 } };
    K.synth(p, 'gem', 'square', 700, 1400, 0.2, 0.3); K.synth(p, 'growl', 'saw', 120, 50, 0.5, 0.4); K.synth(p, 'win', 'square', 392, 1568, 0.9, 0.3);
    const wallMat = K.mat(p, 'Maze wall', { color: '#3a4a6b', roughness: 0.9, metalness: 0, pattern: 'bricks', color2: '#26324d' }), floorMat = K.mat(p, 'Maze floor', { color: '#1a2236', roughness: 1, metalness: 0 });
    const MAP = ['###########', '#S..#.....#', '#.#.#.###.#', '#.#...#...#', '#.#####.#.#', '#...#...#.#', '###.#.###.#', '#...#...#.#', '#.#####.#.#', '#........G#', '###########'], C = 4;
    const at = (c, r) => [(c - 5) * C, (r - 5) * C]; const gems = []; let start = [0, 0];
    MAP.forEach((row, r) => [...row].forEach((ch, c) => { const [x, z] = at(c, r); if (ch === '#') add(p, 'cube', 'Wall', x, 2, { z, w: C, h: 4, d: C, color: '#3a4a6b', matAsset: wallMat, physics: stat({ friction: 0 }), tags: ['wall'] }); else if (ch === 'S') start = [x, z]; else if (ch === 'G') gems.push([x, z]); else if (ch === '.' && (r + c) % 4 === 1) gems.push([x, z]); }));
    add(p, 'cube', 'Floor', 0, -0.5, { z: 0, w: 60, h: 1, d: 60, color: '#1a2236', matAsset: floorMat, physics: stat({ friction: 0 }) }); add(p, 'cube', 'Ceiling', 0, 4.5, { z: 0, w: 60, h: 1, d: 60, color: '#0e1424', physics: stat() });
    const gemB = K.bhv(p, 'Gem – spin', ({ block, start }) => { start().to(block('spin', { target: 'self', mode: 'set', speed: 90, axis: 'y' })); });
    gems.forEach(([x, z], i) => add(p, 'sphere', 'Gem ' + i, x, 1.2, { z, w: 0.6, h: 0.6, d: 0.6, color: '#5be4ff', tags: ['gem'], material: { emissive: '#1b8ea8', metalness: 0.4, roughness: 0.2 }, behaviors: [gemB] }));
    /* state: 0 = playing, 1 = caught, 2 = escaped.  alert: 0 = calm, 1 = hunting */
    const rules = K.bhv(p, 'Echo Maze – rules & HUD', ({ block, gv, ex, lab, start, put, flt, snd }) => {
      gv('state', 'set', 0, 0); gv('gems', 'set', 0, 0); gv('total', 'set', gems.length, gems.length); gv('alert', 'set', 0, 0);
      lab('hud', 'Gems {gems} / {total}', 'topLeft', 24, '#9fe8ff', 14); lab('help', 'WASD / stick move · Shift sneak · mouse or drag to look · M shout · mic = your voice', 'bottom', 14, '#7c8db5', 10);
      const calm = lab('calm', 'Stalker: calm', 'topRight', 20, '#9fe8b0', 14), hunt = lab('hunt', 'Stalker: hunting!', 'topRight', 20, '#ff9aa8', 14);
      const dead = lab('dead', 'The Stalker heard you.  Click to try again', 'center', 30, '#ffd7d7', 0), won = lab('won', 'All gems collected – you escaped!  Click to play again', 'center', 30, '#ffffff', 0);
      start().to(put('state', 'set', 0)); start().to(put('gems', 'set', 0)); start().to(put('alert', 'set', 0)); start().to(dead, 'out', 'hide'); start().to(won, 'out', 'hide'); start().to(hunt, 'out', 'hide');
      const when = (name, op, v) => block('sensor', { target: 'self', property: 'global:' + name, op, value: v, mode: 'edge' });
      const a0 = when('alert', '==', 0); a0.to(calm, 'out', 'show'); a0.to(hunt, 'out', 'hide');
      const a1 = when('alert', '==', 1); a1.to(hunt, 'out', 'show'); a1.to(calm, 'out', 'hide'); a1.to(snd('growl'));
      when('state', '==', 1).to(dead, 'out', 'show'); const w = when('state', '==', 2); w.to(won, 'out', 'show'); w.to(snd('win'));
      block('mouseClick', { phase: 'click' }).to(ex('state != 0', 'Game over?')).to(flt('truthy')).to(block('restartGame', { scope: 'game' }), 'pass');
    });
    K.scene(p, [rules]);
    /* the Stalker has ears: the Hearing block turns noises (footsteps, your voice, M) into a place to walk to */
    const stalkerB = K.bhv(p, 'Stalker – hears you', ({ block, ex, put, flt, start }) => {
      const ears = block('hearing', { range: 1, chase: true, speed: 3.4, stopAt: 1.2, memory: 5, face: true, faceOffset: 0, flat: true }, 'Ears');
      ears.to(put('alert', 'set', 1), 'heard'); ears.to(put('alert', 'set', 0), 'lost');
      /* when the game is over the Stalker stops listening */
      const over = block('sensor', { target: 'self', property: 'global:state', op: '>', value: 0, mode: 'edge' }); over.to(ears, 'out', 'disable'); over.to(block('velocity', { target: 'self', mode: 'set', x: '0', z: '0' }));
      /* close enough = caught */
      block('proximity', { target: 'tag:player', radius: 1.7, mode: 'enter' }).to(ex('state == 0', 'Still playing?')).to(flt('truthy')).to(put('state', 'set', 1), 'pass');
    });
    add(p, 'sphere', 'Stalker', at(9, 9)[0], 1.2, { z: at(9, 9)[1], w: 1.6, h: 1.6, d: 1.6, color: '#ff3b57', material: { emissive: '#a0102a', roughness: 0.3, metalness: 0.2 }, tags: ['enemy'], physics: PH('kinematic', { shape: 'sphere' }), behaviors: [stalkerB] });
    /* the player: camera, WASD relative to where you look, footsteps and voice make noise, gems are picked up by proximity */
    const playerB = K.bhv(p, 'Player – move, look & noise', ({ block, gv, ex, put, flt, snd, start, key }) => {
      start().to(block('camera', { action: 'mode3d', mode: 'fps', target: 'Player', eye: 0.55, distance: 0 }));
      block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.12 }));
      /* speed: 5 walking, 2.2 while Shift is held (sneaking is quieter) */
      gv('speed', 'set', 5, 5); start().to(put('speed', 'set', 5)); key('shift', 'down').to(put('speed', 'set', 2.2)); key('shift', 'up').to(put('speed', 'set', 5));
      /* every frame: stop, then each held key adds its direction (relative to the camera) */
      block('always', {}).to(block('velocity', { target: 'self', mode: 'set', x: '0', z: '0', space: 'world' }, 'Stand still'));
      const go = (k, expr, src) => key(k, 'held').to(ex(expr, 'Move')).to(block('velocity', { target: 'self', mode: 'add', source: src, space: 'camera' }));
      go('w', '-speed * (state == 0)', 'signalZ'); go('arrowup', '-speed * (state == 0)', 'signalZ'); go('s', 'speed * (state == 0)', 'signalZ'); go('arrowdown', 'speed * (state == 0)', 'signalZ');
      go('d', 'speed * (state == 0)', 'signalX'); go('arrowright', 'speed * (state == 0)', 'signalX'); go('a', '-speed * (state == 0)', 'signalX'); go('arrowleft', '-speed * (state == 0)', 'signalX');
      block('makeNoise', { source: 'self', radius: 8, footsteps: true, stepSpeed: 1.5, stepRadius: 5, stepEvery: 0.45 }, 'Footsteps');
      const voice = block('voiceNoise', { source: 'self', radius: 60, minLevel: 8, gain: 2, quietKey: 'shift', testKey: 'm' }, 'Your voice');
      const nomic = block('label', { id: 'mic', text: 'No microphone – hold M to shout', anchor: 'topRight', size: 14, color: '#7c8db5', y: 44 }); start().to(nomic, 'out', 'hide'); voice.to(nomic, 'error', 'show');
      /* gems */
      const pick = block('proximity', { target: 'tag:gem', radius: 1.1, mode: 'enter' }, 'Gem in reach');
      pick.to(block('emit', { target: 'other', count: 14, color: '#5be4ff', speed: 4, spread: 360, life: 0.5, size: 0.15, gravity: 0 }), 'out', 'emit'); pick.to(block('destroyer', { target: 'other' })); pick.to(snd('gem'));
      pick.to(put('gems', 'add', 1)).to(ex('gems >= total', 'All gems?')).to(flt('truthy')).to(put('state', 'set', 2), 'pass');
    });
    add(p, 'cube', 'Player', start[0], 1.2, { z: start[1], w: 0.8, h: 1.6, d: 0.8, color: '#ffffff', visible: false, tags: ['player'], physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true, mass: 1 }), behaviors: [playerB] });
    return p; } });

  /* ---------------------------------------------------------------- 2 · Sky Parkour (third person, kinematic moving platforms, crumbling tiles, checkpoints) */
  VX.gameExamples.push({ id: 'ex3d-parkour', name: 'Sky Parkour (3D)', type: 'game3d', desc: 'Third-person parkour above the clouds: moving platforms (kinematic), crumbling tiles that fall with kinematic gravity, checkpoints and coins. WASD, Space to jump, mouse to turn the camera.', build() {
    const p = K.proj('Sky Parkour', '3d', '#9ad7ff'); K.sky(p, 1.2, 0.8); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -28, z: 0 }; sc.camera3d = { mode: 'follow', fov: 65, pos: { x: 0, y: 4, z: 9 }, target: { x: 0, y: 1, z: 0 } };
    K.synth(p, 'coin', 'square', 880, 1760, 0.15, 0.25); K.synth(p, 'jump', 'triangle', 260, 520, 0.14, 0.3); K.synth(p, 'check', 'triangle', 392, 784, 0.4, 0.3); K.synth(p, 'fall', 'saw', 500, 60, 0.6, 0.3); K.synth(p, 'win', 'square', 523, 1568, 0.9, 0.3); K.synth(p, 'crumble', 'noise', 300, 60, 0.4, 0.3);
    const grass = K.mat(p, 'Grass', { color: '#5fb86a', roughness: 0.9 }), stone = K.mat(p, 'Stone', { color: '#aab4c4', roughness: 0.8, pattern: 'checker', color2: '#8e99ab' });
    /* ---- behaviours (all blocks) ---- state: 0 = playing, 1 = finished.  carryX/carryZ = speed of the moving platform you stand on */
    const rules = K.bhv(p, 'Sky Parkour – rules & HUD', ({ block, gv, ex, lab, start, put, flt, snd }) => {
      gv('state', 'set', 0, 0); gv('coins', 'set', 0, 0); gv('time', 'set', 0, 0); gv('cp', 'set', 0, 0); gv('carryX', 'set', 0, 0); gv('carryZ', 'set', 0, 0); gv('spawnX', 'set', 0, 0); gv('spawnY', 'set', 1.4, 1.4); gv('spawnZ', 'set', 0, 0);
      lab('hud', 'Coins {coins} / 10      Time {time}s', 'topLeft', 24, '#12304f', 14); lab('cp', 'Checkpoint {cp} / 3', 'topRight', 18, '#12304f', 16); lab('help', 'WASD move · Space jump · mouse turns the camera (click to capture)', 'bottom', 14, '#12304f', 10);
      const won = lab('won', 'You made it in {time}s with {coins} coins!  Click to play again', 'center', 30, '#12304f', 0); start().to(won, 'out', 'hide');
      const fin = block('sensor', { target: 'self', property: 'global:state', op: '==', value: 1, mode: 'edge' }); fin.to(won, 'out', 'show'); fin.to(snd('win'));
      /* the clock */
      block('timer', { interval: 1, repeat: true, autoStart: true, delay: 0 }, 'Every second').to(ex('state == 0', 'Playing?')).to(flt('truthy')).to(put('time', 'add', 1), 'pass');
      block('mouseClick', { phase: 'click' }).to(ex('state != 0', 'Finished?')).to(flt('truthy')).to(block('restartGame', { scope: 'game' }), 'pass');
    });
    K.scene(p, [rules]);
    /* a platform that slides: its velocity is a sine wave of the game clock, and it tells the player how fast it moves while they stand on it */
    const moverCache = {}; const mover = (axis) => moverCache[axis] || (moverCache[axis] = K.bhv(p, 'Moving platform ' + axis.toUpperCase(), ({ block, gv, ex, put, start }) => {
      block('always', {}).to(ex('cos(time * 0.7) * 3.5', 'Slide speed')).to(block('velocity', { target: 'self', mode: 'set', source: axis === 'x' ? 'signalX' : 'signalZ', space: 'world' }));
      const stay = block('collision', { with: 'tag:player', phase: 'stay', side: 'top' }, 'Player on me');
      stay.to(ex('self.vx', 'My X speed')).to(gv('carryX', 'set')); stay.to(ex('self.vz', 'My Z speed')).to(gv('carryZ', 'set'));
      const off = block('collision', { with: 'tag:player', phase: 'exit' }, 'Player left'); off.to(put('carryX', 'set', 0)); off.to(put('carryZ', 'set', 0));
    }));
    /* a red tile: shakes the sound, then falls away 0.7 s after you land on it */
    const crumble = K.bhv(p, 'Crumbling tile', ({ block, snd }) => {
      const hit = block('collision', { with: 'tag:player', phase: 'enter', side: 'top' }, 'Stepped on'); hit.to(snd('crumble'));
      const t = hit.to(block('timer', { interval: 0.7, repeat: false, autoStart: false, delay: 0 }, 'Crumble delay'), 'out', 'start');
      t.to(block('velocity', { target: 'self', mode: 'set', y: '-10' })); t.to(block('destroyer', { target: 'self', delay: 3 }));
    });
    /* a checkpoint platform: remembers where to respawn, plays a chime once */
    const checkpoint = (i) => K.bhv(p, 'Checkpoint ' + i, ({ block, gv, ex, put, snd }) => {
      const first = block('collision', { with: 'tag:player', phase: 'enter', side: 'top' }, 'Landed').to(block('toggleSwitch', { loop: false, state: 'out1' }, 'Only once'));
      first.to(first, 'out1', 'next'); first.to(snd('check'), 'out1'); first.to(put('cp', 'set', i), 'out1');
      first.to(ex('self.x', 'Spawn X'), 'out1').to(gv('spawnX', 'set')); first.to(ex('self.y + 1.4', 'Spawn Y'), 'out1').to(gv('spawnY', 'set')); first.to(ex('self.z', 'Spawn Z'), 'out1').to(gv('spawnZ', 'set'));
    });
    const coinB = K.bhv(p, 'Coin – spin', ({ block, start }) => { start().to(block('spin', { target: 'self', mode: 'set', speed: 120, axis: 'z' })); });
    const goalB = K.bhv(p, 'Goal – spin', ({ block, start }) => { start().to(block('spin', { target: 'self', mode: 'set', speed: 60, axis: 'y' })); });
    const plat = (n, x, y, z, w, d, extra) => add(p, 'cube', n, x, y, Object.assign({ z, w, h: 1, d, color: '#aab4c4', matAsset: stone, physics: stat({ friction: 0 }) }, extra));
    plat('Start', 0, 0, 0, 7, 7, { matAsset: grass, tags: ['checkpoint'] }); plat('Step 1', 0, 1.2, -9, 4, 4); plat('Step 2', 5, 2.4, -15, 4, 4); plat('Step 3', 10, 3.6, -21, 4, 4, { tags: ['checkpoint'], behaviors: [checkpoint(1)] });
    [['Mover A', 14, 4.6, -28, 'x'], ['Mover B', 22, 5.2, -28, 'z'], ['Mover C', 28, 6.4, -35, 'x']].forEach(([n, x, y, z, axis]) => plat(n, x, y, z, 4, 4, { color: '#ffb84d', matAsset: undefined, physics: PH('kinematic', { friction: 0 }), tags: ['mover'], behaviors: [mover(axis)] }));
    plat('Rest', 34, 7, -40, 5, 5, { tags: ['checkpoint'], matAsset: grass, behaviors: [checkpoint(2)] });
    for (let i = 0; i < 5; i++) plat('Tile ' + i, 34 - (i + 1) * 3.4, 7.4 + i * 0.5, -46 - i * 3.2, 3, 3, { color: '#ff6b6b', matAsset: undefined, physics: PH('kinematic', { friction: 0 }), tags: ['crumble'], behaviors: [crumble] });
    plat('Top', 14, 11.4, -66, 8, 8, { matAsset: grass, tags: ['checkpoint'], behaviors: [checkpoint(3)] }); add(p, 'cone', 'Goal', 14, 14, { z: -66, w: 1.6, h: 3, d: 1.6, color: '#ffd23f', material: { emissive: '#aa8800', metalness: 0.6, roughness: 0.2 }, tags: ['goal'], behaviors: [goalB] });
    [[0, 1.4, -9], [5, 2.6, -15], [10, 3.8, -21], [14, 5.4, -28], [22, 6, -28], [28, 7.2, -35], [34, 8, -40], [31, 8.8, -49], [24, 10, -56], [14, 12, -66]].forEach(([x, y, z], i) => add(p, 'cylinder', 'Coin ' + i, x, y + 0.4, { z, w: 0.7, h: 0.1, d: 0.7, color: '#ffd23f', rx: 90, tags: ['coin'], behaviors: [coinB], material: { emissive: '#aa8800', metalness: 0.8, roughness: 0.2 } }));
    for (let i = 0; i < 18; i++) add(p, 'sphere', 'Cloud ' + i, -30 + (i * 17) % 90, -6 + (i % 4) * -2, { z: -(i * 13) % 100 + 10, w: 8 + (i % 3) * 3, h: 3, d: 6, color: '#ffffff', alpha: 0.9, tags: ['decor'] });
    const playerB = K.bhv(p, 'Player – run, jump & collect', ({ block, ex, put, flt, snd, start, key }) => {
      start().to(block('camera', { action: 'mode3d', mode: 'follow', target: 'Player', distance: 9, height: 3, lerp: 0.12 }));
      block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.15 }));
      /* every frame: take the speed of the platform under you, then each held key adds its direction relative to the camera */
      const base = block('always', {}); base.to(ex('carryX', 'Platform X')).to(block('velocity', { target: 'self', mode: 'set', source: 'signalX', space: 'world' })); base.to(ex('carryZ', 'Platform Z')).to(block('velocity', { target: 'self', mode: 'set', source: 'signalZ', space: 'world' }));
      const go = (k, expr, src) => key(k, 'held').to(ex(expr, 'Move')).to(block('velocity', { target: 'self', mode: 'add', source: src, space: 'camera' }));
      ['w', 'arrowup'].forEach((k) => go(k, '-7 * (state == 0)', 'signalZ')); ['s', 'arrowdown'].forEach((k) => go(k, '7 * (state == 0)', 'signalZ')); ['d', 'arrowright'].forEach((k) => go(k, '7 * (state == 0)', 'signalX')); ['a', 'arrowleft'].forEach((k) => go(k, '-7 * (state == 0)', 'signalX'));
      /* jump only when standing (vertical speed ~0) */
      const jump = key('space', 'down').to(ex('state == 0 && abs(self.vy) < 0.3', 'Can jump?')).to(flt('truthy')); jump.to(block('velocity', { target: 'self', mode: 'set', y: '11' }), 'pass'); jump.to(snd('jump'), 'pass');
      /* coins and the goal */
      const coin = block('proximity', { target: 'tag:coin', radius: 1.2, mode: 'enter' }, 'Coin in reach');
      coin.to(block('emit', { target: 'other', count: 10, color: '#ffd23f', speed: 3, spread: 360, life: 0.4, size: 0.12, gravity: 0 }), 'out', 'emit'); coin.to(block('destroyer', { target: 'other' })); coin.to(snd('coin')); coin.to(put('coins', 'add', 1));
      block('proximity', { target: 'tag:goal', radius: 2.2, mode: 'enter' }, 'Goal in reach').to(put('state', 'set', 1));
      /* fell off: back to the last checkpoint */
      const fell = block('sensor', { target: 'self', property: 'y', op: '<', value: -15, mode: 'edge' }, 'Fell!');
      fell.to(snd('fall')); fell.to(ex('spawnX')).to(block('position', { target: 'self', mode: 'set', source: 'signalX' })); fell.to(ex('spawnY')).to(block('position', { target: 'self', mode: 'set', source: 'signalY' })); fell.to(ex('spawnZ')).to(block('position', { target: 'self', mode: 'set', source: 'signalZ' })); fell.to(block('velocity', { target: 'self', mode: 'stop' })); fell.to(put('carryX', 'set', 0)); fell.to(put('carryZ', 'set', 0));
    });
    add(p, 'cube', 'Player', 0, 1.2, { z: 0, w: 0.9, h: 1.6, d: 0.9, color: '#6c8cff', tags: ['player'], material: { metalness: 0.2, roughness: 0.4 }, physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true, mass: 1 }), behaviors: [playerB] });
    return p; } });

  /* ---------------------------------------------------------------- 3 · Showroom (hyper-real PBR materials, Realism effect, turntables) */
  VX.gameExamples.push({ id: 'ex3d-showroom', name: 'Hyper-Real Showroom (3D)', type: 'game3d', desc: 'Walk around a night showroom lit with the Realism look: clear-coat car paint, brushed steel, glass and wet asphalt on turntables. Keys 1-3 change the light, P is photo mode.', build() {
    const p = K.proj('Hyper-Real Showroom', '3d', '#05060a'); K.sky(p, 0.35, 0.25); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -25, z: 0 }; sc.camera3d = { mode: 'fps', yaw: 0, fov: 62, pos: { x: 0, y: 1.7, z: 12 }, target: { x: 0, y: 1, z: 0 } };
    const R = (n, o) => K.mat(p, n, Object.assign({ realism: true, envIntensity: 1.2, detail: 0.5 }, o));
    const paints = [R('Car paint red', { color: '#b3121b', metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, detail: 0.15, envIntensity: 1.6 }), R('Car paint blue', { color: '#0b2a7a', metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, detail: 0.15, envIntensity: 1.6 }), R('Car paint pearl', { color: '#e9e6df', metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, detail: 0.15, envIntensity: 1.5 })];
    const steel = R('Brushed steel', { color: '#b9bec6', metalness: 1, roughness: 0.38, clearcoat: 0.2 }), glass = R('Glass', { color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 0.95, ior: 1.5, thickness: 0.2, opacity: 1 }), rubber = R('Rubber', { color: '#1c1c1c', metalness: 0, roughness: 0.85 }), asphalt = R('Wet asphalt', { color: '#262626', metalness: 0, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, detail: 1, envIntensity: 1.3 }), leather = R('Leather', { color: '#5a3522', metalness: 0, roughness: 0.55, sheen: 0.35, detail: 1 });
    add(p, 'cube', 'Floor', 0, -0.5, { z: 0, w: 70, h: 1, d: 70, color: '#262626', matAsset: asphalt, physics: stat({ friction: 0 }) });
    for (const [x, z, w, d] of [[0, -22, 60, 1], [-30, 0, 1, 50], [30, 0, 1, 50], [0, 22, 60, 1]]) add(p, 'cube', 'Wall', x, 4, { z, w, h: 8, d, color: '#14161c', physics: stat({ friction: 0 }) });
    for (let i = -2; i <= 2; i++) add(p, 'cube', 'Light panel ' + i, i * 10, 7.8, { z: -8, w: 6, h: 0.2, d: 1, color: '#ffffff', material: { emissive: '#ffffff', emissiveIntensity: 2 } });
    /* turntables spin; every car part orbits the turntable's centre with the same Expression maths */
    const turnB = K.bhv(p, 'Turntable – spin', ({ block, start }) => { start().to(block('spin', { target: 'self', mode: 'set', speed: 8, axis: 'y' })); });
    const partB = K.bhv(p, 'Car part – ride the turntable', ({ block, ex }) => {
      const a = '(time * 8 * 0.0174533)', tick = block('always', {});
      tick.to(ex('self.cx + self.dx * cos' + a + ' + self.dz * sin' + a, 'X on the turntable')).to(block('position', { target: 'self', mode: 'set', source: 'signalX' }));
      tick.to(ex('self.cz - self.dx * sin' + a + ' + self.dz * cos' + a, 'Z on the turntable')).to(block('position', { target: 'self', mode: 'set', source: 'signalZ' }));
      tick.to(ex('time * 8', 'Turntable angle')).to(block('rotation', { target: 'self', mode: 'set', axis: 'y', source: 'signal' }));
    });
    const car = (n, x, z, paint) => { add(p, 'cube', n + ' turntable', x, 0.15, { z, w: 8, h: 0.3, d: 8, color: '#2a2d36', matAsset: steel, physics: stat({ friction: 0 }), tags: ['turn'], behaviors: [turnB] });
      const part = (type, nm, dx, dy, dz, w, h, d, mat, extra) => add(p, type, n + ' ' + nm, x + dx, 0.3 + dy, Object.assign({ z: z + dz, w, h, d, color: '#ffffff', matAsset: mat, tags: ['carpart'], vars: { dx, dz, dy, cx: x, cz: z }, behaviors: [partB] }, extra));
      part('cube', 'body', 0, 0.75, 0, 4.4, 0.7, 1.9, paint); part('cube', 'cabin', -0.2, 1.35, 0, 2.3, 0.65, 1.7, glass); part('cube', 'roof', -0.2, 1.72, 0, 2.0, 0.08, 1.6, paint); part('cube', 'seat', -0.5, 1.0, 0, 0.8, 0.5, 1.1, leather);
      for (const [dx, dz] of [[1.4, 1], [1.4, -1], [-1.4, 1], [-1.4, -1]]) { part('cylinder', 'tyre', dx, 0.45, dz * 0.95, 0.9, 0.35, 0.9, rubber, { rx: 90 }); part('cylinder', 'rim', dx, 0.45, dz * 1.1, 0.55, 0.1, 0.55, steel, { rx: 90 }); }
      for (const dz of [0.6, -0.6]) part('sphere', 'lamp', 2.2, 0.9, dz, 0.35, 0.25, 0.3, steel, { material: { emissive: '#fff6d8', emissiveIntensity: 3 } }); };
    car('Red coupe', -12, -2, paints[0]); car('Blue coupe', 0, -6, paints[1]); car('Pearl coupe', 12, -2, paints[2]);
    /* HUD: view 0 / 1 / 2 = Night / Dusk / Studio, view 3 = photo mode (everything hidden) */
    const rules = K.bhv(p, 'Showroom – lights & photo mode', ({ block, gv, ex, lab, start, put, key }) => {
      gv('light', 'set', 0, 0); gv('view', 'set', 0, 0);
      const names = ['Night', 'Dusk', 'Studio'], sun = [0.35, 0.8, 1.6], sky = [0.25, 0.5, 1.0];
      const labels = names.map((nm, i) => lab('light' + i, 'Light: ' + nm, 'topLeft', 22, '#e6ecff', 14)), help = lab('help', 'WASD walk · mouse look (click to capture) · 1 Night · 2 Dusk · 3 Studio · P photo mode', 'bottom', 14, '#9aa7c7', 10);
      start().to(block('shader', { effect: 'realism', mode: 'all', amount: 100 }), 'out', 'in');
      names.forEach((nm, i) => {
        const pick = block('number', { value: i }, 'Light: ' + nm); key(String(i + 1), 'down').to(pick); pick.to(put('light', 'set', i)); pick.to(put('view', 'set', i));
        pick.to(block('light', { target: 'Sun', mode: 'set', intensity: String(sun[i]), color: '' }, nm + ' – sun')); pick.to(block('light', { target: 'Sky light', mode: 'set', intensity: String(sky[i]), color: '' }, nm + ' – sky'));
        const s = block('sensor', { target: 'self', property: 'global:view', op: '==', value: i, mode: 'edge' }); s.to(labels[i], 'out', 'show'); labels.forEach((o, j) => { if (j !== i) s.to(o, 'out', 'hide'); }); s.to(help, 'out', 'show');
      });
      key('p', 'down').to(ex('view == 3 ? light : 3', 'Photo mode on / off')).to(gv('view', 'set'));
      const photo = block('sensor', { target: 'self', property: 'global:view', op: '==', value: 3, mode: 'edge' }); labels.forEach((o) => photo.to(o, 'out', 'hide')); photo.to(help, 'out', 'hide');
    });
    K.scene(p, [rules]);
    const playerB = K.bhv(p, 'Player – walk & look', ({ block, ex, gv, start, key }) => {
      start().to(block('camera', { action: 'mode3d', mode: 'fps', target: 'Player', eye: 0.55, distance: 0 })); block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.12 }));
      block('always', {}).to(block('velocity', { target: 'self', mode: 'set', x: '0', z: '0', space: 'world' }, 'Stand still'));
      const go = (k, v, src) => key(k, 'held').to(ex(String(v), 'Walk')).to(block('velocity', { target: 'self', mode: 'add', source: src, space: 'camera' }));
      ['w', 'arrowup'].forEach((k) => go(k, -5, 'signalZ')); ['s', 'arrowdown'].forEach((k) => go(k, 5, 'signalZ')); ['d', 'arrowright'].forEach((k) => go(k, 5, 'signalX')); ['a', 'arrowleft'].forEach((k) => go(k, -5, 'signalX'));
    });
    add(p, 'cube', 'Player', 0, 1.2, { z: 14, w: 0.8, h: 1.6, d: 0.8, color: '#ffffff', visible: false, tags: ['player'], physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true }), behaviors: [playerB] });
    return p; } });

  /* ---------------------------------------------------------------- 4 · Core Defender (first-person arena defence, hitscan turret) */
  VX.gameExamples.push({ id: 'ex3d-defender', name: 'Core Defender (3D)', type: 'game3d', desc: 'Stand beside the glowing core and shoot the crawlers before they reach it. Waves get bigger, mouse aims, click fires, R repairs the core with scrap.', build() {
    const p = K.proj('Core Defender', '3d', '#120a1e'); K.sky(p, 0.7, 0.6); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -25, z: 0 }; sc.camera3d = { mode: 'fps', fov: 72, pos: { x: 0, y: 1.7, z: 4 }, target: { x: 0, y: 1.7, z: 0 } };
    K.synth(p, 'shot', 'saw', 900, 200, 0.12, 0.25); K.synth(p, 'hit', 'noise', 600, 100, 0.2, 0.3); K.synth(p, 'core', 'square', 150, 60, 0.4, 0.4); K.synth(p, 'wave', 'triangle', 330, 660, 0.5, 0.3); K.synth(p, 'lose', 'saw', 300, 40, 1, 0.4);
    const floor = K.mat(p, 'Arena floor', { color: '#2b2440', roughness: 0.9, pattern: 'checker', color2: '#221c33' }), coreMat = K.mat(p, 'Core', { color: '#44e0ff', emissive: '#22a8d0', metalness: 0.4, roughness: 0.2 });
    add(p, 'cube', 'Floor', 0, -0.5, { z: 0, w: 60, h: 1, d: 60, color: '#2b2440', matAsset: floor, physics: stat({ friction: 0 }) });
    for (const [x, z, w, d] of [[0, -30, 60, 1], [0, 30, 60, 1], [-30, 0, 1, 60], [30, 0, 1, 60]]) add(p, 'cube', 'Wall', x, 2, { z, w, h: 4, d, color: '#3b2f5c', physics: stat({ friction: 0 }) });
    /* ---- all behaviours are block graphs.  state: 0 = playing, 1 = core destroyed.  toSpawn = crawlers still to come this wave, enemies = crawlers alive ---- */
    const rules = K.bhv(p, 'Core Defender – waves, HUD & repair', ({ block, gv, ex, lab, start, put, flt, snd, key }) => {
      gv('core', 'set', 100, 100); gv('wave', 'set', 0, 0); gv('score', 'set', 0, 0); gv('scrap', 'set', 0, 0); gv('state', 'set', 0, 0); gv('toSpawn', 'set', 0, 0); gv('enemies', 'set', 0, 0); gv('gap', 'set', 0, 0);
      lab('hud', 'Core {core}%   Wave {wave}   Score {score}   Scrap {scrap}', 'topLeft', 22, '#bff3ff', 14); lab('cross', '+', 'center', 28, '#ffffff', 0); lab('help', 'WASD move · mouse aim (click to capture) · click shoot · R repair (3 scrap)', 'bottom', 14, '#b9a9e0', 10);
      const waveMsg = lab('waveMsg', 'Wave {wave}', 'center', 30, '#ffffff', -110), lost = lab('lost', 'The core fell on wave {wave} – score {score}.  Click to retry', 'center', 30, '#ffd7d7', -110);
      start().to(waveMsg, 'out', 'hide'); start().to(lost, 'out', 'hide');
      /* a new wave starts when nothing is left to spawn and nothing is alive */
      const idle = block('timer', { interval: 0.25, repeat: true, autoStart: true, delay: 0 }, 'Wave check').to(ex('state == 0 && toSpawn == 0 && enemies == 0 && gap == 0', 'Wave over?')).to(flt('truthy'));
      idle.to(put('gap', 'set', 1), 'pass');
      const pause = idle.to(block('timer', { interval: 2, repeat: false, autoStart: false, delay: 0 }, 'Breather'), 'pass', 'start');
      pause.to(put('wave', 'add', 1)); pause.to(ex('4 + wave * 3', 'Crawlers this wave')).to(gv('toSpawn', 'set')); pause.to(put('gap', 'set', 0)); pause.to(snd('wave')); pause.to(waveMsg, 'out', 'show');
      pause.to(block('timer', { interval: 1.5, repeat: false, autoStart: false, delay: 0 }, 'Hide banner'), 'tick', 'start').to(waveMsg, 'tick', 'hide');
      /* repair the core with scrap */
      const fix = key('r', 'down').to(ex('state == 0 && scrap >= 3 && core < 100', 'Can repair?')).to(flt('truthy'));
      fix.to(put('scrap', 'add', -3), 'pass'); fix.to(ex('min(100, core + 15)'), 'pass').to(gv('core', 'set')); fix.to(snd('wave'), 'pass');
      /* core destroyed */
      const dead = block('sensor', { target: 'self', property: 'global:core', op: '<=', value: 0, mode: 'edge' }, 'Core destroyed'); dead.to(put('state', 'set', 1)); dead.to(put('core', 'set', 0)); dead.to(lost, 'out', 'show'); dead.to(snd('lose'));
      block('mouseClick', { phase: 'click' }).to(ex('state != 0', 'Game over?')).to(flt('truthy')).to(block('restartGame', { scope: 'game' }), 'pass');
    });
    K.scene(p, [rules]);
    const coreB = K.bhv(p, 'Core – spin & bob', ({ block, ex, start }) => { start().to(block('spin', { target: 'self', mode: 'set', speed: 30, axis: 'y' })); block('always', {}).to(ex('1.6 + sin(time * 2) * 0.12')).to(block('position', { target: 'self', mode: 'set', source: 'signalY' })); });
    add(p, 'sphere', 'Core', 0, 1.6, { z: 0, w: 2.2, h: 2.2, d: 2.2, color: '#44e0ff', matAsset: coreMat, tags: ['core'], behaviors: [coreB] });
    /* a crawler: walks at the core, has hit points, hurts the core when it arrives */
    const crawlerB = K.bhv(p, 'Crawler – walk to the core', ({ block, ex, put, snd, start }) => {
      start().to(ex('1 + floor(wave / 3)', 'Hit points')).to(block('objectVariable', { target: 'self', name: 'hp', op: 'set', amount: 1, initial: 1 }));
      const tick = block('always', {});
      tick.to(ex('-self.x / max(0.001, hypot(self.x, self.z)) * (2.2 + wave * 0.25)', 'Speed X')).to(block('velocity', { target: 'self', mode: 'set', source: 'signalX', space: 'world' }));
      tick.to(ex('-self.z / max(0.001, hypot(self.x, self.z)) * (2.2 + wave * 0.25)', 'Speed Z')).to(block('velocity', { target: 'self', mode: 'set', source: 'signalZ', space: 'world' }));
      tick.to(ex('0.7 + abs(sin(time * 6 + self.x)) * 0.25', 'Hop')).to(block('position', { target: 'self', mode: 'set', source: 'signalY' }));
      const arrive = block('proximity', { target: 'Core', radius: 2, mode: 'enter' }, 'Reached the core');
      arrive.to(put('core', 'add', -8)); arrive.to(put('enemies', 'add', -1)); arrive.to(snd('core')); arrive.to(block('camera', { action: 'shake', value: 0.3 })); arrive.to(block('destroyer', { target: 'self' }));
    });
    add(p, 'sphere', 'Crawler', 0, 0.7, { z: 0, w: 1.1, h: 1.1, d: 1.1, color: '#ff5a7a', prefab: true, tags: ['enemy'], physics: PH('kinematic', { shape: 'sphere' }), behaviors: [crawlerB], material: { emissive: '#661428', roughness: 0.5 } });
    /* four spawn points on the arena walls feed the crawlers into the wave */
    [['North', 0, -26, 26, 2.0], ['South', 0, 26, 26, 2.4], ['East', 26, 0, 0, 3.0], ['West', -26, 0, 0, 3.6]].forEach(([nm, x, z, rx, every]) => {
      const sp = K.bhv(p, 'Spawner ' + nm, ({ block, ex, put, flt }) => {
        const go = block('timer', { interval: every, repeat: true, autoStart: true, delay: 0 }, 'Spawn timer').to(ex('toSpawn > 0 && state == 0', 'Any left?')).to(flt('truthy'));
        go.to(put('toSpawn', 'add', -1), 'pass'); go.to(put('enemies', 'add', 1), 'pass'); go.to(block('spawn', { template: 'Crawler', count: 1, at: 'self', randomX: rx }), 'pass');
      });
      add(p, 'empty', 'Spawner ' + nm, x, 0.7, { z, behaviors: [sp] });
    });
    /* the player: move, look, shoot with a Ray Cast along the crosshair */
    const playerB = K.bhv(p, 'Player – move, aim & shoot', ({ block, gv, ex, put, flt, snd, start, key }) => {
      start().to(block('camera', { action: 'mode3d', mode: 'fps', target: 'Player', eye: 0.6, distance: 0 })); block('lockedMouse', { sensitivity: 1, lockOnClick: true }).to(block('camera', { action: 'look', sensitivity: 0.12 }));
      block('always', {}).to(block('velocity', { target: 'self', mode: 'set', x: '0', z: '0', space: 'world' }, 'Stand still'));
      const go = (k, v, src) => key(k, 'held').to(ex(v + ' * (state == 0)', 'Move')).to(block('velocity', { target: 'self', mode: 'add', source: src, space: 'camera' }));
      ['w', 'arrowup'].forEach((k) => go(k, -6, 'signalZ')); ['s', 'arrowdown'].forEach((k) => go(k, 6, 'signalZ')); ['d', 'arrowright'].forEach((k) => go(k, 6, 'signalX')); ['a', 'arrowleft'].forEach((k) => go(k, -6, 'signalX'));
      /* holding the mouse button keeps firing every 0.22 s */
      const fire = block('number', { value: 1 }, 'Fire!'), auto = block('timer', { interval: 0.22, repeat: true, autoStart: false, delay: 0 }, 'Rapid fire');
      const down = block('mouseClick', { phase: 'down' }); down.to(fire); down.to(auto, 'out', 'start'); block('mouseClick', { phase: 'up' }).to(auto, 'out', 'stop'); auto.to(fire);
      const ok = fire.to(ex('state == 0', 'Alive?')).to(flt('truthy'));
      ok.to(snd('shot'), 'pass');
      const ray = ok.to(block('rayCast', { direction: 'camera', distance: 60, only: 'tag:enemy', continuous: false }, 'Crosshair shot'), 'pass');
      ray.to(snd('hit'), 'hit');
      const hp = ray.to(block('objectVariable', { target: 'other', name: 'hp', op: 'subtract', amount: 1, initial: 1 }, 'Hit points'), 'hit').to(flt('<=', 0), 'out');
      hp.to(block('emit', { target: 'other', count: 16, color: '#ff5a7a', speed: 4, spread: 360, life: 0.5, size: 0.14, gravity: 0 }), 'pass', 'emit'); hp.to(block('destroyer', { target: 'other' }), 'pass'); hp.to(put('score', 'add', 10), 'pass'); hp.to(put('scrap', 'add', 1), 'pass'); hp.to(put('enemies', 'add', -1), 'pass');
    });
    add(p, 'cube', 'Player', 0, 1, { z: 5, w: 0.8, h: 1.6, d: 0.8, color: '#ffffff', visible: false, tags: ['player'], physics: PH('dynamic', { shape: 'box', friction: 0, fixedRotation: true }), behaviors: [playerB] });
    return p; } });

  /* ---------------------------------------------------------------- 5 · Marble Lanes (bowling with real physics) */
  VX.gameExamples.push({ id: 'ex3d-lanes', name: 'Marble Lanes (3D)', type: 'game3d', desc: 'Bowling with real physics: A/D aim, hold Space to charge the throw and release to roll. Six frames, two rolls each; strikes and spares score bonus points.', build() {
    const p = K.proj('Marble Lanes', '3d', '#1a1020'); K.sky(p, 0.9, 0.6); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -22, z: 0 }; sc.camera3d = { mode: 'follow', fov: 55, pos: { x: 0, y: 3, z: 12 }, target: { x: 0, y: 0.5, z: -8 } };
    K.synth(p, 'roll', 'noise', 200, 120, 0.5, 0.2); K.synth(p, 'crash', 'noise', 900, 80, 0.7, 0.45); K.synth(p, 'strike', 'square', 523, 1568, 0.7, 0.3); K.synth(p, 'tick', 'triangle', 600, 600, 0.05, 0.2);
    const wood = K.mat(p, 'Lane wood', { color: '#d9a766', roughness: 0.25, metalness: 0, pattern: 'checker', color2: '#cf9a58' }), ballMat = K.mat(p, 'Ball', { color: '#3b6dff', roughness: 0.15, metalness: 0.3 });
    add(p, 'cube', 'Lane', 0, -0.25, { z: -12, w: 4, h: 0.5, d: 40, color: '#d9a766', matAsset: wood, physics: stat({ friction: 0.05 }) });
    add(p, 'cube', 'Gutter L', -2.6, -0.45, { z: -12, w: 1.2, h: 0.5, d: 40, color: '#222', physics: stat({ friction: 0.3 }) }); add(p, 'cube', 'Gutter R', 2.6, -0.45, { z: -12, w: 1.2, h: 0.5, d: 40, color: '#222', physics: stat({ friction: 0.3 }) });
    add(p, 'cube', 'Backstop', 0, 1, { z: -33, w: 7, h: 3, d: 1, color: '#2a2036', physics: stat({}) }); add(p, 'cube', 'Pit floor', 0, -0.6, { z: -32, w: 7, h: 0.4, d: 3, color: '#111', physics: stat({}) });
    const downTest = 'abs(self.x - self.hx) > 0.35 || abs(self.z - self.hz) > 0.35 || self.y < 0.3';
    /* a pin remembers where it stood, answers a "count" from the rules, and can be swept away */
    const pinB = K.bhv(p, 'Pin – knocked down?', ({ block, ex, put, flt }) => {
      block('once', { when: 'start' }).to(ex('self.x', 'Home X')).to(block('objectVariable', { target: 'self', name: 'hx', op: 'set', amount: 0, initial: 0 }));
      block('once', { when: 'start' }).to(ex('self.z', 'Home Z')).to(block('objectVariable', { target: 'self', name: 'hz', op: 'set', amount: 0, initial: 0 }));
      block('mailbox', { channel: 'tally' }, 'Count!').to(ex(downTest, 'Am I down?')).to(flt('truthy')).to(block('message', { target: 'game', channel: 'down', payload: '' }), 'pass');
      block('mailbox', { channel: 'sweepDown' }, 'Clear fallen').to(ex(downTest, 'Am I down?')).to(flt('truthy')).to(block('destroyer', { target: 'self' }), 'pass');
      block('mailbox', { channel: 'sweepAll' }, 'Clear all').to(block('destroyer', { target: 'self' }));
    });
    add(p, 'cylinder', 'Pin', 0, 0.55, { z: 0, w: 0.5, h: 1.1, d: 0.5, color: '#ffffff', prefab: true, tags: ['pin'], physics: PH('dynamic', { shape: 'box', friction: 0.2, mass: 0.6, bounce: 0.1 }), behaviors: [pinB] });
    add(p, 'empty', 'Rack', 0, 0.55, { z: -26 });
    /* the ball: aim with A / D, hold Space to charge, release to roll */
    const ballB = K.bhv(p, 'Ball – aim, charge & roll', ({ block, gv, ex, put, flt, snd, start, key }) => {
      start().to(block('camera', { action: 'mode3d', mode: 'follow', target: 'Ball', distance: 7, height: 2.5, lerp: 0.08 }));
      const aim = (k, sign) => key(k, 'held').to(ex('state == 0 ? clamp(aim ' + sign + ' dt * 1.4, -1.4, 1.4) : aim', 'Aim')).to(gv('aim', 'set'));
      aim('a', '-'); aim('arrowleft', '-'); aim('d', '+'); aim('arrowright', '+');
      /* while aiming the ball sits on the foul line, in front of the aim marker */
      const wait = block('always', {}).to(ex('state == 0', 'Aiming?')).to(flt('truthy'));
      wait.to(ex('aim * 0.6'), 'pass').to(block('position', { target: 'self', mode: 'set', source: 'signalX' })); wait.to(block('position', { target: 'self', mode: 'set', z: '8' }), 'pass'); wait.to(block('velocity', { target: 'self', mode: 'set', x: '0', z: '0' }), 'pass');
      /* charge the throw while Space is held */
      block('always', {}).to(ex('state == 0 && charging == 1 ? min(100, power + dt * 90) : power', 'Charge')).to(gv('power', 'set'));
      const press = key('space', 'down').to(ex('state == 0', 'Aiming?')).to(flt('truthy')); press.to(put('charging', 'set', 1), 'pass'); press.to(put('power', 'set', 0), 'pass');
      const release = key('space', 'up').to(ex('state == 0 && charging == 1', 'Charging?')).to(flt('truthy'));
      release.to(put('charging', 'set', 0), 'pass');
      release.to(ex('-(12 + power * 0.2)', 'Throw speed')).to(block('velocity', { target: 'self', mode: 'set', source: 'signalZ', space: 'world' })); release.to(ex('aim * 0.8', 'Spin')).to(block('velocity', { target: 'self', mode: 'set', source: 'signalX', space: 'world' }));
      release.to(put('state', 'set', 1), 'pass'); release.to(snd('roll'), 'pass'); release.to(put('power', 'set', 0), 'pass');
      const timeout = release.to(block('timer', { interval: 7, repeat: false, autoStart: false, delay: 0 }, 'Give up waiting'), 'pass', 'start');
      /* the roll is over when the ball reaches the pit, falls off, or 7 s pass – then wait 2.5 s for the pins to settle */
      const over = block('number', { value: 1 }, 'Roll finished');
      block('sensor', { target: 'self', property: 'z', op: '<', value: -31, mode: 'edge' }, 'In the pit').to(over); block('sensor', { target: 'self', property: 'y', op: '<', value: -3, mode: 'edge' }, 'Fell off').to(over); timeout.to(over);
      block('sensor', { target: 'self', property: 'z', op: '<', value: -27, mode: 'edge' }, 'Hits the pins').to(snd('crash'));
      const settle = over.to(ex('state == 1', 'Still rolling?')).to(flt('truthy')).to(block('timer', { interval: 2.5, repeat: false, autoStart: false, delay: 0 }, 'Pins settle'), 'pass', 'start');
      over.to(ex('state == 1')).to(flt('truthy')).to(put('state', 'set', 3), 'pass');
      settle.to(block('message', { target: 'game', channel: 'resolve', payload: '' }));
      /* the rules can send the ball back to the foul line */
      const home = block('mailbox', { channel: 'home' }, 'Ball home'); home.to(block('velocity', { target: 'self', mode: 'stop' })); home.to(ex('aim * 0.6')).to(block('position', { target: 'self', mode: 'set', source: 'signalX' })); home.to(block('position', { target: 'self', mode: 'set', y: '0.45', z: '8' }));
    });
    add(p, 'sphere', 'Ball', 0, 0.45, { z: 8, w: 0.9, h: 0.9, d: 0.9, color: '#3b6dff', matAsset: ballMat, tags: ['ball'], physics: PH('dynamic', { shape: 'sphere', friction: 0.05, mass: 4, bounce: 0.1 }), behaviors: [ballB] });
    /* ---- the rules: scoring, frames, racking the pins.  state: 0 = aim, 1 = rolling, 3 = pins settling, 2 = game over ---- */
    const rules = K.bhv(p, 'Marble Lanes – frames & scoring', ({ block, gv, ex, lab, start, put, flt, snd }) => {
      gv('frame', 'set', 1, 1); gv('roll', 'set', 1, 1); gv('score', 'set', 0, 0); gv('aim', 'set', 0, 0); gv('power', 'set', 0, 0); gv('state', 'set', 0, 0); gv('charging', 'set', 0, 0); gv('down', 'set', 0, 0); gv('knocked', 'set', 0, 0); gv('phase', 'set', 1, 1);
      lab('hud', 'Frame {frame}/6   Roll {roll}   Score {score}', 'topLeft', 24, '#ffe9c4', 14); lab('help', 'A / D aim · hold Space to charge · release to roll', 'bottom', 15, '#d9c3e8', 10); lab('pow', 'Power {power}%', 'bottomLeft', 18, '#ffe9c4', 40);
      const strike = lab('strike', 'Strike!  +10 bonus', 'topRight', 20, '#ffe9c4', 14), spare = lab('spare', 'Spare!  +5 bonus', 'topRight', 20, '#ffe9c4', 14), first = lab('first', '{down} down', 'topRight', 20, '#ffe9c4', 14), total = lab('total', '{down} more down', 'topRight', 20, '#ffe9c4', 14);
      const overL = lab('over', 'Game over – score {score}.  Click to play again', 'center', 30, '#ffffff', 0);
      const only = (l, src) => { [strike, spare, first, total].forEach((o) => src.to(o, 'pass', o === l ? 'show' : 'hide')); };
      [strike, spare, first, total, overL].forEach((l) => start().to(l, 'out', 'hide'));
      /* racking: clear the old pins, then spawn ten new ones in a triangle at the Rack marker */
      const rack = block('number', { value: 1 }, 'Rack the pins'); rack.to(block('message', { target: 'tag:pin', channel: 'sweepAll', payload: '' }));
      [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]].forEach((r, i) => r.forEach((dx) => rack.to(block('spawn', { template: 'Pin', count: 1, at: 'Rack', offsetX: +(dx * 0.62).toFixed(2), offsetY: 0, offsetZ: +(-i * 0.62).toFixed(2) }))));
      /* ready for the next roll */
      const ready = block('number', { value: 1 }, 'Ready'); ready.to(block('message', { target: 'Ball', channel: 'home', payload: '' })); ready.to(put('state', 'set', 0));
      rack.to(ready); start().to(rack);
      /* after a frame: next frame or game over */
      const next = block('number', { value: 1 }, 'Next frame'); const more = next.to(ex('frame > 6', 'Game over?')).to(flt('truthy'));
      more.to(put('state', 'set', 2), 'pass'); more.to(overL, 'pass', 'show'); more.to(snd('strike'), 'pass'); more.to(rack, 'fail');
      const endFrame = block('number', { value: 1 }, 'Frame done'); endFrame.to(put('frame', 'add', 1)); endFrame.to(put('roll', 'set', 1)); endFrame.to(put('knocked', 'set', 0)); endFrame.to(next);
      /* count the fallen pins after the roll */
      const down = block('mailbox', { channel: 'down' }, 'A pin is down'); down.to(put('down', 'add', 1));
      const resolve = block('mailbox', { channel: 'resolve' }, 'Roll settled'); resolve.to(ex('roll', 'Which roll?')).to(gv('phase', 'set')); resolve.to(put('down', 'set', 0)); resolve.to(block('message', { target: 'tag:pin', channel: 'tally', payload: '' }, 'Count the pins'));
      resolve.to(ex('min(10, down)', 'Pins this roll')).to(gv('score', 'add'));
      const isStrike = resolve.to(ex('phase == 1 && down >= 10', 'Strike?')).to(flt('truthy')); only(strike, isStrike); isStrike.to(put('score', 'add', 10), 'pass'); isStrike.to(snd('strike'), 'pass'); isStrike.to(endFrame, 'pass');
      const isOpen = resolve.to(ex('phase == 1 && down < 10', 'Open first roll?')).to(flt('truthy'));
      isOpen.to(ex('down'), 'pass').to(gv('knocked', 'set')); isOpen.to(put('roll', 'set', 2), 'pass'); only(first, isOpen);
      isOpen.to(block('message', { target: 'tag:pin', channel: 'sweepDown', payload: '' }), 'pass'); isOpen.to(ready, 'pass');
      const second = resolve.to(ex('phase == 2', 'Second roll?')).to(flt('truthy'));
      const sp = second.to(ex('down + knocked >= 10', 'Spare?')).to(flt('truthy'), 'out', 'in'); sp.to(put('score', 'add', 5), 'pass'); sp.to(snd('strike'), 'pass'); sp.to(spare, 'pass', 'show'); sp.to(first, 'pass', 'hide'); sp.to(total, 'pass', 'hide'); sp.to(strike, 'pass', 'hide'); sp.to(total, 'fail', 'show'); sp.to(spare, 'fail', 'hide'); sp.to(first, 'fail', 'hide'); sp.to(strike, 'fail', 'hide');
      second.to(endFrame, 'pass');
      block('mouseClick', { phase: 'click' }).to(ex('state == 2', 'Game over?')).to(flt('truthy')).to(block('restartGame', { scope: 'game' }), 'pass');
    });
    K.scene(p, [rules]);
    return p; } });
})();
