/* Five 2D example games for Library → Games. Each one is a small project whose rules are a script (see Docs → Scripting API) mixed with blocks
 * (labels, bars, sound detector …), physics bodies, prefabs and synth sounds – open one and read it to learn. */
(function () {
  const K = VX.exKit, PH = K.PH;
  const add = (p, ...a) => K.add(p, '2d', ...a);

  /* ---------------------------------------------------------------- 1 · Neon Breakout (physics, prefabs, power-ups) */
  VX.gameExamples.push({ id: 'ex2d-breakout', name: 'Neon Breakout (2D)', type: 'game2d', desc: 'Bounce the ball, smash the neon bricks, catch the power-ups. Mouse or arrows, click / Space to launch.', build() {
    const p = K.proj('Neon Breakout', '2d', '#0a0620'); p.scenes[0].gravity = { x: 0, y: 0, z: 0 };
    K.synth(p, 'brick', 'square', 520, 880, 0.12, 0.3); K.synth(p, 'paddle', 'triangle', 220, 330, 0.1, 0.35); K.synth(p, 'lose', 'saw', 400, 60, 0.5, 0.35); K.synth(p, 'power', 'square', 440, 1320, 0.3, 0.3); K.synth(p, 'win', 'square', 523, 1046, 0.7, 0.3);
    /* ---- behaviours: every rule below is a graph of blocks (open the Logic tab) ---- */
    const rules = K.bhv(p, 'Breakout – rules & HUD', ({ block, gv, ex, lab, start, put }) => {
      /* variables: state 0 = ready, 1 = playing, 2 = game over, 3 = won */
      gv('score', 'set', 0, 0); gv('lives', 'set', 0, 3); gv('bricks', 'set', 0, 84); gv('state', 'set', 0, 0); gv('px', 'set', 0, 480);
      lab('hud', 'Score {score}      Lives {lives}      Bricks {bricks}', 'topLeft', 22, '#9fe8ff');
      const ready = lab('ready', 'Click or press Space to launch', 'center', 30, '#ffffff', 40), over = lab('over', 'Game over – click to try again', 'center', 30, '#ff7b9c', 0), won = lab('won', 'You cleared the wall!  Click to play again', 'center', 30, '#5cff9d', 0);
      start().to(over, 'out', 'hide'); start().to(won, 'out', 'hide');
      const when = (v) => block('sensor', { target: 'self', property: 'global:state', op: '==', value: v, mode: 'edge' });
      when(0).to(ready, 'out', 'show'); when(1).to(ready, 'out', 'hide'); when(2).to(over, 'out', 'show'); when(3).to(won, 'out', 'show');
      block('mouseClick', { phase: 'click' }).to(ex('state >= 2', 'Game finished?')).to(block('filter', { op: 'truthy' })).to(block('restartGame', { scope: 'game' }), 'pass');
    });
    const paddleB = K.bhv(p, 'Paddle – mouse & keys', ({ block, gv, ex, key, put }) => {
      block('mouseMove', {}).to(ex('clamp(a, 60, 900)', 'Keep inside the walls'), 'x').to(block('position', { target: 'self', mode: 'set', y: '500', source: 'signalX' }));
      key('arrowleft', 'held').to(ex('a * -560', 'Move left')).to(block('position', { target: 'self', mode: 'add', source: 'signalX' }));
      key('arrowright', 'held').to(ex('a * 560', 'Move right')).to(block('position', { target: 'self', mode: 'add', source: 'signalX' }));
      key('a', 'held').to(ex('a * -560')).to(block('position', { target: 'self', mode: 'add', source: 'signalX' }));
      key('d', 'held').to(ex('a * 560')).to(block('position', { target: 'self', mode: 'add', source: 'signalX' }));
      block('always', {}).to(block('extractor', { target: 'self', property: 'x' })).to(gv('px', 'set'));
    });
    const ballB = K.bhv(p, 'Ball – launch, bounce & lives', ({ block, gv, ex, key, snd, put }) => {
      /* launch */
      const chk = ex('state == 0', 'Ready to launch?'), go = chk.to(block('filter', { op: 'truthy' }));
      block('mouseClick', { phase: 'click' }).to(chk); key('space').to(chk);
      go.to(put('state', 'set', 1), 'pass'); go.to(block('random', { mode: 'number', min: -140, max: 140 }), 'pass').to(block('velocity', { target: 'self', mode: 'set', source: 'signalX', y: '-380' }));
      /* before launch the ball rides on the paddle */
      block('always', {}).to(ex('state == 0', 'Waiting on paddle?')).to(block('filter', { op: 'truthy' })).to(ex('px', 'Paddle x'), 'pass').to(block('position', { target: 'self', mode: 'set', y: '470', source: 'signalX' })).to(block('velocity', { target: 'self', mode: 'stop' }));
      /* paddle bounce changes the angle with where it hit */
      const hit = block('collision', { with: 'Paddle', phase: 'enter' }); hit.to(ex('(self.x - px) / 60 * 340', 'Angle from hit position')).to(block('velocity', { target: 'self', mode: 'set', source: 'signalX' })); hit.to(snd('paddle'));
      /* keep the ball from going too flat */
      block('sensor', { target: 'self', property: 'vy', op: '>', value: -90, mode: 'edge' }).to(block('filter', { op: 'truthy' })).to(ex('state == 1')).to(block('filter', { op: 'truthy' })).to(block('velocity', { target: 'self', mode: 'set', y: '-200' }), 'pass');
      /* falling out of the bottom costs a life */
      const lost = block('sensor', { target: 'self', property: 'y', op: '>', value: 570, mode: 'edge' }), empty = lost.to(put('lives', 'subtract', 1)).to(ex('a <= 0', 'Out of lives?')).to(block('filter', { op: 'truthy' }));
      empty.to(put('state', 'set', 2), 'pass'); empty.to(put('state', 'set', 0), 'fail'); lost.to(snd('lose'));
    });
    const brickB = K.bhv(p, 'Brick – break & drop power-ups', ({ block, gv, ex, snd, put }) => {
      const hit = block('collision', { with: 'Ball', phase: 'enter' });
      hit.to(block('destroyer', { target: 'self', burst: true, color: '#ff3df2' })); hit.to(put('score', 'add', 10)); hit.to(snd('brick'));
      hit.to(put('bricks', 'subtract', 1)).to(ex('a <= 0', 'Wall cleared?'), 'changed').to(block('filter', { op: 'truthy' })).to(put('state', 'set', 3), 'pass');
      hit.to(block('random', { mode: 'chance', chance: 0.14 })).to(block('spawn', { template: 'Pill', at: 'self', speed: 160, dir: 'down' }), 'yes');
    });
    const pillB = K.bhv(p, 'Pill – widen the paddle', ({ block, gv, snd, put }) => {
      const near = block('proximity', { target: 'Paddle', radius: 62, mode: 'enter' }); const wide = block('size', { target: 'Paddle', mode: 'set', w: '180' }), timer = block('timer', { interval: 9, repeat: false, autoStart: false });
      near.to(wide); near.to(put('score', 'add', 50)); near.to(snd('power')); near.to(block('destroyer', { target: 'self' })); near.to(timer, 'out', 'start');
      timer.to(block('size', { target: 'Paddle', mode: 'set', w: '120' }), 'tick');
      block('sensor', { target: 'self', property: 'y', op: '>', value: 560, mode: 'edge' }).to(block('destroyer', { target: 'self' }));
    });
    K.scene(p, [rules]);
    const wall = (n, x, y, w, h) => add(p, 'rect', n, x, y, { w, h, color: '#241a55', physics: PH('static', { bounce: 1, friction: 0 }) });
    wall('Top', 480, -10, 980, 20); wall('Left', -10, 270, 20, 560); wall('Right', 970, 270, 20, 560);
    add(p, 'rect', 'Paddle', 480, 500, { w: 120, h: 16, color: '#00e5ff', physics: PH('kinematic', { bounce: 1, friction: 0 }), behaviors: [paddleB] });
    add(p, 'rect', 'Pill', -500, -500, { w: 30, h: 14, color: '#fff35c', prefab: true, tags: ['pill'], physics: PH('kinematic', { sensor: true }), behaviors: [pillB] });
    const colors = ['#ff3df2', '#ff6b6b', '#ffb84d', '#fff35c', '#5cff9d', '#4dd2ff', '#8c7bff'];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 12; c++) add(p, 'rect', 'Brick ' + (r * 12 + c + 1), 90 + c * 71, 70 + r * 30, { w: 68, h: 24, color: colors[r], tags: ['brick'], physics: PH('static', { bounce: 1, friction: 0 }), behaviors: [brickB] });
    add(p, 'ellipse', 'Ball', 480, 470, { w: 16, h: 16, color: '#ffffff', physics: PH('dynamic', { shape: 'circle', bounce: 1, friction: 0, gravityScale: 0, fixedRotation: true }), behaviors: [ballB] });
    K.touch(p, {});
    return p; } });

  /* ---------------------------------------------------------------- 2 · Void Swarm (top-down shooter, waves, bar block) */
  VX.gameExamples.push({ id: 'ex2d-swarm', name: 'Void Swarm (2D)', type: 'game2d', desc: 'Top-down arena shooter: WASD to move, mouse to aim and shoot, survive the waves. Health bar, particles, screen shake.', build() {
    const p = K.proj('Void Swarm', '2d', '#050a18'); p.scenes[0].gravity = { x: 0, y: 0, z: 0 };
    K.synth(p, 'shot', 'square', 900, 300, 0.1, 0.18); K.synth(p, 'boom', 'noise', 900, 80, 0.3, 0.35); K.synth(p, 'hurt', 'saw', 300, 90, 0.3, 0.4); K.synth(p, 'wave', 'triangle', 330, 990, 0.5, 0.3);
    /* variables: state 0 = fighting, 1 = overrun.  toSpawn = drones still to arrive this wave, alive = drones on the field */
    const rules = K.bhv(p, 'Swarm – waves, HUD & game over', ({ block, gv, ex, lab, start, snd, flt, put }) => {
      gv('score', 'set', 0, 0); gv('hp', 'set', 0, 100); gv('wave', 'set', 0, 0); gv('state', 'set', 0, 0); gv('toSpawn', 'set', 0, 0); gv('alive', 'set', 0, 0);
      lab('hud', 'Score {score}     Wave {wave}', 'topLeft', 22, '#9fe8ff'); lab('help', 'WASD move · mouse aim · click / hold to shoot', 'bottom', 15, '#7c8db5', 10);
      block('bar', { id: 'hp', variable: 'hp', max: 100, anchor: 'topRight', x: 16, y: 14, w: 220, h: 18, color: '#ff4d6d' });
      const dead = lab('dead', 'Overrun on wave {wave} – score {score}\nClick to try again', 'center', 30, '#ff7b9c', 0); start().to(dead, 'out', 'hide');
      /* a new wave starts when everything is spawned and destroyed */
      const next = block('always', {}).to(ex('toSpawn <= 0 && alive <= 0 && state == 0', 'Wave cleared?')).to(flt('truthy'));
      const w = next.to(put('wave', 'add', 1), 'pass'); w.to(ex('4 + a * 3', 'Drones this wave')).to(gv('toSpawn', 'set')); w.to(block('alert', { mode: 'toast', kind: 'info', message: 'Wave {value}', duration: 1.4, pause: false })); w.to(snd('wave'));
      next.to(ex('min(100, hp + 15)', 'Heal a little'), 'pass').to(gv('hp', 'set'));
      /* spawn drones at random screen edges */
      const tick = block('timer', { interval: 0.5, repeat: true }), more = tick.to(ex('toSpawn > 0 && state == 0', 'More to spawn?'), 'tick').to(flt('truthy')), edge = more.to(block('router', { outputs: 4, mode: 'random' }), 'pass');
      more.to(put('toSpawn', 'subtract', 1), 'pass'); more.to(put('alive', 'add', 1), 'pass');
      ['Edge W', 'Edge E', 'Edge N', 'Edge S'].forEach((name, i) => edge.to(block('spawn', { template: 'Drone', at: name, randomX: i > 1 ? 480 : 0, randomY: i > 1 ? 0 : 270 }), 'o' + i));
      /* game over */
      const over = block('sensor', { target: 'self', property: 'global:hp', op: '<=', value: 0, mode: 'edge' });
      over.to(put('state', 'set', 1)); over.to(dead, 'out', 'show'); over.to(block('destroyer', { target: 'Player', burst: true, color: '#4dd2ff' }));
      block('mouseClick', { phase: 'click' }).to(ex('state == 1', 'Overrun?')).to(flt('truthy')).to(block('restartGame', { scope: 'game' }), 'pass');
    });
    const playerB = K.bhv(p, 'Player – move, aim & shoot', ({ block, ex, snd, put }) => {
      for (const [k, expr, prop] of [['d', 'a * 260', 'x'], ['right', 'a * 260', 'x'], ['a', 'a * -260', 'x'], ['left', 'a * -260', 'x'], ['s', 'a * 260', 'y'], ['down', 'a * 260', 'y'], ['w', 'a * -260', 'y'], ['up', 'a * -260', 'y']])
        block('keyboard', { key: k, mode: 'held' }).to(ex(expr)).to(block('position', { target: 'self', mode: 'add', source: prop === 'x' ? 'signalX' : 'signalY' }));
      block('always', {}).to(ex('clamp(self.x, 16, 944)', 'Stay in the arena')).to(block('position', { target: 'self', mode: 'set', source: 'signalX' }));
      block('always', {}).to(ex('clamp(self.y, 16, 524)')).to(block('position', { target: 'self', mode: 'set', source: 'signalY' }));
      block('pointAt', { target: 'self', at: 'mouse', speed: 0, offset: 0, autoStart: true });
      /* hold the mouse to keep firing */
      const fire = block('spawn', { template: 'Bullet', at: 'self', speed: 640, dir: 'forward', lifetime: 1.2 }), timer = block('timer', { interval: 0.16, repeat: true, autoStart: false });
      const down = block('mouseClick', { phase: 'down' }); down.to(fire); down.to(timer, 'out', 'start'); down.to(snd('shot')); block('mouseClick', { phase: 'up' }).to(timer, 'out', 'stop');
      timer.to(fire, 'tick'); timer.to(snd('shot'), 'tick');
    });
    const bulletB = K.bhv(p, 'Bullet – hit a drone', ({ block, gv, ex, flt, snd, put }) => {
      const hit = block('proximity', { target: 'tag:enemy', radius: 20, mode: 'enter' }), hp = hit.to(block('objectVariable', { target: 'other', name: 'hp', op: 'subtract', amount: 1, initial: 2 }), 'out');
      hit.to(block('emit', { target: 'self', count: 5, color: '#fff35c', speed: 220, life: 0.4, size: 5 })); hit.to(block('destroyer', { target: 'self' }));
      const dead = hp.to(ex('a <= 0', 'Drone destroyed?')).to(flt('truthy'));
      dead.to(block('destroyer', { target: 'other', burst: true, color: '#ff4d6d' }), 'pass'); dead.to(put('score', 'add', 10), 'pass'); dead.to(put('alive', 'subtract', 1), 'pass'); dead.to(snd('boom'), 'pass');
    });
    const droneB = K.bhv(p, 'Drone – chase the player', ({ block, gv, ex, snd, put }) => {
      block('objectVariable', { target: 'self', name: 'hp', op: 'set', amount: 0, initial: 2 });
      block('pointAt', { target: 'self', at: 'Player', speed: 0, offset: 0, autoStart: true });
      block('always', {}).to(ex('min(230, 70 + wave * 14)', 'Faster every wave')).to(block('pushMotor', { target: 'self', force: 1, direction: 'forward', mode: 'speed', useSignal: true }), 'out', 'in');
      const ram = block('proximity', { target: 'Player', radius: 26, mode: 'enter' });
      ram.to(put('hp', 'subtract', 12)); ram.to(put('alive', 'subtract', 1)); ram.to(snd('hurt')); ram.to(block('camera', { action: 'shake', value: 6 })); ram.to(block('destroyer', { target: 'self', burst: true, color: '#ff4d6d' }));
    });
    K.scene(p, [rules]);
    for (let i = 0; i < 40; i++) add(p, 'ellipse', 'Star ' + i, Math.round(Math.random() * 960), Math.round(Math.random() * 540), { w: 2 + (i % 3), h: 2 + (i % 3), color: '#2b3b6b', alpha: 0.9 });
    for (const [n, x, y] of [['Edge W', -20, 270], ['Edge E', 980, 270], ['Edge N', 480, -20], ['Edge S', 480, 560]]) add(p, 'empty', n, x, y, {});
    add(p, 'ellipse', 'Drone', -500, -500, { w: 28, h: 28, color: '#ff4d6d', prefab: true, tags: ['enemy'], physics: PH('kinematic', { sensor: true }), behaviors: [droneB] });
    add(p, 'ellipse', 'Bullet', -500, -500, { w: 9, h: 9, color: '#fff35c', prefab: true, tags: ['bullet'], physics: PH('kinematic', { sensor: true }), behaviors: [bulletB] });
    add(p, 'rect', 'Player', 480, 270, { w: 38, h: 20, color: '#4dd2ff', tags: ['player'], physics: PH('kinematic', { sensor: true }), behaviors: [playerB] });
    K.touch(p, {});
    return p; } });

  /* ---------------------------------------------------------------- 3 · Sling Tower (physics sandbox, drag to launch) */
  VX.gameExamples.push({ id: 'ex2d-sling', name: 'Sling Tower (2D)', type: 'game2d', desc: 'Drag back and release to fling boulders and topple the towers. Dynamic physics, five shots per level, three levels.', build() {
    const p = K.proj('Sling Tower', '2d', '#2b6cb0');
    K.synth(p, 'fling', 'triangle', 200, 700, 0.25, 0.4); K.synth(p, 'crash', 'noise', 700, 70, 0.35, 0.4); K.synth(p, 'win', 'square', 392, 1568, 0.8, 0.3);
    /* variables: state 0 = aim, 1 = boulder flying, 2 = level cleared, 3 = out of boulders.  drag 1 while you pull the sling back */
    const ORIGIN = '150', ORIGIN_Y = '420';
    const ammoB = K.bhv(p, 'Boulder – sling, aim & launch', ({ block, gv, ex, put, flt, snd }) => {
      gv('state', 'set', 0, 0); gv('drag', 'set', 0, 0); gv('pull', 'set', 0, 0); gv('shots', 'set', 0, 5); gv('targets', 'set', 0, 1);
      /* waiting in the sling */
      block('always', {}).to(ex('state == 0', 'Waiting in the sling?')).to(flt('truthy')).to(block('position', { target: 'self', mode: 'set', x: ORIGIN, y: ORIGIN_Y }), 'pass').to(block('velocity', { target: 'self', mode: 'stop' }));
      /* start pulling back */
      block('mouseClick', { phase: 'down' }).to(ex('state == 0 && shots > 0', 'Can aim?')).to(flt('truthy')).to(put('drag', 'set', 1), 'pass').to(block('enabled', { target: 'Aim', state: 'enable' }));
      /* the aim line points where the boulder will go and the bar shows how hard you pull */
      const mv = block('mouseMove', { when: 'pressed' }), line = (expr, label) => { const e = ex(expr, label, 'in'); mv.to(e, 'x', 'a'); mv.to(e, 'y', 'b'); mv.to(e, 'out', 'in'); return e; };
      line('150 + (150 - a) / max(1, hypot(150 - a, 420 - b)) * 45', 'Aim line x').to(block('position', { target: 'Aim', mode: 'set', source: 'signalX' }));
      line('420 + (420 - b) / max(1, hypot(150 - a, 420 - b)) * 45', 'Aim line y').to(block('position', { target: 'Aim', mode: 'set', source: 'signalY' }));
      line('deg(atan2(420 - b, 150 - a))', 'Aim angle').to(block('rotation', { target: 'Aim', mode: 'set', source: 'signal' }));
      line('drag == 1 ? min(120, hypot(150 - a, 420 - b)) : 0', 'Pull length').to(gv('pull', 'set'));
      /* release = launch */
      const up = block('mouseClick', { phase: 'up' }), mk = (expr, label) => { const e = ex(expr, label, 'in'); up.to(e, 'x', 'a'); up.to(e, 'y', 'b'); return e; };
      const guard = mk('drag == 1 && hypot(150 - a, 420 - b) > 12', 'Pulled far enough?'), vx = mk('(150 - a) * min(120, hypot(150 - a, 420 - b)) / max(1, hypot(150 - a, 420 - b)) * 7.2', 'Launch speed x'), vy = mk('(420 - b) * min(120, hypot(150 - a, 420 - b)) / max(1, hypot(150 - a, 420 - b)) * 7.2', 'Launch speed y');
      const fire = up.to(guard, 'out', 'in').to(flt('truthy')); const settle = block('timer', { interval: 0.5, repeat: true, autoStart: false });
      fire.to(put('state', 'set', 1), 'pass'); fire.to(vx, 'pass', 'in'); fire.to(vy, 'pass', 'in'); fire.to(put('shots', 'subtract', 1), 'pass'); fire.to(snd('fling'), 'pass'); fire.to(settle, 'pass', 'reset'); fire.to(settle, 'pass', 'start');
      vx.to(block('velocity', { target: 'self', mode: 'set', source: 'signalX' })); vy.to(block('velocity', { target: 'self', mode: 'set', source: 'signalY' }));
      up.to(put('drag', 'set', 0)); up.to(put('pull', 'set', 0)); up.to(block('enabled', { target: 'Aim', state: 'disable' }));
      /* when the boulder has stopped (or left the world) it is the next turn – or the end */
      const done = settle.to(ex('state == 1 && (self.speed < 25 || self.y > 600 || self.x > 1100)', 'Boulder finished?'), 'tick').to(flt('truthy'));
      done.to(put('state', 'set', 0), 'pass').to(ex('shots <= 0 && targets > 0', 'Out of boulders?')).to(flt('truthy')).to(put('state', 'set', 3), 'pass');
    });
    const targetB = K.bhv(p, 'Target – knock it over', ({ block, ex, put, flt, snd }) => {
      const gate = flt('once');
      block('collision', { with: 'Boulder', phase: 'enter' }).to(gate); block('sensor', { target: 'self', property: 'vy', op: '>', value: 450, mode: 'edge' }).to(gate); block('sensor', { target: 'self', property: 'y', op: '>', value: 600, mode: 'edge' }).to(gate);
      const kill = gate.to(block('destroyer', { target: 'self', burst: true, color: '#e5484d' }), 'pass'); gate.to(snd('crash'), 'pass');
      gate.to(put('targets', 'subtract', 1), 'pass').to(ex('a <= 0', 'All targets down?'), 'changed').to(flt('truthy')).to(put('state', 'set', 2), 'pass');
    });
    /* each level is its own scene with its own rules (how many boulders / targets) */
    const rulesFor = (n, shots, targets, last) => K.bhv(p, 'Level ' + n + ' – rules & HUD', ({ block, ex, lab, start, put, flt, snd }) => {
      lab('hud', 'Level ' + n + ' of 3     Boulders {shots}     Targets {targets}', 'topLeft', 22, '#ffffff'); lab('help', 'Drag back from the sling and release to fling', 'bottom', 15, '#e2e8f0', 10);
      block('bar', { id: 'pull', variable: 'pull', max: 120, anchor: 'bottomLeft', x: 16, y: 16, w: 200, h: 14, color: '#fff35c' });
      const won = lab('won', last ? 'All towers down – you win!  Click to play again' : 'Level cleared!  Click for the next one', 'center', 32, '#ffffff', 0), lost = lab('lost', 'Out of boulders – click to retry', 'center', 32, '#ffd7d7', 0);
      start().to(won, 'out', 'hide'); start().to(lost, 'out', 'hide'); start().to(put('shots', 'set', shots)); start().to(put('targets', 'set', targets)); start().to(put('state', 'set', 0)); start().to(put('drag', 'set', 0));
      const when = (v) => block('sensor', { target: 'self', property: 'global:state', op: '==', value: v, mode: 'edge' });
      const w = when(2); w.to(won, 'out', 'show'); w.to(snd('win')); when(3).to(lost, 'out', 'show');
      const click = block('mouseClick', { phase: 'click' });
      const goOn = click.to(ex('state == 2', 'Level cleared?')).to(flt('truthy')); goOn.to(put('state', 'set', 0), 'pass').to(last ? block('restartGame', { scope: 'game' }) : block('loadLevel', { level: 'next' }));
      click.to(ex('state == 3', 'Out of boulders?')).to(flt('truthy')).to(put('state', 'set', 0), 'pass').to(block('restartGame', { scope: 'scene' }));
    });
    const LEVELS = [
      { shots: 5, targets: 2, build(blk, tgt) { for (let i = 0; i < 4; i++) blk(700, 478 - i * 41); tgt(700, 478 - 4 * 41); blk(790, 478); tgt(790, 440); } },
      { shots: 5, targets: 3, build(blk, tgt) { for (const x of [640, 760]) for (let i = 0; i < 3; i++) blk(x, 478 - i * 41); for (let j = 0; j < 3; j++) blk(580 + j * 82 + 40, 478 - 3 * 41); tgt(700, 478 - 4 * 41); tgt(700, 478); tgt(850, 490); } },
      { shots: 6, targets: 3, build(blk, tgt) { for (let r = 0; r < 5; r++) for (let c = 0; c < 5 - r; c++) blk(640 + c * 42 + r * 21, 478 - r * 41); tgt(700, 478 - 5 * 41); tgt(860, 490); tgt(560, 490); } },
    ];
    LEVELS.forEach((lv, i) => {
      if (i) K.newScene(p, 'Level ' + (i + 1), '#2b6cb0'); else p.scenes[0].name = 'Level 1'; p.scenes[0].gravity = { x: 0, y: 980, z: 0 };
      K.scene(p, [rulesFor(i + 1, lv.shots, lv.targets, i === LEVELS.length - 1)]);
      add(p, 'rect', 'Ground', 480, 520, { w: 1400, h: 60, color: '#3f8f3f', physics: PH('static', { friction: 0.8 }) });
      add(p, 'rect', 'Hill', 150, 470, { w: 130, h: 40, color: '#6b8e23', physics: PH('static') });
      add(p, 'rect', 'Aim', 150, 420, { w: 90, h: 4, color: '#fff35c', visible: false });
      lv.build((x, y) => add(p, 'rect', 'Block', x, y, { w: 40, h: 40, color: '#c68642', tags: ['block'], physics: PH('dynamic', { friction: 0.6, bounce: 0.05, mass: 1 }) }), (x, y) => add(p, 'ellipse', 'Target', x, y, { w: 30, h: 30, color: '#e5484d', tags: ['target'], physics: PH('dynamic', { shape: 'circle', bounce: 0.2, friction: 0.5, mass: 0.6 }), behaviors: [targetB] }));
      add(p, 'ellipse', 'Boulder', 150, 420, { w: 34, h: 34, color: '#555b66', tags: ['boulder'], physics: PH('dynamic', { shape: 'circle', bounce: 0.3, friction: 0.5, mass: 3 }), behaviors: [ammoB] });
    });
    p.cur = 0;
    K.touch(p, {});
    return p; } });

  /* ---------------------------------------------------------------- 4 · Sky Hopper (kinematic pipes, dynamic bird, parallax, high score) */
  VX.gameExamples.push({ id: 'ex2d-hopper', name: 'Sky Hopper (2D)', type: 'game2d', desc: 'Tap Space / click to flap through the gaps. Kinematic moving pipes, parallax hills, saved high score.', build() {
    const p = K.proj('Sky Hopper', '2d', '#7fd6ff'); p.scenes[0].gravity = { x: 0, y: 1500, z: 0 };
    K.synth(p, 'flap', 'triangle', 300, 600, 0.12, 0.3); K.synth(p, 'point', 'square', 880, 1320, 0.12, 0.25); K.synth(p, 'hit', 'noise', 600, 60, 0.35, 0.4);
    /* variables: state 0 = ready, 1 = flying, 2 = crashed */
    const rules = K.bhv(p, 'Hopper – rules, HUD & pipe spawner', ({ block, gv, ex, lab, start, put, flt }) => {
      gv('score', 'set', 0, 0); gv('state', 'set', 0, 0); gv('best', 'set', 0, 0);
      lab('hud', '{score}', 'top', 54, '#ffffff', 14); lab('bestlbl', 'Best {best}', 'topLeft', 18, '#1b3a57', 14);
      const ready = lab('ready', 'Press Space or click to start', 'center', 28, '#ffffff', 0), over = lab('over', 'Score {score} – click to try again', 'center', 28, '#ffffff', 0);
      start().to(put('state', 'set', 0)); start().to(put('score', 'set', 0)); start().to(block('saveValue', { key: 'hopper-best', action: 'load', default: '0' })).to(gv('best', 'set'));
      const when = (v) => block('sensor', { target: 'self', property: 'global:state', op: '==', value: v, mode: 'edge' });
      const s0 = when(0); s0.to(ready, 'out', 'show'); s0.to(over, 'out', 'hide'); when(1).to(ready, 'out', 'hide'); when(2).to(over, 'out', 'show');
      /* pipes: a gap marker appears at a random height, then it builds the pipes around itself */
      const timer = block('timer', { interval: 1.45, repeat: true, autoStart: false });
      when(1).to(timer, 'out', 'start');
      timer.to(ex('state == 1', 'Still flying?'), 'tick').to(flt('truthy')).to(block('spawn', { template: 'Gap', at: 'Pipe spawn', randomY: 115, speed: 210, dir: 'left' }), 'pass');
      block('mouseClick', { phase: 'click' }).to(ex('state == 2', 'Crashed?')).to(flt('truthy')).to(block('restartGame', { scope: 'scene' }), 'pass');
    });
    const birdB = K.bhv(p, 'Bird – flap, crash & score', ({ block, gv, ex, put, flt, snd }) => {
      /* flap (the first flap starts the game) */
      const can = ex('state < 2', 'Can flap?'), ok = can.to(flt('truthy'));
      block('mouseClick', { phase: 'click' }).to(can); block('keyboard', { key: 'space' }).to(can); block('keyboard', { key: 'up' }).to(can);
      ok.to(put('state', 'set', 1), 'pass'); ok.to(block('physics', { target: 'self', body: 'dynamic', shape: 'circle', bounce: 0, friction: 0, gravityScale: 1, applyOnStart: false }), 'pass'); ok.to(block('velocity', { target: 'self', mode: 'set', y: '-470' }), 'pass'); ok.to(snd('flap'), 'pass');
      /* before the first flap the bird hovers */
      block('ease', { curve: 'sineInOut', from: 242, to: 258, duration: 0.6, loop: 'pingpong', autoStart: true }).to(ex('state == 0 ? a : self.y', 'Hover while waiting')).to(block('position', { target: 'self', mode: 'set', source: 'signalY' }));
      /* nose up / down with the speed */
      block('always', {}).to(ex('clamp(self.vy * 0.1, -25, 70)', 'Tilt')).to(block('rotation', { target: 'self', mode: 'set', source: 'signal' }));
      /* crash */
      const crash = ex('state == 1', 'Flying?'), dead = crash.to(flt('truthy'));
      block('collision', { with: 'tag:pipe', phase: 'enter' }).to(crash); block('collision', { with: 'tag:ground', phase: 'enter' }).to(crash); block('sensor', { target: 'self', property: 'y', op: '<', value: -20, mode: 'edge' }).to(crash);
      dead.to(put('state', 'set', 2), 'pass'); dead.to(snd('hit'), 'pass'); dead.to(block('emit', { target: 'self', count: 24, color: '#ffd23f', speed: 260, life: 0.7, size: 6 }), 'pass');
      const rec = dead.to(ex('score > best ? score : -1', 'New best?'), 'pass'); rec.to(block('filter', { op: '>', value: '-1' })).to(gv('best', 'set')).to(block('saveValue', { key: 'hopper-best', action: 'save' }));
    });
    const gapB = K.bhv(p, 'Gap – build pipes, count score', ({ block, put, snd, flt }) => {
      const s = block('once', { when: 'start' }); s.to(block('spawn', { template: 'Pipe', at: 'self', offsetY: -335, speed: 210, dir: 'left' })); s.to(block('spawn', { template: 'Pipe', at: 'self', offsetY: 335, speed: 210, dir: 'left' }));
      const pass = block('collision', { with: 'Bird', phase: 'enter' }).to(flt('once')); pass.to(put('score', 'add', 1), 'pass'); pass.to(snd('point'), 'pass');
      block('sensor', { target: 'self', property: 'global:state', op: '==', value: 2, mode: 'edge' }).to(block('velocity', { target: 'self', mode: 'stop' }));
      block('sensor', { target: 'self', property: 'x', op: '<', value: -120, mode: 'edge' }).to(block('destroyer', { target: 'self' }));
    });
    const pipeB = K.bhv(p, 'Pipe – scroll & clean up', ({ block }) => {
      block('sensor', { target: 'self', property: 'global:state', op: '==', value: 2, mode: 'edge' }).to(block('velocity', { target: 'self', mode: 'stop' }));
      block('sensor', { target: 'self', property: 'x', op: '<', value: -120, mode: 'edge' }).to(block('destroyer', { target: 'self' }));
    });
    const cloudB = K.bhv(p, 'Cloud – drift', ({ block, ex }) => {
      block('always', {}).to(ex('a * -12', 'Drift left')).to(block('position', { target: 'self', mode: 'add', source: 'signalX' }));
      block('sensor', { target: 'self', property: 'x', op: '<', value: -100, mode: 'edge' }).to(block('position', { target: 'self', mode: 'set', x: '1060' }));
    });
    const hillB = K.bhv(p, 'Hill – parallax scroll', ({ block, ex }) => {
      block('always', {}).to(ex('state == 1 ? a * -40 : 0', 'Scroll while flying')).to(block('position', { target: 'self', mode: 'add', source: 'signalX' }));
      block('sensor', { target: 'self', property: 'x', op: '<', value: -160, mode: 'edge' }).to(block('position', { target: 'self', mode: 'add', x: '1200' }));
    });
    K.scene(p, [rules]);
    for (let i = 0; i < 3; i++) add(p, 'ellipse', 'Cloud ' + i, 200 + i * 340, 70 + (i % 2) * 50, { w: 140, h: 44, color: '#ffffff', alpha: 0.85, tags: ['cloud'], order: -5, behaviors: [cloudB] });
    for (let i = 0; i < 6; i++) add(p, 'triangle', 'Hill ' + i, i * 200, 470, { w: 260, h: 150 + (i % 3) * 30, color: '#5fb86a', tags: ['hill'], order: -3, behaviors: [hillB] });
    add(p, 'rect', 'Ground', 480, 520, { w: 1100, h: 60, color: '#caa45a', physics: PH('static'), tags: ['ground'], order: 5 });
    add(p, 'empty', 'Pipe spawn', 1040, 265, {});
    add(p, 'rect', 'Pipe', -500, -500, { w: 70, h: 500, color: '#3aa545', prefab: true, tags: ['pipe'], physics: PH('kinematic'), order: 2, behaviors: [pipeB] });
    add(p, 'rect', 'Gap', -500, -500, { w: 10, h: 540, color: '#ffffff', alpha: 0, prefab: true, tags: ['gap'], physics: PH('kinematic', { sensor: true }), behaviors: [gapB] });
    add(p, 'ellipse', 'Bird', 220, 250, { w: 34, h: 28, color: '#ffd23f', physics: PH('dynamic', { shape: 'circle', bounce: 0, friction: 0, fixedRotation: true, gravityScale: 0 }), order: 6, behaviors: [birdB] });
    K.touch(p, {});
    return p; } });

  /* ---------------------------------------------------------------- 5 · Echo Pads (memory puzzle with clickable pads and sound) */
  VX.gameExamples.push({ id: 'ex2d-echo', name: 'Echo Pads (2D)', type: 'game2d', desc: 'Watch the pattern, repeat it. Click the pads or press 1-4 / arrow keys. Each pad has its own synth note. Built from blocks (lists, timers, messages).', build() {
    const p = K.proj('Echo Pads', '2d', '#141a2e'); p.scenes[0].gravity = { x: 0, y: 0, z: 0 };
    const cols = ['#ff5d73', '#45d483', '#4da3ff', '#ffd23f'], notes = [261, 329, 392, 523], keys = [['1', 'arrowleft'], ['2', 'arrowup'], ['3', 'arrowdown'], ['4', 'arrowright']];
    cols.forEach((c, i) => K.synth(p, 'n' + i, 'triangle', notes[i], notes[i], 0.35, 0.4));
    K.synth(p, 'bad', 'saw', 200, 60, 0.6, 0.4); K.synth(p, 'good', 'square', 523, 1046, 0.4, 0.3);
    /* state: 0 = ready, 1 = watching the pattern, 2 = your turn, 3 = wrong pad, 4 = round cleared.  Lists: seq = the whole pattern, todo = what is still to be repeated */
    const rules = K.bhv(p, 'Echo Pads – rules, HUD & pattern', ({ block, gv, ex, lab, start, put, flt, snd }) => {
      gv('state', 'set', 0, 0); gv('round', 'set', 0, 0); gv('best', 'set', 0, 0); gv('pressed', 'set', 0, 0);
      lab('hud', 'Round {round}     Best {best}', 'top', 26, '#9fb4ff', 14); lab('help', 'Pads: click · 1 2 3 4 · arrows', 'bottomLeft', 14, '#6b7aa8', 10);
      const texts = ['Click or press Enter to start', 'Watch …', 'Your turn', 'Wrong pad! You reached round {round} – click to restart', 'Nice!'];
      const msgs = texts.map((t, i) => lab('msg' + i, t, 'bottom', 26, i === 3 ? '#ffd7d7' : '#ffffff', 40));
      start().to(put('state', 'set', 0)); start().to(put('round', 'set', 0)); start().to(block('saveValue', { key: 'echo-best', action: 'load', default: '0' })).to(gv('best', 'set'));
      msgs.forEach((m, i) => { const s = block('sensor', { target: 'self', property: 'global:state', op: '==', value: i, mode: 'edge' }); s.to(m, 'out', 'show'); msgs.forEach((o, j) => { if (j !== i) s.to(o, 'out', 'hide'); }); });
      /* "next round": add a random pad to the pattern, copy it to the "todo" list and play it back, one pad every 0.55 s */
      const next = block('number', { value: 1 }, 'Next round');
      next.to(put('state', 'set', 1));
      const add = next.to(block('random', { mode: 'number', min: 0, max: 3, integer: true }, 'Random pad (0-3)')).to(block('listModify', { list: 'seq', op: 'add', value: '' }, 'Add to pattern'));
      add.to(block('listCount', { what: 'all', list: '' })).to(ex('value - 1', 'Rounds cleared')).to(gv('round', 'set'));
      const play = add.to(block('listModify', { list: 'todo', op: 'replaceAll', value: '' }, 'Copy to todo')).to(block('listEach', { interval: 0.55, list: '' }, 'Play the pattern'));
      play.to(block('message', { target: 'tag:pad', channel: 'flash', payload: '' }, 'Flash that pad'), 'item');
      play.to(put('state', 'set', 2), 'done');
      /* a new game: click or Enter while "ready" or after a wrong pad */
      const startNew = block('number', { value: 1 }, 'New game');
      block('mouseClick', { phase: 'click' }).to(startNew); block('keyboard', { key: 'enter' }).to(startNew);
      const ok = startNew.to(ex('state == 0 || state == 3', 'Ready or lost?')).to(flt('truthy'));
      ok.to(block('listModify', { list: 'seq', op: 'clear', value: '' }, 'Forget the pattern'), 'pass'); ok.to(put('round', 'set', 0), 'pass'); ok.to(next, 'pass');
      /* the player's pad presses arrive as messages from the pads */
      const press = block('mailbox', { channel: 'press' }, 'Pad pressed');
      press.to(gv('pressed', 'set'));
      const right = press.to(block('listModify', { list: 'todo', op: 'shift', value: '' }, 'Next expected pad')).to(ex('value == pressed', 'Right pad?'), 'item').to(flt('truthy'));
      right.to(snd('bad'), 'fail'); right.to(put('state', 'set', 3), 'fail'); right.to(block('camera', { action: 'shake', value: 6 }), 'fail');
      right.to(ex('round > best', 'New best?'), 'fail').to(flt('truthy')).to(ex('round'), 'pass').to(gv('best', 'set')).to(block('saveValue', { key: 'echo-best', action: 'save', value: '' }));
      /* right pad: was that the last one? then celebrate and start the next round after 0.8 s */
      const done = right.to(block('listCount', { what: 'all', list: 'todo' }, 'Pads left'), 'pass').to(flt('truthy'), 'isEmpty');
      done.to(put('state', 'set', 4), 'pass'); done.to(snd('good'), 'pass');
      done.to(block('timer', { interval: 0.8, repeat: false, autoStart: false, delay: 0 }, 'Short pause'), 'pass', 'start').to(next);
    });
    K.scene(p, [rules]);
    cols.forEach((c, i) => {
      const pad = K.bhv(p, 'Pad ' + (i + 1), ({ block, ex, flt, snd, key }) => {
        const flash = block('number', { value: 1 }, 'Flash!');
        flash.to(block('size', { target: 'self', mode: 'set', w: '156', h: '156' })); flash.to(block('alpha', { target: 'self', mode: 'set', value: 1 })); flash.to(snd('n' + i));
        flash.to(block('emit', { target: 'self', count: 10, color: c, speed: 120, spread: 360, life: 0.4, size: 5, gravity: 0 }), 'out', 'emit');
        flash.to(block('timer', { interval: 0.3, repeat: false, autoStart: false, delay: 0 }, 'Back to normal'), 'out', 'start').to(block('size', { target: 'self', mode: 'set', w: '140', h: '140' })).to(block('alpha', { target: 'self', mode: 'set', value: 0.4 }));
        /* the pattern player tells every pad which pad to flash; only this one reacts */
        block('mailbox', { channel: 'flash' }).to(ex('value == ' + i, 'Is it me?')).to(flt('truthy')).to(flash, 'pass');
        /* the player's press: click on me or my keys, only on their turn */
        const mine = block('number', { value: 1 }, 'Pressed');
        block('mouseClick', { phase: 'down', on: 'self' }).to(mine); key(keys[i][0]).to(mine); key(keys[i][1]).to(mine);
        const turn = mine.to(ex('state == 2', 'My turn?')).to(flt('truthy'));
        turn.to(flash, 'pass'); turn.to(block('number', { value: i }, 'My number')).to(block('message', { target: 'game', channel: 'press', payload: '' }));
      });
      add(p, 'rect', 'Pad' + i, 405 + (i % 2) * 150, 160 + Math.floor(i / 2) * 150, { w: 140, h: 140, color: c, alpha: 0.4, tags: ['pad'], behaviors: [pad] });
    });
    K.touch(p, {});
    return p; } });
})();
