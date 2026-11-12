/* Builds the small sample models used by the "Model Animation" example game and the block's demo clip:
 *   node tools/model-samples/make-samples.js        (needs:  npm i --no-save @gltf-transform/core @gltf-transform/functions draco3dgltf meshoptimizer)
 * Output: tools/model-samples/worm.glb (skeleton + 2 animations), worm-draco.glb, worm-meshopt.glb – plus worm-draco.b64.txt used by the example. */
const fs = require('fs'), path = require('path');
const { Document, NodeIO } = require('@gltf-transform/core');
const { EXTENSIONS_ALL = [] } = (() => { try { return require('@gltf-transform/extensions'); } catch { return {}; } })();
(async () => {
  const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('Scene');
  const SEG = 5, H = 0.5, SIDES = 10, R = 0.28;
  /* joints: a vertical chain */
  const joints = []; let parent = null;
  for (let i = 0; i < SEG; i++) { const j = doc.createNode('joint' + i).setTranslation([0, i ? H : 0, 0]); if (parent) parent.addChild(j); joints.push(j); parent = j; }
  const root = doc.createNode('Worm').addChild(joints[0]); scene.addChild(root);
  /* tube mesh, rings every H/2, weights blend between neighbouring joints */
  const pos = [], nor = [], idx = [], jnt = [], wgt = [], col = []; const rings = SEG * 2 - 1;
  for (let r = 0; r <= rings; r++) {
    const y = r * H / 2, t = y / H, j0 = Math.min(SEG - 1, Math.floor(t)), j1 = Math.min(SEG - 1, j0 + 1), w1 = t - j0, rad = R * (r === rings ? 0.15 : r === 0 ? 0.6 : 1 - 0.07 * (r / rings));
    for (let s = 0; s < SIDES; s++) { const a = s / SIDES * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); pos.push(c * rad, y, sn * rad); nor.push(c, 0, sn); jnt.push(j0, j1, 0, 0); wgt.push(1 - w1, w1, 0, 0); const g = 0.45 + 0.4 * (r / rings); col.push(0.2, g, 0.35, 1); }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < SIDES; s++) { const a = r * SIDES + s, b = r * SIDES + (s + 1) % SIDES, c = a + SIDES, d = b + SIDES; idx.push(a, c, b, b, c, d); }
  const A = (type, arr, Cls) => doc.createAccessor().setType(type).setArray(new Cls(arr)).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', A('VEC3', pos, Float32Array)).setAttribute('NORMAL', A('VEC3', nor, Float32Array)).setAttribute('COLOR_0', A('VEC4', col, Float32Array)).setAttribute('JOINTS_0', A('VEC4', jnt, Uint16Array)).setAttribute('WEIGHTS_0', A('VEC4', wgt, Float32Array)).setIndices(A('SCALAR', idx, Uint16Array)).setMaterial(doc.createMaterial('Skin').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.7).setMetallicFactor(0));
  const mesh = doc.createMesh('Tube').addPrimitive(prim);
  const skin = doc.createSkin('Skeleton').setSkeleton(joints[0]); joints.forEach((j) => skin.addJoint(j)); /* default inverse bind = identity is wrong: set from joint world offsets */
  skin.setInverseBindMatrices(A('MAT4', joints.flatMap((_, i) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -i * H, 0, 1]), Float32Array));
  const body = doc.createNode('Body').setMesh(mesh).setSkin(skin); scene.addChild(body);
  /* animations: Wave (S-shaped sway) and Nod (short bow) */
  const quat = (ax, ay, az, deg) => { const h = deg * Math.PI / 360, s = Math.sin(h); const n = Math.hypot(ax, ay, az) || 1; return [ax / n * s, ay / n * s, az / n * s, Math.cos(h)]; };
  const anim = (name, dur, steps, amp, phase, axis) => {
    const an = doc.createAnimation(name), times = []; for (let k = 0; k <= steps; k++) times.push(dur * k / steps);
    joints.forEach((j, i) => { if (!i) return; const vals = []; for (let k = 0; k <= steps; k++) vals.push(...quat(axis[0], axis[1], axis[2], amp * Math.sin(k / steps * Math.PI * 2 - i * phase))); const sm = doc.createAnimationSampler().setInput(A('SCALAR', times, Float32Array)).setOutput(A('VEC4', vals, Float32Array)).setInterpolation('LINEAR'); an.addSampler(sm); an.addChannel(doc.createAnimationChannel().setTargetNode(j).setTargetPath('rotation').setSampler(sm)); });
  };
  anim('Wave', 2.4, 24, 22, 0.9, [0, 0, 1]); anim('Nod', 1.2, 12, 30, 0.35, [1, 0, 0]);
  const out = __dirname; const io = new NodeIO();
  await io.write(path.join(out, 'worm.glb'), doc); console.log('worm.glb', fs.statSync(path.join(out, 'worm.glb')).size);
})();
