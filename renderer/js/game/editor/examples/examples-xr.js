/* Four VR / AR example games for Library → Games. They use the VR and AR blocks, so they run on a headset or phone (WebXR) and fall back to a split-screen / camera view
 * on a computer: VR Toy Toss (grab and throw), VR Orb Garden (gaze only – works with a cardboard viewer), AR Garden (tap to plant, pinch to resize) and AR Tape Measure. */
(function () {
  const K = VX.exKit, PH = K.PH;
  const add = (p, ...a) => K.add(p, '3d', ...a);
  const stat = (e) => PH('static', Object.assign({ friction: 0.5 }, e));
  /** floating 3D text – readable inside a headset, where the screen HUD is not shown */
  const sign = (p, name, text, x, y, z, w, size, color, billboard) => add(p, 'text', name, x, y, { z, w, h: w / 4, color: color || '#ffffff', props: { text, size: size || 40, bold: true, align: 'center', font: '', billboard: !!billboard } });

  /* ---------------------------------------------------------------- 1 · VR Toy Toss */
  VX.gameExamples.push({ id: 'exvr-toss', name: 'VR Toy Toss (VR)', type: 'game3d', desc: 'Virtual reality: grab the balls with the grip button and throw them at the stacked boxes. Left stick walks, A resets. Headset (WebXR) or split-screen on a computer: the mouse is your right hand (click = trigger, E = grip, W A S D = stick).', build() {
    const p = K.proj('VR Toy Toss', '3d', '#141a30'); K.sky(p, 0.9, 0.7); const sc = p.scenes[0]; sc.gravity = { x: 0, y: -9.8, z: 0 }; sc.camera3d = { mode: 'fps', yaw: 0, fov: 75, pos: { x: 0, y: 1.6, z: 2 }, target: { x: 0, y: 1.6, z: -5 } };
    K.synth(p, 'hit', 'noise', 600, 120, 0.25, 0.35); K.synth(p, 'pick', 'triangle', 500, 800, 0.1, 0.25); K.synth(p, 'win', 'square', 523, 1568, 0.8, 0.3);
    const floor = K.mat(p, 'Floor', { color: '#3a4260', roughness: 0.9, pattern: 'checker', color2: '#2c3350' });
    const rules = K.bhv(p, 'VR Toy Toss – rules', ({ block, gv, put, start, snd, key }) => {
      gv('score', 'set', 0, 0);
      block('vrMode', { mode: 'auto', button: true, ipd: 64 }, 'Enter VR button');
      block('vrMove', { style: 'smooth', hand: 'left', speed: 3, turn: 45, floorY: 0, maxJump: 12 }, 'Walk with the left stick');
      const win = block('sensor', { target: 'self', property: 'global:score', op: '>=', value: 9, mode: 'edge' }); win.to(snd('win')); win.to(block('emit', { target: 'self', count: 40, color: '#ffd23f', speed: 4, spread: 360, life: 1, size: 0.15, gravity: 0 }));
      const reset = block('vrController', { hand: 'right', attach: '', pointAt: '', deadzone: 0.15 }, 'Right hand'); reset.to(block('restartGame', { scope: 'scene' }), 'a');
      key('r', 'down').to(block('restartGame', { scope: 'scene' }));
    });
    K.scene(p, [rules]);
    /* hands: the controller keeps a small sphere in the hand, Grab picks up anything tagged "grab", Haptics buzz on pick-up */
    const hand = (side) => K.bhv(p, 'Hand ' + side, ({ block, snd }) => {
      block('vrController', { hand: side, attach: 'self', pointAt: '', deadzone: 0.15 }, side + ' controller');
      const grab = block('vrGrab', { hand: side, objects: 'tag:grab', reach: 0.7, throw: true, throwPower: 1.4 }, 'Grab & throw'); grab.to(snd('pick'), 'grabbed'); grab.to(block('vrHaptic', { hand: side, strength: 0.6, ms: 90 }), 'grabbed');
    });
    add(p, 'sphere', 'Hand right', 0.3, 1.2, { z: 1.4, w: 0.12, h: 0.12, d: 0.12, color: '#ffb84d', tags: ['hand'], behaviors: [hand('right')] });
    add(p, 'sphere', 'Hand left', -0.3, 1.2, { z: 1.4, w: 0.12, h: 0.12, d: 0.12, color: '#6c8cff', tags: ['hand'], behaviors: [hand('left')] });
    add(p, 'cube', 'Floor', 0, -0.25, { z: -4, w: 30, h: 0.5, d: 30, color: '#3a4260', matAsset: floor, physics: stat() });
    add(p, 'cube', 'Table', 0, 0.55, { z: 0.6, w: 2, h: 0.1, d: 0.8, color: '#8b5a2b', physics: stat() }); [[-0.9, -0.2], [0.9, -0.2], [-0.9, 1.4], [0.9, 1.4]].forEach(([x, z], i) => add(p, 'cube', 'Leg ' + i, x, 0.25, { z, w: 0.1, h: 0.5, d: 0.1, color: '#6b4220', physics: stat() }));
    /* the toys */
    const ballHome = [[-0.6, 0.7, 0.6], [-0.2, 0.7, 0.6], [0.2, 0.7, 0.6], [0.6, 0.7, 0.6]];
    ballHome.forEach(([x, y, z], i) => add(p, 'sphere', 'Ball ' + i, x, y, { z, w: 0.14, h: 0.14, d: 0.14, color: ['#ff4d6d', '#ffd23f', '#4cc38a', '#4db8ff'][i], tags: ['grab'], physics: PH('dynamic', { shape: 'sphere', friction: 0.4, mass: 0.3, bounce: 0.5 }), material: { metalness: 0.1, roughness: 0.3 },
      behaviors: [K.bhv(p, 'Ball ' + i + ' – back to the table', ({ block }) => { const f = block('sensor', { target: 'self', property: 'y', op: '<', value: -2, mode: 'edge' }, 'Fell away'); f.to(block('velocity', { target: 'self', mode: 'stop' })); f.to(block('position', { target: 'self', mode: 'set', x: String(x), y: String(y), z: String(z) })); })] }));
    const targetB = K.bhv(p, 'Box – knocked', ({ block, put, snd }) => {
      const hit = block('collision', { with: 'tag:grab', phase: 'enter' }, 'Hit by a ball'); hit.to(snd('hit')); hit.to(put('score', 'add', 1)); hit.to(block('emit', { target: 'self', count: 14, color: '#ffffff', speed: 2.5, spread: 360, life: 0.5, size: 0.06, gravity: 0 })); hit.to(block('destroyer', { target: 'self', delay: 0.15 }));
    });
    let n = 0; for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) add(p, 'cube', 'Box ' + n++, (i - (2 - row) / 2) * 0.62, 0.3 + row * 0.6, { z: -5, w: 0.55, h: 0.55, d: 0.55, color: ['#ff6b6b', '#ffb84d', '#ffd23f'][row], tags: ['box'], physics: PH('dynamic', { shape: 'box', friction: 0.6, mass: 0.4 }), behaviors: [targetB] });
    sign(p, 'Score sign', 'Boxes knocked: {score} / 9', 0, 3, -6, 4, 44, '#ffffff', true); sign(p, 'Help sign', 'Squeeze the grip to pick a ball up · let go to throw · A = reset', 0, 1.15, -1.2, 2.6, 26, '#cfe3ff', true);
    return p; } });

  /* ---------------------------------------------------------------- 2 · VR Orb Garden */
  VX.gameExamples.push({ id: 'exvr-gaze', name: 'VR Orb Garden (VR, no controllers)', type: 'game3d', desc: 'Virtual reality with just your eyes: look at a glowing orb for a moment to pop it. Works in a cardboard viewer on a phone, on a headset, or split-screen on a computer (arrow keys / mouse turn your head).', build() {
    const p = K.proj('VR Orb Garden', '3d', '#05081a'); K.sky(p, 0.3, 0.5); const sc = p.scenes[0]; sc.gravity = { x: 0, y: 0, z: 0 }; sc.camera3d = { mode: 'fps', yaw: 0, fov: 80, pos: { x: 0, y: 1.6, z: 0 }, target: { x: 0, y: 1.6, z: -5 } };
    K.synth(p, 'pop', 'sine', 700, 1400, 0.25, 0.3); K.synth(p, 'near', 'triangle', 300, 360, 0.08, 0.1); K.synth(p, 'win', 'square', 523, 1568, 0.9, 0.3);
    const rules = K.bhv(p, 'VR Orb Garden – rules', ({ block, gv, snd }) => {
      gv('score', 'set', 0, 0); block('vrMode', { mode: 'auto', button: true, ipd: 64 }, 'Enter VR button'); block('vrHead', { attach: '', offsetY: 0 }, 'Head');
      block('sensor', { target: 'self', property: 'global:score', op: '>=', value: 14, mode: 'edge' }).to(snd('win'));
    });
    K.scene(p, [rules]);
    const orb = (i) => K.bhv(p, 'Orb ' + i, ({ block, put, snd, start }) => {
      start().to(block('spin', { target: 'self', mode: 'set', speed: 25 + (i % 4) * 15, axis: 'y' }));
      const gaze = block('vrGaze', { target: 'self', seconds: 1, range: 40 }, 'Looked at for a second');
      gaze.to(snd('near'), 'looking'); gaze.to(block('size', { target: 'self', mode: 'set', w: '1', h: '1', d: '1', duration: 0.25 }, 'Grow while looked at'), 'looking'); gaze.to(block('size', { target: 'self', mode: 'set', w: '0.7', h: '0.7', d: '0.7', duration: 0.25 }, 'Shrink when you look away'), 'lookAway'); const pop = gaze.to(snd('pop'), 'selected'); gaze.to(put('score', 'add', 1), 'selected'); gaze.to(block('emit', { target: 'self', count: 24, color: '#ffffff', speed: 3, spread: 360, life: 0.7, size: 0.08, gravity: 0 }), 'selected'); gaze.to(block('destroyer', { target: 'self', delay: 0.1 }), 'selected');
    });
    const cols = ['#4db8ff', '#ff6bd6', '#ffd23f', '#4cc38a', '#b388ff'];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 * 1.5, r = 4 + (i % 3) * 1.5; add(p, 'sphere', 'Orb ' + i, Math.sin(a) * r, 0.8 + (i % 5) * 0.7, { z: -Math.cos(a) * r, w: 0.7, h: 0.7, d: 0.7, color: cols[i % 5], tags: ['orb'], material: { emissive: cols[i % 5], metalness: 0.2, roughness: 0.2 }, behaviors: [orb(i)] }); }
    const ground = K.mat(p, 'Ground', { color: '#16213e', roughness: 1, pattern: 'checker', color2: '#101a33' });
    add(p, 'cube', 'Ground', 0, -0.25, { z: 0, w: 40, h: 0.5, d: 40, color: '#16213e', matAsset: ground, physics: stat() });
    for (let i = 0; i < 40; i++) add(p, 'sphere', 'Star ' + i, Math.sin(i * 2.4) * 30, 6 + (i * 7) % 12, { z: -Math.cos(i * 2.4) * 30, w: 0.15, h: 0.15, d: 0.15, color: '#ffffff', material: { emissive: '#ffffff' }, tags: ['decor'] });
    sign(p, 'Score sign', 'Orbs popped: {score} / 14', 0, 4.2, -7, 5, 44, '#cfe3ff', true); sign(p, 'Help sign', 'Look at an orb for one second', 0, 2.4, -3, 3, 30, '#ffffff', true);
    return p; } });

  /* ---------------------------------------------------------------- 3 · AR Garden */
  VX.gameExamples.push({ id: 'exar-garden', name: 'AR Garden (AR)', type: 'game3d', desc: 'Augmented reality: point your phone at the floor or a table, tap to plant a flower or a tree, pinch to resize, two fingers to turn. Real AR on supported phones (WebXR); everywhere else the camera is shown behind the game and tilting the phone looks around.', build() {
    const p = K.proj('AR Garden', '3d', '#000000'); K.sky(p, 0.9, 0.9); const sc = p.scenes[0]; sc.gravity = { x: 0, y: 0, z: 0 }; sc.camera3d = { mode: 'fps', yaw: 0, fov: 65, pos: { x: 0, y: 1.4, z: 0 }, target: { x: 0, y: 1.0, z: -2 } };
    K.synth(p, 'plant', 'triangle', 330, 660, 0.18, 0.3);
    const rules = K.bhv(p, 'AR Garden – rules', ({ block, gv, snd, key }) => {
      gv('planted', 'set', 0, 0); block('arMode', { mode: 'auto', facing: 'environment', button: true }, 'Start AR button'); block('arLight', { facing: 'environment', strength: 1, dark: 0.25, bright: 1.3, smooth: 0.9 }, 'Match the room light'); block('arShadowFloor', { floorY: -1.2, size: 40, opacity: 0.35 }, 'Shadows on the floor'); block('arSurface', { floorY: -1.2, reticle: true, color: '#ffffff' }, 'Find the floor');
      const place = block('arPlace', { how: 'spawn', object: 'Flower', scale: 1, face: true, lift: 0, tap: true }, 'Tap: plant a flower'); place.to(snd('plant'), 'placed'); place.to(block('globalVariable', { name: 'planted', op: 'add', amount: 1, initial: 0 }), 'placed');
      const tree = block('arPlace', { how: 'spawn', object: 'Tree', scale: 1, face: false, lift: 0, tap: false }, 'T: plant a tree'); key('t', 'down').to(tree, 'out', 'place'); tree.to(snd('plant'), 'placed');
    });
    K.scene(p, [rules]);
    add(p, 'sphere', 'Flower', 0, -50, { z: 0, w: 0.22, h: 0.22, d: 0.22, color: '#ff6bd6', prefab: true, tags: ['plant'], material: { emissive: '#aa2288', roughness: 0.4 }, behaviors: [K.bhv(p, 'Flower – pinch & turn', ({ block }) => { block('arScale', { target: 'self', min: 0.4, max: 4, rotate: true }, 'Pinch & turn'); })] });
    add(p, 'cone', 'Tree', 0, -50, { z: 0, w: 0.35, h: 0.7, d: 0.35, color: '#3f9b52', prefab: true, tags: ['plant'], behaviors: [K.bhv(p, 'Tree – pinch & turn', ({ block }) => { block('arScale', { target: 'self', min: 0.4, max: 3, rotate: true }, 'Pinch & turn'); })] });
    sign(p, 'Count sign', 'Planted: {planted}', 0, 0.6, -2, 1.6, 40, '#ffffff', true);
    return p; } });

  /* ---------------------------------------------------------------- 4 · AR Tape Measure */
  VX.gameExamples.push({ id: 'exar-measure', name: 'AR Tape Measure (AR)', type: 'game3d', desc: 'Augmented reality: tap to drop a marker on the floor, walk to it and see the real distance. Works with real AR (WebXR) or with the camera fallback (then distances are relative to the phone\'s start position).', build() {
    const p = K.proj('AR Tape Measure', '3d', '#000000'); K.sky(p, 0.9, 0.9); const sc = p.scenes[0]; sc.gravity = { x: 0, y: 0, z: 0 }; sc.camera3d = { mode: 'fps', yaw: 0, fov: 65, pos: { x: 0, y: 1.4, z: 0 }, target: { x: 0, y: 1.0, z: -2 } };
    K.synth(p, 'tick', 'square', 880, 880, 0.05, 0.2); K.synth(p, 'near', 'triangle', 392, 784, 0.3, 0.3);
    const rules = K.bhv(p, 'AR Tape Measure – rules', ({ block, gv, snd }) => {
      gv('dist', 'set', 0, 0); block('arMode', { mode: 'auto', facing: 'environment', button: true }, 'Start AR button'); block('arSurface', { floorY: -1.2, reticle: true, color: '#4db8ff' }, 'Find the floor');
      const place = block('arPlace', { how: 'move', object: 'Marker', scale: 1, face: false, lift: 0, tap: true }, 'Tap: drop the marker'); place.to(snd('tick'), 'placed');
    });
    K.scene(p, [rules]);
    add(p, 'cylinder', 'Marker', 0, -0.95, { z: -2, w: 0.12, h: 0.5, d: 0.12, color: '#ff4d6d', material: { emissive: '#ff4d6d' }, tags: ['marker'], behaviors: [K.bhv(p, 'Marker – distance', ({ block, snd, start }) => {
      start().to(block('spin', { target: 'self', mode: 'set', speed: 90, axis: 'y' }));
      const d = block('arDistance', { from: 'camera', to: 'self', limit: 0.6, variable: 'dist' }, 'How far is it?'); d.to(snd('near'), 'near');
    })] });
    add(p, 'text', 'Distance sign', 0, 0.9, { z: -2, w: 2.4, h: 0.6, color: '#ffffff', props: { text: 'Distance: {dist}', size: 44, bold: true, align: 'center', font: '', billboard: true } });
    sign(p, 'Help sign', 'Point at the floor, tap to drop the marker', 0, 0.35, -2, 2.4, 30, '#cfe3ff', true);
    return p; } });
})();
