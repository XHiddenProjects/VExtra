/* Five 2D example games for Library → Games. Each one is a small project whose rules are a script (see Docs → Scripting API) mixed with blocks
 * (labels, bars, sound detector …), physics bodies, prefabs and synth sounds – open one and read it to learn. */
(function () {
  const K = VX.exKit, PH = K.PH, BEH = K.beh, S = (fn) => '(' + fn.toString() + ')();';
  const add = (p, ...a) => K.add(p, '2d', ...a);

  /* ---------------------------------------------------------------- 1 · Neon Breakout (physics, prefabs, power-ups) */
  VX.gameExamples.push({ id: 'ex2d-breakout', name: 'Neon Breakout (2D)', type: 'game2d', desc: 'Bounce the ball, smash the neon bricks, catch the power-ups. Mouse or arrows, click / Space to launch.', build() {
    const p = K.proj('Neon Breakout', '2d', '#0a0620'); p.scenes[0].gravity = { x: 0, y: 0, z: 0 };
    K.synth(p, 'brick', 'square', 520, 880, 0.12, 0.3); K.synth(p, 'paddle', 'triangle', 220, 330, 0.1, 0.35); K.synth(p, 'lose', 'saw', 400, 60, 0.5, 0.35); K.synth(p, 'power', 'square', 440, 1320, 0.3, 0.3); K.synth(p, 'win', 'square', 523, 1046, 0.7, 0.3);
    const wall = (n, x, y, w, h) => add(p, 'rect', n, x, y, { w, h, color: '#241a55', physics: PH('static', { bounce: 1, friction: 0 }) });
    wall('Top', 480, -10, 980, 20); wall('Left', -10, 270, 20, 560); wall('Right', 970, 270, 20, 560);
    add(p, 'rect', 'Paddle', 480, 500, { w: 120, h: 16, color: '#00e5ff', physics: PH('kinematic', { bounce: 1, friction: 0 }) });
    add(p, 'rect', 'Brick', -500, -500, { w: 68, h: 24, color: '#ff3df2', prefab: true, tags: ['brick'], physics: PH('static', { bounce: 1, friction: 0 }) });
    add(p, 'rect', 'Pill', -500, -500, { w: 30, h: 14, color: '#fff35c', prefab: true, tags: ['pill'], physics: PH('kinematic', { sensor: true }) });
    add(p, 'ellipse', 'Ball', 480, 470, { w: 16, h: 16, color: '#ffffff', physics: PH('dynamic', { shape: 'circle', bounce: 1, friction: 0, gravityScale: 0, fixedRotation: true }), behaviors: [BEH(p, 'Breakout – ball & bricks', S(function () {
      const W = 960, ball = self, paddle = game.find('Paddle'); let speed = 380, wide = 0;
      const hud = (id, text, anchor, size, color) => { const l = block('label', { id, text, anchor, size, color, y: 12 }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Score {score}      Lives {lives}      Bricks {bricks}', 'topLeft', 22, '#9fe8ff'); hud('msg', '{msg}', 'center', 30, '#ffffff');
      vars.score = 0; vars.lives = 3; vars.state = 'ready'; vars.msg = 'Click or press Space to launch';
      const colors = ['#ff3df2', '#ff6b6b', '#ffb84d', '#fff35c', '#5cff9d', '#4dd2ff', '#8c7bff'];
      let n = 0; for (let r = 0; r < 7; r++) for (let c = 0; c < 12; c++) { const b = game.spawn('Brick', { x: 90 + c * 71, y: 70 + r * 30 }); b.color = colors[r]; n++; } vars.bricks = n;
      const burst = (x, y, color, count) => VXRT.emitParticles(game, { x, y, z: 0, count, color, speed: 160, spread: 360, angle: 0, life: 0.5, size: 5, gravity: 200, shrink: true });
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      const launch = () => { if (vars.state === 'over' || vars.state === 'won') return game.restart(true); if (vars.state === 'play') return; vars.state = 'play'; vars.msg = ''; const a = (-90 + (Math.random() * 50 - 25)) * Math.PI / 180; ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed; };
      on('click', launch); on('key:space', launch); on('mousemove', (e) => { paddle.x = Math.max(60 + (wide ? 30 : 0), Math.min(W - 60 - (wide ? 30 : 0), e.x)); });
      on('collide:Paddle', () => { const off = (ball.x - paddle.x) / (paddle.w / 2); ball.vx = off * speed * 0.9; ball.vy = -Math.abs(ball.vy); play('paddle'); });
      on('collide:brick', (b) => { burst(b.x, b.y, b.color, 12); game.removeObject(b); vars.score += 10; vars.bricks--; speed = Math.min(560, speed + 3); play('brick'); game.cameraShake && game.cameraShake(2);
        if (Math.random() < 0.14) { const pl = game.spawn('Pill', { x: b.x, y: b.y }); pl.vy = 160; }
        if (vars.bricks <= 0) { vars.state = 'won'; vars.msg = 'You cleared the wall!  Click to play again'; ball.vx = ball.vy = 0; play('win'); } });
      every(0.05, () => { for (const pl of game.findByTag('pill')) if (Math.abs(pl.x - paddle.x) < paddle.w / 2 + 15 && Math.abs(pl.y - paddle.y) < 18) { game.removeObject(pl); wide++; paddle.w = 180; play('power'); vars.score += 50; after(9, () => { wide--; if (!wide) paddle.w = 120; }); } else if (pl.y > 560) game.removeObject(pl); });
      on('update', (dt) => {
        const k = (input.isDown('right') || input.isDown('d') ? 1 : 0) - (input.isDown('left') || input.isDown('a') ? 1 : 0); if (k) paddle.x = Math.max(60, Math.min(W - 60, paddle.x + k * 560 * dt));
        if (vars.state === 'ready') { ball.x = paddle.x; ball.y = paddle.y - 20; ball.vx = ball.vy = 0; return; }
        if (vars.state !== 'play') return;
        let s = Math.hypot(ball.vx, ball.vy) || 1; ball.vx *= speed / s; ball.vy *= speed / s; if (Math.abs(ball.vy) < 90) ball.vy = (ball.vy < 0 ? -1 : 1) * 90;
        if (ball.y > 570) { vars.lives--; play('lose'); if (vars.lives <= 0) { vars.state = 'over'; vars.msg = 'Game over – click to try again'; ball.vx = ball.vy = 0; } else { vars.state = 'ready'; vars.msg = 'Click or press Space to launch'; speed = Math.max(380, speed - 40); } }
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 2 · Void Swarm (top-down shooter, waves, bar block) */
  VX.gameExamples.push({ id: 'ex2d-swarm', name: 'Void Swarm (2D)', type: 'game2d', desc: 'Top-down arena shooter: WASD to move, mouse to aim and shoot, survive the waves. Health bar, particles, screen shake.', build() {
    const p = K.proj('Void Swarm', '2d', '#050a18'); p.scenes[0].gravity = { x: 0, y: 0, z: 0 };
    K.synth(p, 'shot', 'square', 900, 300, 0.1, 0.18); K.synth(p, 'boom', 'noise', 900, 80, 0.3, 0.35); K.synth(p, 'hurt', 'saw', 300, 90, 0.3, 0.4); K.synth(p, 'wave', 'triangle', 330, 990, 0.5, 0.3);
    for (let i = 0; i < 40; i++) add(p, 'ellipse', 'Star ' + i, Math.round(Math.random() * 960), Math.round(Math.random() * 540), { w: 2 + (i % 3), h: 2 + (i % 3), color: '#2b3b6b', alpha: 0.9 });
    add(p, 'ellipse', 'Drone', -500, -500, { w: 28, h: 28, color: '#ff4d6d', prefab: true, tags: ['enemy'], vars: { hp: 2 } });
    add(p, 'ellipse', 'Bullet', -500, -500, { w: 9, h: 9, color: '#fff35c', prefab: true, tags: ['bullet'] });
    add(p, 'triangle', 'Player', 480, 270, { w: 30, h: 34, color: '#4dd2ff', tags: ['player'], behaviors: [BEH(p, 'Swarm – player & waves', S(function () {
      const me = self, W = 960, H = 540; vars.score = 0; vars.hp = 100; vars.wave = 0; vars.state = 'play'; vars.msg = '';
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y: y === undefined ? 12 : y }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Score {score}     Wave {wave}', 'topLeft', 22, '#9fe8ff'); hud('msg', '{msg}', 'center', 30, '#ffffff'); hud('help', 'WASD move · mouse aim · click / hold to shoot', 'bottom', 15, '#7c8db5', 10);
      block('once', { when: 'start' }).to(block('bar', { id: 'hp', variable: 'hp', max: 100, anchor: 'topRight', x: 16, y: 14, w: 220, h: 18, color: '#ff4d6d' }));
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      const burst = (x, y, c, n) => VXRT.emitParticles(game, { x, y, z: 0, count: n, color: c, speed: 220, spread: 360, angle: 0, life: 0.5, size: 5, gravity: 0, shrink: true });
      let cool = 0, toSpawn = 0, spawnT = 0; const startWave = () => { vars.wave++; toSpawn = 4 + vars.wave * 3; play('wave'); vars.msg = 'Wave ' + vars.wave; after(1.5, () => { if (vars.state === 'play') vars.msg = ''; }); };
      after(0.5, startWave);
      on('click', () => { if (vars.state === 'dead') game.restart(true); });
      const shoot = () => { const a = Math.atan2(input.mouse.y - me.y, input.mouse.x - me.x), b = game.spawn('Bullet', { x: me.x + Math.cos(a) * 20, y: me.y + Math.sin(a) * 20 }); b.vx = Math.cos(a) * 640; b.vy = Math.sin(a) * 640; b.life = 1.2; play('shot'); };
      on('update', (dt) => {
        if (vars.state !== 'play') return;
        const dx = (input.isDown('d') || input.isDown('right') ? 1 : 0) - (input.isDown('a') || input.isDown('left') ? 1 : 0), dy = (input.isDown('s') || input.isDown('down') ? 1 : 0) - (input.isDown('w') || input.isDown('up') ? 1 : 0), l = Math.hypot(dx, dy) || 1;
        me.x = Math.max(16, Math.min(W - 16, me.x + dx / l * 260 * dt)); me.y = Math.max(16, Math.min(H - 16, me.y + dy / l * 260 * dt)); me.rot = Math.atan2(input.mouse.y - me.y, input.mouse.x - me.x) * 180 / Math.PI + 90;
        cool -= dt; if (input.mouse.down && cool <= 0) { shoot(); cool = 0.16; }
        spawnT -= dt; if (toSpawn > 0 && spawnT <= 0) { spawnT = Math.max(0.25, 0.9 - vars.wave * 0.06); toSpawn--; const side = Math.floor(Math.random() * 4), d = game.spawn('Drone', { x: side === 0 ? -20 : side === 1 ? W + 20 : Math.random() * W, y: side === 2 ? -20 : side === 3 ? H + 20 : Math.random() * H }); d.vars.hp = 1 + Math.floor(vars.wave / 3); d.spd = 70 + vars.wave * 9 + Math.random() * 30; }
        const drones = game.findByTag('enemy'), bullets = game.findByTag('bullet');
        for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.life <= 0) { game.removeObject(b); continue; } for (const d of drones) if (d.alive && Math.hypot(b.x - d.x, b.y - d.y) < 20) { game.removeObject(b); d.vars.hp--; burst(b.x, b.y, '#fff35c', 5); if (d.vars.hp <= 0) { burst(d.x, d.y, '#ff4d6d', 16); game.removeObject(d); vars.score += 10; play('boom'); } break; } }
        for (const d of drones) { if (!d.alive) continue; const a = Math.atan2(me.y - d.y, me.x - d.x); d.x += Math.cos(a) * d.spd * dt; d.y += Math.sin(a) * d.spd * dt; if (Math.hypot(me.x - d.x, me.y - d.y) < 26) { game.removeObject(d); vars.hp -= 12; burst(me.x, me.y, '#4dd2ff', 12); play('hurt'); } }
        if (vars.hp <= 0) { vars.state = 'dead'; vars.msg = 'Overrun on wave ' + vars.wave + ' – score ' + vars.score + '\nClick to try again'; burst(me.x, me.y, '#4dd2ff', 40); me.visible = false; }
        else if (toSpawn <= 0 && !drones.some((d) => d.alive)) { vars.hp = Math.min(100, vars.hp + 15); startWave(); }
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 3 · Sling Tower (physics sandbox, drag to launch) */
  VX.gameExamples.push({ id: 'ex2d-sling', name: 'Sling Tower (2D)', type: 'game2d', desc: 'Drag back and release to fling boulders and topple the towers. Dynamic physics, five shots per level, three levels.', build() {
    const p = K.proj('Sling Tower', '2d', '#2b6cb0'); const sc = p.scenes[0];
    K.synth(p, 'fling', 'triangle', 200, 700, 0.25, 0.4); K.synth(p, 'crash', 'noise', 700, 70, 0.35, 0.4); K.synth(p, 'win', 'square', 392, 1568, 0.8, 0.3);
    add(p, 'rect', 'Ground', 480, 520, { w: 1400, h: 60, color: '#3f8f3f', physics: PH('static', { friction: 0.8 }) });
    add(p, 'rect', 'Hill', 150, 470, { w: 130, h: 40, color: '#6b8e23', physics: PH('static') });
    add(p, 'rect', 'Block', -500, -500, { w: 40, h: 40, color: '#c68642', prefab: true, tags: ['block'], physics: PH('dynamic', { friction: 0.6, bounce: 0.05, mass: 1 }) });
    add(p, 'ellipse', 'Boulder', -500, -500, { w: 34, h: 34, color: '#555b66', prefab: true, tags: ['boulder'], physics: PH('dynamic', { shape: 'circle', bounce: 0.3, friction: 0.5, mass: 3 }) });
    add(p, 'ellipse', 'Target', -500, -500, { w: 30, h: 30, color: '#e5484d', prefab: true, tags: ['target'], physics: PH('dynamic', { shape: 'circle', bounce: 0.2, friction: 0.5, mass: 0.6 }) });
    add(p, 'rect', 'Aim', 150, 420, { w: 10, h: 4, color: '#fff35c', visible: false });
    add(p, 'empty', 'Game rules', 0, 0, { behaviors: [BEH(p, 'Sling – game rules', S(function () {
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y: y === undefined ? 12 : y }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Level {level}     Shots {shots}     Targets {targets}', 'topLeft', 22, '#ffffff'); hud('msg', '{msg}', 'center', 32, '#ffffff'); hud('help', 'Drag back from the sling and release to fling', 'bottom', 15, '#e2e8f0', 10);
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      const LEVELS = [
        { shots: 5, build() { for (let i = 0; i < 4; i++) game.spawn('Block', { x: 700, y: 478 - i * 41 }); game.spawn('Target', { x: 700, y: 478 - 4 * 41 }); game.spawn('Block', { x: 790, y: 478 }); game.spawn('Target', { x: 790, y: 440 }); } },
        { shots: 5, build() { for (const x of [640, 760]) for (let i = 0; i < 3; i++) game.spawn('Block', { x, y: 478 - i * 41 }); for (let j = 0; j < 3; j++) game.spawn('Block', { x: 580 + j * 82 + 40, y: 478 - 3 * 41 + 0 }); game.spawn('Target', { x: 700, y: 478 - 4 * 41 }); game.spawn('Target', { x: 700, y: 478 }); game.spawn('Target', { x: 850, y: 490 }); } },
        { shots: 6, build() { for (let r = 0; r < 5; r++) for (let c = 0; c < 5 - r; c++) game.spawn('Block', { x: 640 + c * 42 + r * 21, y: 478 - r * 41 }); game.spawn('Target', { x: 700, y: 478 - 5 * 41 }); game.spawn('Target', { x: 860, y: 490 }); game.spawn('Target', { x: 560, y: 490 }); } },
      ];
      vars.level = vars.level || 1; const L = LEVELS[Math.min(vars.level, 3) - 1]; vars.shots = L.shots; vars.msg = ''; vars.state = 'aim'; L.build();
      const origin = { x: 150, y: 420 }; let drag = null, ball = null;
      on('mousedown', (e) => { if (vars.state === 'aim' && vars.shots > 0) drag = { x: e.x, y: e.y }; });
      on('mouseup', (e) => { if (!drag) return; const dx = origin.x - Math.min(e.x, origin.x + 20) , dy = origin.y - Math.max(e.y, origin.y - 120); drag = null; const px = Math.min(120, Math.hypot(origin.x - e.x, origin.y - e.y)); if (px < 12) return; const a = Math.atan2(origin.y - e.y, origin.x - e.x); ball = game.spawn('Boulder', { x: origin.x, y: origin.y }); ball.vx = Math.cos(a) * px * 7.2; ball.vy = Math.sin(a) * px * 7.2; vars.shots--; vars.state = 'fly'; play('fling'); after(6, () => { if (ball && ball.alive && vars.state === 'fly') { vars.state = 'aim'; } }); });
      const aim = game.find('Aim'); let t = 0; on('update', (dt) => { t += dt; if (drag && input.mouse.down) { const mx = input.mouse.x, my = input.mouse.y, len = Math.min(120, Math.hypot(origin.x - mx, origin.y - my)), a = Math.atan2(origin.y - my, origin.x - mx); aim.visible = true; aim.w = len; aim.x = origin.x - Math.cos(a) * len / 2; aim.y = origin.y - Math.sin(a) * len / 2; aim.rot = a * 180 / Math.PI; } else aim.visible = false;
        if (vars.state === 'over' || vars.state === 'won') return;
        const targets = game.findByTag('target').filter((x) => x.alive); vars.targets = targets.length;
        for (const x of targets) if (x.y > 600 || x.x > 1100 || (x.vars.hit === undefined && x.vy > 450)) { VXRT.emitParticles(game, { x: x.x, y: Math.min(x.y, 500), z: 0, count: 18, color: '#e5484d', speed: 200, spread: 360, angle: 0, life: 0.6, size: 6, gravity: 300, shrink: true }); game.removeObject(x); play('crash'); }
        if (!game.findByTag('target').filter((x) => x.alive).length) { vars.state = 'won'; play('win'); vars.msg = vars.level >= 3 ? 'All towers down – you win!' : 'Level cleared!  Click for the next one'; on('click', () => { vars.level = vars.level >= 3 ? 1 : vars.level + 1; game.restart(false); }); }
        else if (vars.shots <= 0 && vars.state !== 'fly' && (!ball || !ball.alive || Math.hypot(ball.vx, ball.vy) < 12)) { vars.state = 'over'; vars.msg = 'Out of boulders – click to retry'; on('click', () => game.restart(false)); }
        if (ball && ball.alive && vars.state === 'fly' && Math.hypot(ball.vx, ball.vy) < 25 && t > 0.5) vars.state = 'aim';
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 4 · Sky Hopper (kinematic pipes, dynamic bird, parallax, high score) */
  VX.gameExamples.push({ id: 'ex2d-hopper', name: 'Sky Hopper (2D)', type: 'game2d', desc: 'Tap Space / click to flap through the gaps. Kinematic moving pipes, parallax hills, saved high score.', build() {
    const p = K.proj('Sky Hopper', '2d', '#7fd6ff'); p.scenes[0].gravity = { x: 0, y: 1500, z: 0 };
    K.synth(p, 'flap', 'triangle', 300, 600, 0.12, 0.3); K.synth(p, 'point', 'square', 880, 1320, 0.12, 0.25); K.synth(p, 'hit', 'noise', 600, 60, 0.35, 0.4);
    for (let i = 0; i < 3; i++) add(p, 'ellipse', 'Cloud ' + i, 200 + i * 340, 70 + (i % 2) * 50, { w: 140, h: 44, color: '#ffffff', alpha: 0.85, tags: ['cloud'], order: -5 });
    for (let i = 0; i < 6; i++) add(p, 'triangle', 'Hill ' + i, i * 200, 470, { w: 260, h: 150 + (i % 3) * 30, color: '#5fb86a', tags: ['hill'], order: -3 });
    add(p, 'rect', 'Ground', 480, 520, { w: 1100, h: 60, color: '#caa45a', physics: PH('static'), tags: ['ground'], order: 5 });
    add(p, 'rect', 'Pipe', -500, -500, { w: 70, h: 500, color: '#3aa545', prefab: true, tags: ['pipe'], physics: PH('kinematic'), order: 2 });
    add(p, 'rect', 'Gap', -500, -500, { w: 10, h: 540, color: '#ffffff', alpha: 0, prefab: true, tags: ['gap'], physics: PH('kinematic', { sensor: true }) });
    add(p, 'ellipse', 'Bird', 220, 250, { w: 34, h: 28, color: '#ffd23f', physics: PH('dynamic', { shape: 'circle', bounce: 0, friction: 0, fixedRotation: true, gravityScale: 0 }), order: 6, behaviors: [BEH(p, 'Hopper – bird & pipes', S(function () {
      const bird = self; vars.score = 0; vars.state = 'ready'; vars.msg = 'Press Space or click to start'; vars.best = 0; try { vars.best = +localStorage.getItem('vx-hopper-best') || 0; } catch (e) { /* storage blocked */ }
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y }); block('once', { when: 'start' }).to(l); };
      hud('hud', '{score}', 'top', 54, '#ffffff', 14); hud('msg', '{msg}', 'center', 28, '#ffffff', 0); hud('best', 'Best {best}', 'topLeft', 18, '#1b3a57', 14);
      const play = (s) => { try { game.audio.play('snd_' + s); } catch (e) { /* sound off */ } };
      const flap = () => { if (vars.state === 'dead') return game.restart(false); if (vars.state === 'ready') { vars.state = 'play'; vars.msg = ''; bird.physics.gravityScale = 1; } bird.vy = -470; play('flap'); };
      on('click', flap); on('key:space', flap); on('key:up', flap);
      let spawnT = 1.2, speed = 210; const spawn = () => { const gy = 150 + Math.random() * 230, gap = Math.max(120, 190 - vars.score * 2); const a = game.spawn('Pipe', { x: 1040, y: gy - gap / 2 - 250 }), b = game.spawn('Pipe', { x: 1040, y: gy + gap / 2 + 250 }), g = game.spawn('Gap', { x: 1040 + 40, y: 270 }); for (const o of [a, b, g]) o.vx = -speed; };
      const die = () => { if (vars.state === 'dead') return; vars.state = 'dead'; play('hit'); VXRT.emitParticles(game, { x: bird.x, y: bird.y, z: 0, count: 24, color: '#ffd23f', speed: 260, spread: 360, angle: 0, life: 0.7, size: 6, gravity: 500, shrink: true }); if (vars.score > vars.best) { vars.best = vars.score; try { localStorage.setItem('vx-hopper-best', String(vars.best)); } catch (e) { /* storage blocked */ } } vars.msg = 'Score ' + vars.score + ' – click to try again'; for (const o of game.findByTag('pipe').concat(game.findByTag('gap'))) o.vx = 0; };
      on('collide:pipe', die); on('collide:ground', die);
      on('collide:gap', (g) => { if (g.vars.done) return; g.vars.done = 1; vars.score++; play('point'); });
      on('update', (dt) => {
        for (const c of game.findByTag('cloud')) { c.x -= 12 * dt; if (c.x < -100) c.x = 1060; } if (vars.state === 'dead') return;
        for (const h of game.findByTag('hill')) { if (vars.state === 'play') h.x -= 40 * dt; if (h.x < -160) h.x += 1200; }
        bird.rot = Math.max(-25, Math.min(70, bird.vy * 0.1)); if (vars.state !== 'play') { bird.y = 250 + Math.sin(Date.now() / 250) * 8; bird.vy = 0; return; }
        if (bird.y < -20) die(); speed = 210 + vars.score * 4; spawnT -= dt; if (spawnT <= 0) { spawnT = 1.55 - Math.min(0.5, vars.score * 0.02); spawn(); }
        for (const o of game.findByTag('pipe').concat(game.findByTag('gap'))) if (o.x < -120) game.removeObject(o);
      });
    }))] });
    return p; } });

  /* ---------------------------------------------------------------- 5 · Echo Pads (memory puzzle with clickable pads and sound) */
  VX.gameExamples.push({ id: 'ex2d-echo', name: 'Echo Pads (2D)', type: 'game2d', desc: 'Watch the pattern, repeat it. Click the pads or press 1-4 / arrow keys. Each pad has its own synth note.', build() {
    const p = K.proj('Echo Pads', '2d', '#141a2e'); p.scenes[0].gravity = { x: 0, y: 0, z: 0 };
    const cols = ['#ff5d73', '#45d483', '#4da3ff', '#ffd23f'], notes = [261, 329, 392, 523];
    cols.forEach((c, i) => { K.synth(p, 'n' + i, 'triangle', notes[i], notes[i], 0.35, 0.4); add(p, 'rect', 'Pad' + i, 405 + (i % 2) * 150, 160 + Math.floor(i / 2) * 150, { w: 140, h: 140, color: c, alpha: 0.4, tags: ['pad'], vars: { i } }); });
    K.synth(p, 'bad', 'saw', 200, 60, 0.6, 0.4); K.synth(p, 'good', 'square', 523, 1046, 0.4, 0.3);
    add(p, 'empty', 'Game rules', 0, 0, { behaviors: [BEH(p, 'Echo Pads – game rules', S(function () {
      const cols = ['#ff5d73', '#45d483', '#4da3ff', '#ffd23f'], pads = [0, 1, 2, 3].map((i) => game.find('Pad' + i)); let seq = [], pos = 0, accept = false, busy = false;
      vars.round = 0; vars.best = 0; vars.msg = 'Click or press Enter to start'; vars.state = 'idle'; try { vars.best = +localStorage.getItem('vx-echo-best') || 0; } catch (e) { /* storage blocked */ }
      const hud = (id, text, anchor, size, color, y) => { const l = block('label', { id, text, anchor, size, color, y }); block('once', { when: 'start' }).to(l); };
      hud('hud', 'Round {round}     Best {best}', 'top', 26, '#9fb4ff', 14); hud('msg', '{msg}', 'bottom', 26, '#ffffff', 40); hud('help', 'Pads: click · 1 2 3 4 · arrows', 'bottomLeft', 14, '#6b7aa8', 10);
      const flash = (i, ms) => { pads[i].alpha = 1; pads[i].w = pads[i].h = 156; try { game.audio.play('snd_n' + i); } catch (e) { /* sound off */ } VXRT.emitParticles(game, { x: pads[i].x, y: pads[i].y, z: 0, count: 10, color: cols[i], speed: 120, spread: 360, angle: 0, life: 0.4, size: 5, gravity: 0, shrink: true }); after(ms / 1000, () => { pads[i].alpha = 0.4; pads[i].w = pads[i].h = 140; }); };
      const next = () => { seq.push(Math.floor(Math.random() * 4)); vars.round = seq.length - 1; vars.msg = 'Watch …'; accept = false; busy = true; seq.forEach((n, k) => after(0.7 + k * 0.55, () => flash(n, 380))); after(0.7 + seq.length * 0.55, () => { vars.msg = 'Your turn'; accept = true; busy = false; pos = 0; }); };
      const lose = () => { accept = false; try { game.audio.play('snd_bad'); } catch (e) { /* sound off */ } vars.msg = 'Wrong pad! You reached round ' + vars.round + ' – click to restart'; vars.state = 'idle'; if (vars.round > vars.best) { vars.best = vars.round; try { localStorage.setItem('vx-echo-best', String(vars.best)); } catch (e) { /* storage blocked */ } } game.cameraShake && game.cameraShake(6); };
      const press = (i) => { if (vars.state === 'idle') { if (busy) return; seq = []; vars.state = 'play'; return next(); } if (!accept) return; flash(i, 220); if (seq[pos] !== i) return lose(); pos++; if (pos === seq.length) { accept = false; vars.msg = 'Nice!'; try { game.audio.play('snd_good'); } catch (e) { /* sound off */ } after(0.8, next); } };
      on('mousedown', (e) => { for (let i = 0; i < 4; i++) if (Math.abs(e.x - pads[i].x) < 70 && Math.abs(e.y - pads[i].y) < 70) return press(i); if (vars.state === 'idle') press(0); });
      on('key:1', () => press(0)); on('key:2', () => press(1)); on('key:3', () => press(2)); on('key:4', () => press(3)); on('key:left', () => press(0)); on('key:up', () => press(1)); on('key:down', () => press(2)); on('key:right', () => press(3)); on('key:enter', () => { if (vars.state === 'idle') press(0); });
    }))] });
    return p; } });
})();
