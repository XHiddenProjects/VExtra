/* Vextra game editor – built-in default assets: sprites (procedural pixel art), sounds, 3D models, materials, shaders and animation clips.
 * VX.defaultAssets.catalog(kind) -> [{ key, name, tag, make(project) -> asset }]   (kind: sprites | sounds | models | materials | shaders | animations) */
(function () {
  const { uid } = VX;
  const S = 32;

  /* ---------- sprites: tiny canvas painters. f = frame index ---------- */
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const O = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
  const poly = (c, col, pts) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  const SPRITES = [
    ['coin', 'Coin', 'collect', 4, (c, f) => { const w = [12, 8, 3, 8][f]; c.fillStyle = '#f2b705'; c.beginPath(); c.ellipse(16, 16, w, 12, 0, 0, 6.28); c.fill(); c.fillStyle = '#ffe066'; c.beginPath(); c.ellipse(16, 16, Math.max(1, w - 3), 9, 0, 0, 6.28); c.fill(); if (w > 6) R(c, '#f2b705', 15, 10, 2, 12); }],
    ['gem', 'Gem', 'collect', 2, (c, f) => { poly(c, '#38d6e8', [[16, 4], [27, 13], [16, 28], [5, 13]]); poly(c, '#8af3ff', [[16, 4], [22, 13], [16, 13]]); poly(c, '#1795a8', [[16, 13], [22, 13], [16, 28]]); if (f) R(c, '#ffffff', 21, 7, 2, 2); }],
    ['heart', 'Heart', 'collect', 2, (c, f) => { const s = f ? 1.06 : 1; c.save(); c.translate(16, 17); c.scale(s, s); O(c, '#ff4d6d', -6, -4, 7); O(c, '#ff4d6d', 6, -4, 7); poly(c, '#ff4d6d', [[-13, -1], [13, -1], [0, 13]]); O(c, '#ffb3c1', -8, -7, 2.2); c.restore(); }],
    ['star', 'Star', 'collect', 2, (c, f) => { const p = []; for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2 + (f ? 0.1 : 0), r = i % 2 ? 6 : 13; p.push([16 + Math.cos(a) * r, 17 + Math.sin(a) * r]); } poly(c, '#ffd23f', p); O(c, '#fff3b0', 14, 14, 2); }],
    ['key', 'Key', 'collect', 1, (c) => { O(c, '#f2b705', 10, 12, 7); O(c, '#00000000', 10, 12, 3); c.clearRect(8, 10, 4, 4); R(c, '#f2b705', 15, 11, 14, 3); R(c, '#f2b705', 24, 14, 3, 6); R(c, '#f2b705', 19, 14, 3, 4); }],
    ['potion', 'Potion', 'collect', 2, (c, f) => { R(c, '#cbd5e1', 13, 4, 6, 6); R(c, '#8b5e34', 12, 3, 8, 3); poly(c, '#e11d48', [[13, 10], [19, 10], [26, 26], [6, 26]]); poly(c, '#fb7185', [[13, 16 + f], [19, 16 + f], [24, 26], [8, 26]]); R(c, '#ffffff66', 11, 18, 2, 5); }],
    ['crate', 'Crate', 'tile', 1, (c) => { R(c, '#a8672b', 2, 2, 28, 28); R(c, '#7a4719', 2, 2, 28, 3); R(c, '#7a4719', 2, 27, 28, 3); R(c, '#7a4719', 2, 2, 3, 28); R(c, '#7a4719', 27, 2, 3, 28); c.strokeStyle = '#7a4719'; c.lineWidth = 3; c.beginPath(); c.moveTo(4, 4); c.lineTo(28, 28); c.moveTo(28, 4); c.lineTo(4, 28); c.stroke(); }],
    ['brick', 'Brick wall', 'tile', 1, (c) => { R(c, '#b5543b', 0, 0, 32, 32); c.fillStyle = '#7d3524'; for (let r = 0; r < 4; r++) { R(c, '#7d3524', 0, r * 8, 32, 1); for (let k = 0; k < 2; k++) R(c, '#7d3524', ((k * 16 + (r % 2) * 8) % 32), r * 8, 1, 8); } }],
    ['grass', 'Grass block', 'tile', 1, (c) => { R(c, '#8a5a2b', 0, 0, 32, 32); R(c, '#5fb53a', 0, 0, 32, 9); R(c, '#79d14c', 0, 0, 32, 4); for (let i = 0; i < 6; i++) R(c, '#6e4a22', 3 + i * 5, 14 + (i % 3) * 5, 3, 3); }],
    ['stone', 'Stone block', 'tile', 1, (c) => { R(c, '#8b94a5', 0, 0, 32, 32); R(c, '#a8b0bf', 0, 0, 32, 3); R(c, '#6b7385', 0, 29, 32, 3); for (const [x, y] of [[6, 8], [18, 14], [10, 22], [24, 24]]) R(c, '#6b7385', x, y, 4, 3); }],
    ['platform', 'Platform', 'tile', 1, (c) => { R(c, '#3b4a6b', 0, 10, 32, 12); R(c, '#5b7bb8', 0, 10, 32, 4); R(c, '#2a3550', 0, 20, 32, 2); for (let i = 3; i < 32; i += 8) R(c, '#2a3550', i, 15, 2, 3); }],
    ['water', 'Water tile', 'tile', 3, (c, f) => { R(c, '#2a6fdb', 0, 0, 32, 32); c.strokeStyle = '#7fb3ff'; c.lineWidth = 2; for (let y = 6; y < 32; y += 9) { c.beginPath(); for (let x = 0; x <= 32; x += 4) c.lineTo(x, y + Math.sin((x + f * 8) / 4) * 2); c.stroke(); } }],
    ['lava', 'Lava tile', 'tile', 3, (c, f) => { R(c, '#d93a12', 0, 0, 32, 32); c.fillStyle = '#ffb02e'; for (let i = 0; i < 5; i++) O(c, '#ffb02e', (i * 9 + f * 5) % 32, (i * 13 + 6) % 32, 3 + (i % 2)); }],
    ['spike', 'Spikes', 'hazard', 1, (c) => { for (let i = 0; i < 4; i++) poly(c, '#c9d2e3', [[i * 8, 30], [i * 8 + 4, 8], [i * 8 + 8, 30]]); R(c, '#6b7385', 0, 28, 32, 4); }],
    ['spring', 'Spring', 'object', 2, (c, f) => { const h = f ? 8 : 14; R(c, '#6b7385', 6, 26, 20, 4); c.strokeStyle = '#e5534b'; c.lineWidth = 3; c.beginPath(); for (let i = 0; i <= 6; i++) c.lineTo(i % 2 ? 22 : 10, 26 - (h * i) / 6 * 1.4); c.stroke(); R(c, '#e5534b', 5, 26 - h * 1.4 - 4, 22, 4); }],
    ['flag', 'Goal flag', 'object', 2, (c, f) => { R(c, '#c9d2e3', 7, 3, 3, 27); poly(c, '#3fb950', [[10, 4], [27, 8 + f * 1.5], [10, 14]]); R(c, '#6b7385', 4, 29, 9, 3); }],
    ['door', 'Door', 'object', 1, (c) => { R(c, '#7a4719', 6, 3, 20, 28); R(c, '#a8672b', 8, 5, 16, 26); R(c, '#7a4719', 15, 5, 2, 26); O(c, '#f2b705', 21, 18, 1.8); }],
    ['chest', 'Treasure chest', 'object', 2, (c, f) => { R(c, '#8b5a2b', 3, 14, 26, 14); R(c, f ? '#1b1206' : '#a8672b', 3, f ? 8 : 6, 26, f ? 6 : 8); if (f) R(c, '#ffd23f', 8, 10, 16, 4); R(c, '#f2b705', 3, 18, 26, 2); R(c, '#f2b705', 14, 17, 4, 6); }],
    ['tree', 'Tree', 'scenery', 1, (c) => { R(c, '#7a4719', 14, 18, 5, 12); O(c, '#2f9e44', 16, 12, 10); O(c, '#40c057', 13, 9, 6); O(c, '#2f9e44', 22, 15, 6); }],
    ['pine', 'Pine tree', 'scenery', 1, (c) => { R(c, '#7a4719', 14, 24, 5, 7); poly(c, '#2b8a3e', [[16, 2], [26, 14], [6, 14]]); poly(c, '#2f9e44', [[16, 8], [28, 22], [4, 22]]); poly(c, '#37b24d', [[16, 14], [30, 27], [2, 27]]); }],
    ['bush', 'Bush', 'scenery', 1, (c) => { O(c, '#2f9e44', 9, 22, 8); O(c, '#40c057', 17, 18, 9); O(c, '#2f9e44', 24, 22, 7); R(c, '#2f9e44', 4, 22, 24, 7); }],
    ['rock', 'Rock', 'scenery', 1, (c) => { poly(c, '#7f8796', [[4, 28], [8, 14], [16, 8], [25, 12], [29, 28]]); poly(c, '#a3abba', [[8, 14], [16, 8], [14, 18]]); }],
    ['cloud', 'Cloud', 'scenery', 1, (c) => { O(c, '#ffffff', 10, 20, 7); O(c, '#ffffff', 18, 15, 9); O(c, '#ffffff', 25, 20, 6); R(c, '#ffffff', 8, 20, 18, 7); }],
    ['flower', 'Flower', 'scenery', 2, (c, f) => { R(c, '#2f9e44', 15, 14, 2, 16); for (let i = 0; i < 5; i++) { const a = (i * 6.2832) / 5 + f * 0.2; O(c, '#ff8fab', 16 + Math.cos(a) * 6, 11 + Math.sin(a) * 6, 4); } O(c, '#ffd23f', 16, 11, 3.2); }],
    ['hero', 'Hero (idle + walk)', 'character', 4, (c, f) => { const b = f === 1 || f === 3 ? 1 : 0, l = [0, 3, 0, -3][f]; R(c, '#3a5bd9', 11 + l, 22, 4, 8); R(c, '#3a5bd9', 17 - l, 22, 4, 8); R(c, '#4f7cff', 9, 11 - b, 14, 12); R(c, '#ffd5a8', 10, 2 - b, 12, 10); R(c, '#5a3b1c', 9, 1 - b, 14, 4); R(c, '#111827', 13, 6 - b, 2, 3); R(c, '#111827', 18, 6 - b, 2, 3); R(c, '#4f7cff', 6, 13 - b + l / 2, 3, 8); R(c, '#4f7cff', 23, 13 - b - l / 2, 3, 8); }],
    ['slime', 'Slime enemy', 'enemy', 2, (c, f) => { const h = f ? 16 : 19; c.fillStyle = '#7ee787'; c.beginPath(); c.ellipse(16, 30 - h / 2 - 1, 12 + f, h / 2, 0, Math.PI, 0); c.fill(); R(c, '#7ee787', 4 - f, 28 - 1, 24 + 2 * f, 3); R(c, '#111827', 11, 21 - h / 2 + 4, 3, 4); R(c, '#111827', 19, 21 - h / 2 + 4, 3, 4); }],
    ['bat', 'Bat enemy', 'enemy', 2, (c, f) => { const w = f ? 9 : 3; poly(c, '#6b4fa3', [[16, 14], [3, 14 - w], [8, 18], [16, 20]]); poly(c, '#6b4fa3', [[16, 14], [29, 14 - w], [24, 18], [16, 20]]); O(c, '#3f2b6b', 16, 17, 6); R(c, '#ff4d6d', 13, 15, 2, 2); R(c, '#ff4d6d', 18, 15, 2, 2); }],
    ['ghost', 'Ghost enemy', 'enemy', 2, (c, f) => { c.fillStyle = '#e8ecff'; c.beginPath(); c.arc(16, 14, 10, Math.PI, 0); c.lineTo(26, 28); for (let i = 0; i < 4; i++) c.lineTo(26 - (i + 1) * 5, 28 - ((i + f) % 2) * 3 + 2); c.lineTo(6, 28); c.closePath(); c.fill(); R(c, '#111827', 11, 12, 3, 4); R(c, '#111827', 18, 12, 3, 4); }],
    ['bullet', 'Bullet', 'projectile', 1, (c) => { R(c, '#ffd23f', 8, 13, 16, 6); R(c, '#ffffff', 8, 14, 12, 2); O(c, '#ff922b', 24, 16, 3); }],
    ['fireball', 'Fireball', 'projectile', 3, (c, f) => { O(c, '#ff6b35', 16, 16, 10 + f); O(c, '#ffb02e', 16, 16, 7); O(c, '#fff3b0', 16, 16, 3.5); }],
    ['explosion', 'Explosion', 'effect', 5, (c, f) => { const r = 4 + f * 5, a = 1 - f * 0.18; c.globalAlpha = Math.max(0.1, a); O(c, '#ff6b35', 16, 16, r); O(c, '#ffb02e', 16, 16, r * 0.7); O(c, '#fff3b0', 16, 16, r * 0.35); c.globalAlpha = 1; }],
    ['sparkle', 'Sparkle', 'effect', 4, (c, f) => { const r = [3, 8, 12, 6][f]; poly(c, '#fff3b0', [[16, 16 - r], [18, 14], [16 + r, 16], [18, 18], [16, 16 + r], [14, 18], [16 - r, 16], [14, 14]]); }],
    ['button', 'Button', 'ui', 1, (c) => { R(c, '#2b3550', 2, 7, 28, 18); R(c, '#4f7cff', 3, 8, 26, 14); R(c, '#7fa2ff', 3, 8, 26, 4); }],
    ['arrow', 'Arrow', 'ui', 1, (c) => { poly(c, '#e8ecff', [[4, 12], [18, 12], [18, 5], [29, 16], [18, 27], [18, 20], [4, 20]]); }],
    ['sword', 'Sword', 'item', 1, (c) => { poly(c, '#cfd8e6', [[26, 3], [29, 6], [12, 23], [9, 20]]); R(c, '#a8672b', 5, 21, 8, 3); poly(c, '#7a4719', [[4, 28], [8, 24], [10, 26], [6, 30]]); }],
    ['shield', 'Shield', 'item', 1, (c) => { poly(c, '#4f7cff', [[16, 3], [28, 7], [26, 20], [16, 29], [6, 20], [4, 7]]); poly(c, '#7fa2ff', [[16, 3], [28, 7], [26, 20], [16, 29]]); R(c, '#e8ecff', 15, 8, 2, 14); R(c, '#e8ecff', 10, 13, 12, 2); }],
  ];
  const sprite = (e, project) => { const [, name, , n, fn] = e; const frames = []; for (let f = 0; f < n; f++) { const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; fn(c, f); frames.push(cv.toDataURL()); } const a = { id: uid('spr'), name, w: S, h: S, frames, fps: n > 1 ? 6 : 0 }; if (e[0] === 'hero') a.anims = { idle: [0], walk: [0, 1, 2, 3] }; if (n > 1 && !a.anims) a.anims = { play: frames.map((_, i) => i) }; return a; };

  /* ---------- sounds ---------- */
  const SND_EXTRA = {
    click: { wave: 'square', freq: 700, freqEnd: 500, dur: 0.05, decay: 0.02, sustain: 0.1, vol: 0.4 }, select: { wave: 'triangle', freq: 440, freqEnd: 660, dur: 0.1, vol: 0.4 }, error: { wave: 'sawtooth', freq: 180, freqEnd: 120, dur: 0.3, vol: 0.4 },
    win: { wave: 'square', freq: 523, freqEnd: 1046, dur: 0.6, decay: 0.2, sustain: 0.5, vibrato: 3, vibratoRate: 10, vol: 0.4 }, lose: { wave: 'triangle', freq: 400, freqEnd: 80, dur: 0.7, decay: 0.3, sustain: 0.3, vol: 0.5 },
    bounce: { wave: 'sine', freq: 200, freqEnd: 420, dur: 0.15, vol: 0.5 }, splash: { wave: 'noise', freq: 900, freqEnd: 300, dur: 0.35, decay: 0.2, vol: 0.35 }, whoosh: { wave: 'noise', freq: 300, freqEnd: 1500, dur: 0.4, attack: 0.15, decay: 0.2, vol: 0.3 },
    shoot: { wave: 'square', freq: 900, freqEnd: 120, dur: 0.18, decay: 0.05, vol: 0.4 }, door: { wave: 'sawtooth', freq: 90, freqEnd: 60, dur: 0.45, vibrato: 6, vibratoRate: 30, vol: 0.4 }, alarm: { wave: 'square', freq: 600, freqEnd: 900, dur: 0.6, vibrato: 5, vibratoRate: 6, vol: 0.35 },
  };
  const sound = (key, name) => { const p = Object.assign({}, VX.SOUND_PRESETS[key] || SND_EXTRA[key]); const full = Object.assign({ wave: 'square', freq: 440, freqEnd: 440, dur: 0.3, attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.1, vol: 0.5, vibrato: 0, vibratoRate: 8 }, p); return { id: uid('snd'), name, kind: 'synth', params: full }; };

  /* ---------- 3D models (shape groups) ---------- */
  const P_ = (type, x, y, z, w, h, d, color, extra) => Object.assign({ type, x, y, z, w, h, d, rx: 0, ry: 0, rz: 0, color }, extra || {});
  const MODELS = [
    ['Tree', 'nature', [P_('cylinder', 0, 0.2, 0, 0.18, 0.5, 0.18, '#7a4719'), P_('sphere', 0, 0.75, 0, 0.7, 0.7, 0.7, '#2f9e44'), P_('sphere', 0.2, 0.6, 0.1, 0.45, 0.45, 0.45, '#40c057')]],
    ['Pine tree', 'nature', [P_('cylinder', 0, 0.1, 0, 0.14, 0.3, 0.14, '#7a4719'), P_('cone', 0, 0.45, 0, 0.7, 0.45, 0.7, '#2b8a3e'), P_('cone', 0, 0.75, 0, 0.55, 0.4, 0.55, '#2f9e44'), P_('cone', 0, 1, 0, 0.4, 0.35, 0.4, '#37b24d')]],
    ['Rock', 'nature', [P_('sphere', 0, 0.2, 0, 0.8, 0.5, 0.65, '#7f8796'), P_('sphere', 0.3, 0.1, 0.2, 0.4, 0.3, 0.4, '#9aa3b4')]],
    ['Mushroom', 'nature', [P_('cylinder', 0, 0.15, 0, 0.18, 0.3, 0.18, '#f1e4c8'), P_('sphere', 0, 0.38, 0, 0.6, 0.35, 0.6, '#e5534b')]],
    ['Flower', 'nature', [P_('cylinder', 0, 0.25, 0, 0.04, 0.5, 0.04, '#2f9e44'), P_('sphere', 0, 0.55, 0, 0.25, 0.25, 0.25, '#ffd23f'), P_('torus', 0, 0.55, 0, 0.45, 0.45, 0.45, '#ff8fab', { rx: 90 })]],
    ['House', 'building', [P_('cube', 0, 0.3, 0, 1, 0.6, 0.8, '#e9d8b4'), P_('pyramid', 0, 0.8, 0, 1.25, 0.5, 1.05, '#b5543b'), P_('cube', 0, 0.2, 0.41, 0.2, 0.4, 0.02, '#7a4719'), P_('cube', 0.3, 0.35, 0.41, 0.2, 0.2, 0.02, '#8ecae6')]],
    ['Tower', 'building', [P_('cylinder', 0, 0.6, 0, 0.5, 1.2, 0.5, '#9aa3b4'), P_('cone', 0, 1.4, 0, 0.65, 0.5, 0.65, '#b5543b'), P_('cube', 0, 0.9, 0.26, 0.1, 0.2, 0.02, '#1b1f2a')]],
    ['Fence', 'building', [P_('cube', -0.4, 0.25, 0, 0.1, 0.5, 0.1, '#a8672b'), P_('cube', 0, 0.25, 0, 0.1, 0.5, 0.1, '#a8672b'), P_('cube', 0.4, 0.25, 0, 0.1, 0.5, 0.1, '#a8672b'), P_('cube', 0, 0.35, 0, 1, 0.08, 0.05, '#c98a4b'), P_('cube', 0, 0.15, 0, 1, 0.08, 0.05, '#c98a4b')]],
    ['Bridge', 'building', [P_('cube', 0, 0.2, 0, 1.6, 0.1, 0.6, '#a8672b'), P_('cube', -0.75, 0.4, 0.28, 0.06, 0.4, 0.06, '#7a4719'), P_('cube', 0.75, 0.4, 0.28, 0.06, 0.4, 0.06, '#7a4719'), P_('cube', -0.75, 0.4, -0.28, 0.06, 0.4, 0.06, '#7a4719'), P_('cube', 0.75, 0.4, -0.28, 0.06, 0.4, 0.06, '#7a4719')]],
    ['Crate', 'prop', [P_('cube', 0, 0.3, 0, 0.6, 0.6, 0.6, '#a8672b'), P_('cube', 0, 0.3, 0, 0.64, 0.1, 0.64, '#7a4719'), P_('cube', 0, 0.3, 0, 0.1, 0.64, 0.64, '#7a4719')]],
    ['Barrel', 'prop', [P_('cylinder', 0, 0.35, 0, 0.5, 0.7, 0.5, '#8b5a2b'), P_('cylinder', 0, 0.15, 0, 0.53, 0.06, 0.53, '#6b7385'), P_('cylinder', 0, 0.55, 0, 0.53, 0.06, 0.53, '#6b7385')]],
    ['Chest', 'prop', [P_('cube', 0, 0.2, 0, 0.8, 0.4, 0.5, '#8b5a2b'), P_('cylinder', 0, 0.4, 0, 0.5, 0.8, 0.5, '#a8672b', { rz: 90 }), P_('cube', 0, 0.35, 0.26, 0.1, 0.12, 0.03, '#ffd23f')]],
    ['Lamp post', 'prop', [P_('cylinder', 0, 0.6, 0, 0.06, 1.2, 0.06, '#4b5563'), P_('sphere', 0, 1.25, 0, 0.25, 0.25, 0.25, '#fff3b0')]],
    ['Coin', 'item', [P_('cylinder', 0, 0.2, 0, 0.5, 0.06, 0.5, '#f2b705', { rx: 90 })]],
    ['Gem', 'item', [P_('pyramid', 0, 0.4, 0, 0.5, 0.4, 0.5, '#38d6e8'), P_('pyramid', 0, 0.15, 0, 0.5, 0.4, 0.5, '#1795a8', { rx: 180 })]],
    ['Heart', 'item', [P_('sphere', -0.12, 0.4, 0, 0.3, 0.3, 0.3, '#ff4d6d'), P_('sphere', 0.12, 0.4, 0, 0.3, 0.3, 0.3, '#ff4d6d'), P_('cone', 0, 0.2, 0, 0.45, 0.4, 0.3, '#ff4d6d', { rz: 180 })]],
    ['Sword', 'item', [P_('cube', 0, 0.55, 0, 0.08, 0.8, 0.02, '#cfd8e6'), P_('cube', 0, 0.15, 0, 0.3, 0.05, 0.05, '#a8672b'), P_('cylinder', 0, 0.05, 0, 0.06, 0.2, 0.06, '#7a4719')]],
    ['Character', 'character', [P_('capsule', 0, 0.45, 0, 0.5, 0.8, 0.5, '#4f7cff'), P_('sphere', 0, 0.98, 0, 0.4, 0.4, 0.4, '#ffd5a8'), P_('sphere', -0.08, 1.0, 0.17, 0.07, 0.07, 0.07, '#111827'), P_('sphere', 0.08, 1.0, 0.17, 0.07, 0.07, 0.07, '#111827')]],
    ['Robot', 'character', [P_('cube', 0, 0.45, 0, 0.5, 0.55, 0.35, '#9aa3b4'), P_('cube', 0, 0.9, 0, 0.38, 0.3, 0.3, '#cfd8e6'), P_('sphere', -0.08, 0.92, 0.16, 0.08, 0.08, 0.08, '#38d6e8'), P_('sphere', 0.08, 0.92, 0.16, 0.08, 0.08, 0.08, '#38d6e8'), P_('cube', -0.33, 0.45, 0, 0.12, 0.45, 0.12, '#6b7385'), P_('cube', 0.33, 0.45, 0, 0.12, 0.45, 0.12, '#6b7385'), P_('cube', -0.12, 0.1, 0, 0.14, 0.2, 0.14, '#6b7385'), P_('cube', 0.12, 0.1, 0, 0.14, 0.2, 0.14, '#6b7385')]],
    ['Snowman', 'character', [P_('sphere', 0, 0.25, 0, 0.5, 0.5, 0.5, '#ffffff'), P_('sphere', 0, 0.65, 0, 0.38, 0.38, 0.38, '#ffffff'), P_('sphere', 0, 0.95, 0, 0.28, 0.28, 0.28, '#ffffff'), P_('cone', 0, 0.95, 0.17, 0.06, 0.2, 0.06, '#ff922b', { rx: 90 })]],
    ['Car', 'vehicle', [P_('cube', 0, 0.22, 0, 1.2, 0.3, 0.6, '#e5534b'), P_('cube', 0, 0.45, -0.02, 0.6, 0.22, 0.5, '#8ecae6'), P_('cylinder', -0.4, 0.12, 0.32, 0.26, 0.1, 0.26, '#1f2937', { rx: 90 }), P_('cylinder', 0.4, 0.12, 0.32, 0.26, 0.1, 0.26, '#1f2937', { rx: 90 }), P_('cylinder', -0.4, 0.12, -0.32, 0.26, 0.1, 0.26, '#1f2937', { rx: 90 }), P_('cylinder', 0.4, 0.12, -0.32, 0.26, 0.1, 0.26, '#1f2937', { rx: 90 })]],
    ['Rocket', 'vehicle', [P_('cylinder', 0, 0.6, 0, 0.35, 1, 0.35, '#e8ecff'), P_('cone', 0, 1.25, 0, 0.35, 0.4, 0.35, '#e5534b'), P_('cube', 0.22, 0.2, 0, 0.3, 0.3, 0.05, '#e5534b'), P_('cube', -0.22, 0.2, 0, 0.3, 0.3, 0.05, '#e5534b')]],
    ['Boat', 'vehicle', [P_('cube', 0, 0.15, 0, 1.1, 0.25, 0.45, '#a8672b'), P_('cylinder', 0, 0.7, 0, 0.04, 1, 0.04, '#7a4719'), P_('plane', 0.2, 0.75, 0, 0.55, 0.65, 1, '#f1f5f9', { ry: 90 })]],
  ];
  const model = (m) => ({ id: uid('mdl'), name: m[0], kind: 'group', parts: JSON.parse(JSON.stringify(m[2])) });

  /* ---------- materials ---------- */
  const M = (name, tag, o) => [name, tag, Object.assign({ color: '#cccccc', metalness: 0.1, roughness: 0.7, emissive: '#000000', emissiveIntensity: 1, opacity: 1, pattern: 'none', color2: '#444444', repeatX: 1, repeatY: 1, wireframe: false, flat: false, doubleSided: false }, o)];
  const MATERIALS = [
    M('Gold', 'metal', { color: '#f2b705', metalness: 1, roughness: 0.25 }), M('Silver', 'metal', { color: '#cfd6e2', metalness: 1, roughness: 0.2 }), M('Copper', 'metal', { color: '#c9733d', metalness: 1, roughness: 0.3 }), M('Steel', 'metal', { color: '#8b94a5', metalness: 0.9, roughness: 0.4 }), M('Chrome', 'metal', { color: '#ffffff', metalness: 1, roughness: 0.05 }), M('Rusty iron', 'metal', { color: '#8a4b2a', metalness: 0.6, roughness: 0.85, pattern: 'noise', color2: '#5a2d14' }),
    M('Red plastic', 'plastic', { color: '#e5534b', roughness: 0.35 }), M('Blue plastic', 'plastic', { color: '#4f7cff', roughness: 0.35 }), M('Green plastic', 'plastic', { color: '#3fb950', roughness: 0.35 }), M('White matte', 'plastic', { color: '#f1f5f9', roughness: 1 }), M('Black rubber', 'plastic', { color: '#1f2430', roughness: 0.95 }),
    M('Glass', 'glass', { color: '#bfe3ff', metalness: 0, roughness: 0.02, opacity: 0.35, doubleSided: true }), M('Ice', 'glass', { color: '#bde7ff', roughness: 0.15, opacity: 0.7, emissive: '#2a6fdb', emissiveIntensity: 0.15 }), M('Water', 'glass', { color: '#2a6fdb', roughness: 0.1, opacity: 0.7, pattern: 'noise', color2: '#7fb3ff' }),
    M('Wood planks', 'natural', { color: '#a8672b', roughness: 0.8, pattern: 'wood', color2: '#6b4118' }), M('Brick', 'natural', { color: '#b5543b', roughness: 0.9, pattern: 'bricks', color2: '#8c3b27', repeatX: 2, repeatY: 2 }), M('Grass', 'natural', { color: '#5fb53a', roughness: 1, pattern: 'grass', color2: '#2f7a1c', repeatX: 3, repeatY: 3 }), M('Stone', 'natural', { color: '#8b94a5', roughness: 0.95, pattern: 'noise', color2: '#5b6374' }), M('Sand', 'natural', { color: '#e9d8a6', roughness: 1, pattern: 'noise', color2: '#c9b26a' }), M('Snow', 'natural', { color: '#f8fbff', roughness: 0.9, pattern: 'noise', color2: '#dbe7f5' }),
    M('Checkerboard', 'pattern', { color: '#f1f5f9', color2: '#1f2430', pattern: 'checker', roughness: 0.6, repeatX: 4, repeatY: 4 }), M('Stripes', 'pattern', { color: '#ffd23f', color2: '#1f2430', pattern: 'stripes', roughness: 0.6, repeatX: 3 }), M('Polka dots', 'pattern', { color: '#ff8fab', color2: '#ffffff', pattern: 'dots', roughness: 0.7, repeatX: 2, repeatY: 2 }), M('Grid floor', 'pattern', { color: '#10131a', color2: '#4f7cff', pattern: 'grid', roughness: 0.8, repeatX: 8, repeatY: 8, emissive: '#1b2a55' }),
    M('Neon blue', 'glow', { color: '#0b1020', emissive: '#38d6e8', emissiveIntensity: 1.6, roughness: 0.4 }), M('Neon pink', 'glow', { color: '#200a18', emissive: '#ff4fa3', emissiveIntensity: 1.6, roughness: 0.4 }), M('Lava', 'glow', { color: '#3a0f06', emissive: '#ff5a1f', emissiveIntensity: 1.3, roughness: 0.9, pattern: 'noise', color2: '#ffb02e' }), M('Hologram', 'glow', { color: '#38d6e8', emissive: '#38d6e8', emissiveIntensity: 0.8, opacity: 0.45, wireframe: true, doubleSided: true }),
    M('Low-poly paint', 'stylised', { color: '#6c8cff', roughness: 0.8, flat: true }), M('Wireframe', 'stylised', { color: '#6c8cff', wireframe: true }),
  ];
  const material = (m) => Object.assign({ id: uid('mat'), name: m[0] }, JSON.parse(JSON.stringify(m[2])));

  /* ---------- shader files (custom fragment shaders) ---------- */
  const SHADERS = [
    ['Vignette', 'screen', '// Darkens the corners. uAmount 0–100 sets the strength.\nvoid main() {\n  vec4 c = texture2D(uTex, vUv);\n  float d = distance(vUv, vec2(0.5));\n  float v = smoothstep(0.8, 0.25, d);\n  gl_FragColor = vec4(c.rgb * mix(1.0, v, uAmount), c.a);\n}'],
    ['Scanlines', 'screen', '// Horizontal scanlines. uSize = line spacing in pixels.\nvoid main() {\n  vec4 c = texture2D(uTex, vUv);\n  float line = 0.8 + 0.2 * sin(vUv.y * uRes.y * 3.14159 / max(uSize, 1.0));\n  gl_FragColor = vec4(c.rgb * mix(1.0, line, uAmount), c.a);\n}'],
    ['Duotone', 'colour', '// Maps brightness between black and uColor.\nvoid main() {\n  vec4 c = texture2D(uTex, vUv);\n  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));\n  gl_FragColor = vec4(mix(c.rgb, uColor.rgb * l, uAmount), c.a);\n}'],
    ['Posterize', 'colour', '// Limits each channel to uSize levels (try 4).\nvoid main() {\n  vec4 c = texture2D(uTex, vUv);\n  float n = max(uSize, 2.0);\n  vec3 p = floor(c.rgb * n) / (n - 1.0);\n  gl_FragColor = vec4(mix(c.rgb, p, uAmount), c.a);\n}'],
    ['Chromatic aberration', 'screen', '// Splits red and blue apart. uSize = shift in pixels.\nvoid main() {\n  vec2 o = vec2(uSize, 0.0) * uPx * uAmount;\n  vec4 c = texture2D(uTex, vUv);\n  gl_FragColor = vec4(texture2D(uTex, vUv + o).r, c.g, texture2D(uTex, vUv - o).b, c.a);\n}'],
    ['Night vision', 'screen', '// Green amplified image with grain.\nvoid main() {\n  vec4 c = texture2D(uTex, vUv);\n  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)) * 1.8;\n  float g = fract(sin(dot(vUv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453) * 0.15;\n  vec3 n = vec3(0.1, 1.0, 0.2) * (l + g);\n  gl_FragColor = vec4(mix(c.rgb, n, uAmount), c.a);\n}'],
    ['Edge detect', 'stylised', '// Sobel edges drawn in uColor.\nfloat lum(vec2 uv) { vec3 c = texture2D(uTex, uv).rgb; return dot(c, vec3(0.299, 0.587, 0.114)); }\nvoid main() {\n  vec2 p = uPx * max(uSize, 1.0) * 0.25;\n  float gx = lum(vUv + vec2(p.x, 0.0)) - lum(vUv - vec2(p.x, 0.0));\n  float gy = lum(vUv + vec2(0.0, p.y)) - lum(vUv - vec2(0.0, p.y));\n  float e = clamp(length(vec2(gx, gy)) * 4.0, 0.0, 1.0);\n  vec4 c = texture2D(uTex, vUv);\n  gl_FragColor = vec4(mix(c.rgb, uColor.rgb, e * uAmount), c.a);\n}'],
    ['Heat distortion', 'stylised', '// Wobbling heat haze. uSize = frequency, uA = speed.\nvoid main() {\n  vec2 uv = vUv;\n  uv.x += sin(uv.y * max(uSize, 1.0) + uTime * max(uA, 0.5)) * 0.004 * uAmount;\n  uv.y += cos(uv.x * max(uSize, 1.0) + uTime * max(uA, 0.5)) * 0.004 * uAmount;\n  gl_FragColor = texture2D(uTex, uv);\n}'],
    ['Rainbow outline', 'stylised', '// Animated rainbow glow around opaque shapes.\nvoid main() {\n  vec4 c = texture2D(uTex, vUv);\n  float a = 0.0;\n  for (int i = 0; i < 8; i++) { float t = float(i) * 0.785398; a = max(a, texture2D(uTex, vUv + vec2(cos(t), sin(t)) * uPx * max(uSize, 1.0)).a); }\n  vec3 rb = 0.5 + 0.5 * cos(uTime * 3.0 + vUv.x * 8.0 + vec3(0.0, 2.0, 4.0));\n  vec3 o = mix(rb, c.rgb, c.a);\n  gl_FragColor = vec4(mix(c.rgb, o, uAmount), max(c.a, a * uAmount));\n}'],
  ];
  const shader = (s) => ({ id: uid('shd'), name: s[0], code: s[2] });

  /* ---------- animation clips ---------- */
  const K = (t, v, e) => (e ? { t, v, e } : { t, v });
  const CLIPS = [
    ['Bob up and down', 'idle', 1.2, 'loop', [['y', [K(0, 0, 'sineInOut'), K(0.6, -8, 'sineInOut'), K(1.2, 0)]]], true],
    ['Pulse', 'idle', 0.8, 'loop', [['w', [K(0, 0, 'sineInOut'), K(0.4, 8, 'sineInOut'), K(0.8, 0)]], ['h', [K(0, 0, 'sineInOut'), K(0.4, 8, 'sineInOut'), K(0.8, 0)]]], true],
    ['Spin', 'idle', 2, 'loop', [['rot', [K(0, 0), K(2, 360)]]], true],
    ['Shake', 'impact', 0.4, 'once', [['x', [K(0, 0), K(0.05, -6), K(0.12, 6), K(0.2, -5), K(0.28, 4), K(0.36, -2), K(0.4, 0)]]], true],
    ['Pop in', 'enter', 0.35, 'once', [['alpha', [K(0, 0), K(0.15, 1)]], ['y', [K(0, 20, 'backOut'), K(0.35, 0)]]], true],
    ['Fade out', 'exit', 0.6, 'once', [['alpha', [K(0, 1), K(0.6, 0)]]], false],
    ['Fade in', 'enter', 0.6, 'once', [['alpha', [K(0, 0), K(0.6, 1)]]], false],
    ['Slide in from left', 'enter', 0.5, 'once', [['x', [K(0, -200, 'cubicOut'), K(0.5, 0)]], ['alpha', [K(0, 0), K(0.2, 1)]]], true],
    ['Bounce', 'idle', 0.9, 'loop', [['y', [K(0, 0, 'quadOut'), K(0.45, -30, 'quadIn'), K(0.9, 0)]]], true],
    ['Flash colour', 'impact', 0.3, 'once', [['color', [K(0, '#ffffff'), K(0.15, '#ff4d6d'), K(0.3, '#ffffff')]]], false],
    ['Hover (3D)', 'idle', 2, 'loop', [['y', [K(0, 0, 'sineInOut'), K(1, 0.25, 'sineInOut'), K(2, 0)]], ['ry', [K(0, 0), K(2, 360)]]], true],
  ];
  const clip = (c) => {
    const tracks = c[4].map(([prop, keys]) => ({ prop, keys: JSON.parse(JSON.stringify(keys)) })); // 'scale' tracks hold multipliers; applied as relative to the object's size in the editor note
    return { id: uid('anm'), name: c[0], duration: c[2], loop: c[3], tracks, relative: c[5] === true };
  };

  VX.defaultAssets = {
    kinds: ['sprites', 'sounds', 'models', 'materials', 'shaders', 'animations'],
    catalog(kind) {
      if (kind === 'sprites') return SPRITES.map((e) => ({ key: e[0], name: e[1], tag: e[2], make: () => sprite(e) }));
      if (kind === 'sounds') return [...Object.keys(VX.SOUND_PRESETS), ...Object.keys(SND_EXTRA)].map((k) => ({ key: k, name: k[0].toUpperCase() + k.slice(1), tag: 'sfx', make: () => sound(k, k[0].toUpperCase() + k.slice(1)) }));
      if (kind === 'models') return MODELS.map((m) => ({ key: m[0], name: m[0], tag: m[1], make: () => model(m) }));
      if (kind === 'materials') return MATERIALS.map((m) => ({ key: m[0], name: m[0], tag: m[1], make: () => material(m) }));
      if (kind === 'shaders') return SHADERS.map((s) => ({ key: s[0], name: s[0], tag: s[1], make: () => shader(s) }));
      if (kind === 'animations') return CLIPS.map((c) => ({ key: c[0], name: c[0], tag: c[1], make: () => clip(c) }));
      return [];
    },
    /** Add one default to a project. Returns the created asset. */
    add(project, kind, key) { const e = this.catalog(kind).find((x) => x.key === key); if (!e) return null; const a = e.make(project); project.assets[kind] = project.assets[kind] || {}; project.assets[kind][a.id] = a; return a; },
  };
})();
