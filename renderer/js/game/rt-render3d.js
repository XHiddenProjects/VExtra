/* Vextra game runtime – 3D renderer (three.js). `VXRT.build3D` is shared with the editor viewport so both look identical. */
(function () {
  const VXRT = window.VXRT, U = VXRT.util;
  VXRT.SHADERS_3D = ['none', 'realism', 'toon', 'wireframe', 'unlit', 'glass', 'hologram', 'fresnel', 'gradient', 'custom'];
  const PRIMS = new Set(['cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus', 'capsule', 'pyramid', 'ramp']);
  VXRT.PRIMS_3D = [...PRIMS];

  /* ---------- geometry ---------- */
  function primGeometry(T, type) {
    switch (type) {
      case 'sphere': return new T.SphereGeometry(0.5, 32, 20);
      case 'cylinder': return new T.CylinderGeometry(0.5, 0.5, 1, 32);
      case 'cone': return new T.ConeGeometry(0.5, 1, 32);
      case 'plane': { const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }
      case 'torus': return new T.TorusGeometry(0.35, 0.15, 16, 48);
      case 'capsule': return new T.CapsuleGeometry(0.3, 0.4, 8, 20);
      case 'pyramid': { const g = new T.ConeGeometry(0.7071, 1, 4); g.rotateY(Math.PI / 4); return g; }
      case 'ramp': { const s = new T.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.closePath(); const g = new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; }
      default: return new T.BoxGeometry(1, 1, 1);
    }
  }
  /** Parse a Wavefront .obj text into a BufferGeometry normalised to fit a unit cube. */
  VXRT.parseOBJ = function (T, text) {
    const v = [], pos = [];
    for (const line of text.split(/\r?\n/)) {
      const p = line.trim().split(/\s+/);
      if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
      else if (p[0] === 'f') { const idx = p.slice(1).map((s) => { let i = parseInt(s.split('/')[0], 10); return i < 0 ? v.length + i : i - 1; }); for (let i = 1; i < idx.length - 1; i++) for (const k of [0, i, i + 1]) pos.push(...v[idx[k]]); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.computeBoundingBox();
    const b = g.boundingBox, s = 1 / Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z, 1e-6); g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2); g.scale(s, s, s); return g;
  };

  /* ---------- glTF 2.0 / GLB (static meshes, materials and textures; no skins, animation, Draco or Meshopt) ---------- */
  const GL_CT = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] }, GL_N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const b64bytes = (b64) => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
  const dataUri = (u) => { const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(u); if (!m) throw new Error('only embedded (data:) files are supported – export the glTF as a single .glb'); return { mime: m[1], bytes: m[2] ? b64bytes(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3])) }; };
  /** Splits a .glb file into its JSON and binary chunk. */
  VXRT.glbChunks = function (buf) {
    const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file'); if (dv.getUint32(4, true) !== 2) throw new Error('only glTF 2.0 is supported');
    let off = 12, json = null, bin = null; const end = Math.min(dv.getUint32(8, true), buf.byteLength);
    while (off + 8 <= end) { const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); const body = buf.slice(off + 8, off + 8 + len); if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body)); else if (type === 0x004e4942 && !bin) bin = body; off += 8 + len + ((4 - (len % 4)) % 4); }
    if (!json) throw new Error('the .glb has no JSON part'); return { json, bin };
  };
  /** Builds a THREE.Group from glTF JSON (+ binary chunk). The group is scaled / centred to fit a unit cube. */
  VXRT.buildGLTF = function (T, json, bin) {
    const need = (json.extensionsRequired || []).filter((x) => /draco|meshopt/i.test(x)); if (need.length) throw new Error('compressed models (' + need[0] + ') are not supported – export without compression');
    const buffers = (json.buffers || []).map((b, i) => (b.uri ? dataUri(b.uri).bytes : new Uint8Array(bin || new ArrayBuffer(0), 0, Math.min(b.byteLength, bin ? bin.byteLength : 0))));
    const viewBytes = (i) => { const v = json.bufferViews[i], b = buffers[v.buffer]; return new Uint8Array(b.buffer, b.byteOffset + (v.byteOffset || 0), v.byteLength); };
    const read = (ai) => {
      const a = json.accessors[ai], [Ctor, size] = GL_CT[a.componentType], n = GL_N[a.type], out = new (a.componentType === 5126 || a.normalized ? Float32Array : Ctor)(a.count * n);
      if (a.bufferView != null) {
        const v = json.bufferViews[a.bufferView], bytes = viewBytes(a.bufferView), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), stride = v.byteStride || size * n, base = a.byteOffset || 0;
        const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType], div = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] || 1 : 1;
        for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) { const x = dv[get](base + i * stride + k * size, true); out[i * n + k] = a.normalized ? Math.max(x / div, -1) : x; }
      }
      return out;
    };
    const texCache = new Map(), tex = (ti, srgb) => {
      if (ti == null || !json.textures || !json.textures[ti]) return null; const key = ti + (srgb ? 's' : 'l'); if (texCache.has(key)) return texCache.get(key);
      const t = json.textures[ti], im = json.images && json.images[t.source]; if (!im) return null; let blob;
      try { if (im.uri) { const d = dataUri(im.uri); blob = new Blob([d.bytes], { type: d.mime || 'image/png' }); } else if (im.bufferView != null) blob = new Blob([viewBytes(im.bufferView)], { type: im.mimeType || 'image/png' }); else return null; } catch { return null; }
      const img = new Image(), url = URL.createObjectURL(blob), tx = new T.Texture(img); img.onload = () => { tx.needsUpdate = true; URL.revokeObjectURL(url); }; img.src = url;
      const sm = t.sampler != null && json.samplers ? json.samplers[t.sampler] || {} : {}, wrap = (w) => (w === 33071 ? T.ClampToEdgeWrapping : w === 33648 ? T.MirroredRepeatWrapping : T.RepeatWrapping);
      tx.wrapS = wrap(sm.wrapS); tx.wrapT = wrap(sm.wrapT); tx.flipY = false; tx.anisotropy = 4; if (srgb && T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace; texCache.set(key, tx); return tx;
    };
    const matCache = new Map(), material = (mi, hasColors) => {
      const key = (mi == null ? 'd' : mi) + (hasColors ? 'c' : ''); if (matCache.has(key)) return matCache.get(key); const d = mi == null ? {} : json.materials[mi] || {}, pb = d.pbrMetallicRoughness || {}, bc = pb.baseColorFactor || [1, 1, 1, 1];
      const m = new T.MeshStandardMaterial({ color: new T.Color(bc[0], bc[1], bc[2]), metalness: pb.metallicFactor == null ? 1 : pb.metallicFactor, roughness: pb.roughnessFactor == null ? 1 : pb.roughnessFactor, side: d.doubleSided ? T.DoubleSide : T.FrontSide, vertexColors: !!hasColors });
      const map = tex(pb.baseColorTexture && pb.baseColorTexture.index, true); if (map) m.map = map; const mr = tex(pb.metallicRoughnessTexture && pb.metallicRoughnessTexture.index, false); if (mr) { m.metalnessMap = mr; m.roughnessMap = mr; }
      const nm = tex(d.normalTexture && d.normalTexture.index, false); if (nm) { m.normalMap = nm; const sc = d.normalTexture.scale == null ? 1 : d.normalTexture.scale; m.normalScale = new T.Vector2(sc, sc); }
      const em = tex(d.emissiveTexture && d.emissiveTexture.index, true); const ef = d.emissiveFactor || [0, 0, 0]; m.emissive = new T.Color(ef[0], ef[1], ef[2]); if (em) { m.emissiveMap = em; if (!ef[0] && !ef[1] && !ef[2]) m.emissive.setRGB(1, 1, 1); }
      if (d.alphaMode === 'BLEND') { m.transparent = true; m.opacity = bc[3]; } else if (d.alphaMode === 'MASK') { m.alphaTest = d.alphaCutoff == null ? 0.5 : d.alphaCutoff; }
      m.userData.fromGLB = true; matCache.set(key, m); return m;
    };
    const root = new T.Group(), made = new Map();
    const mesh = (mi) => {
      const me = json.meshes[mi], g = new T.Group(); g.name = me.name || '';
      for (const pr of me.primitives || []) {
        if (pr.mode != null && pr.mode !== 4 && pr.mode !== 5 && pr.mode !== 6) continue; const at = pr.attributes || {}; if (at.POSITION == null) continue;
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(read(at.POSITION), 3)); let colors = null;
        if (at.NORMAL != null) geo.setAttribute('normal', new T.BufferAttribute(read(at.NORMAL), 3)); if (at.TEXCOORD_0 != null) geo.setAttribute('uv', new T.BufferAttribute(read(at.TEXCOORD_0), 2));
        if (at.COLOR_0 != null) { const a = read(at.COLOR_0), n = GL_N[json.accessors[at.COLOR_0].type]; colors = n === 3 ? a : (() => { const c = new Float32Array((a.length / 4) * 3); for (let i = 0, j = 0; i < a.length; i += 4, j += 3) { c[j] = a[i]; c[j + 1] = a[i + 1]; c[j + 2] = a[i + 2]; } return c; })(); geo.setAttribute('color', new T.BufferAttribute(colors, 3)); }
        let idx = pr.indices != null ? read(pr.indices) : null; if (!idx) { const c = geo.getAttribute('position').count; idx = new Uint32Array(c); for (let i = 0; i < c; i++) idx[i] = i; }
        if (pr.mode === 5 || pr.mode === 6) { const t = []; for (let i = 2; i < idx.length; i++) { if (pr.mode === 5) t.push(i % 2 ? idx[i - 1] : idx[i - 2], i % 2 ? idx[i - 2] : idx[i - 1], idx[i]); else t.push(idx[0], idx[i - 1], idx[i]); } idx = Uint32Array.from(t); }
        geo.setIndex(new T.BufferAttribute(idx instanceof Uint32Array ? idx : Uint32Array.from(idx), 1)); if (at.NORMAL == null) geo.computeVertexNormals();
        const m = new T.Mesh(geo, material(pr.material, !!colors)); m.castShadow = m.receiveShadow = true; m.userData.keepColor = true; g.add(m);
      }
      return g;
    };
    const node = (ni, depth) => {
      if (depth > 64) return null; const nd = json.nodes[ni], o = new T.Object3D(); o.name = nd.name || '';
      if (nd.matrix) o.applyMatrix4(new T.Matrix4().fromArray(nd.matrix)); else { if (nd.translation) o.position.fromArray(nd.translation); if (nd.rotation) o.quaternion.fromArray(nd.rotation); if (nd.scale) o.scale.fromArray(nd.scale); }
      if (nd.mesh != null && json.meshes && json.meshes[nd.mesh]) o.add(mesh(nd.mesh)); for (const c of nd.children || []) { const ch = node(c, depth + 1); if (ch) o.add(ch); } return o;
    };
    const sc = (json.scenes && json.scenes[json.scene || 0]) || { nodes: (json.nodes || []).map((_, i) => i).filter((i) => !(json.nodes || []).some((n) => (n.children || []).includes(i))) };
    for (const ni of sc.nodes || []) { const o = node(ni, 0); if (o) root.add(o); }
    root.updateMatrixWorld(true); const box = new T.Box3().setFromObject(root); if (box.isEmpty()) throw new Error('the model has no meshes');
    const sz = new T.Vector3(), c = new T.Vector3(); box.getSize(sz); box.getCenter(c); const k = 1 / Math.max(sz.x, sz.y, sz.z, 1e-6), wrap = new T.Group(); root.position.sub(c); const holder = new T.Group(); holder.add(root); holder.scale.setScalar(k); wrap.add(holder); return wrap;
  };
  const glbMem = new WeakMap();
  VXRT.glbBytes = function (as) { if (glbMem.has(as)) return glbMem.get(as); const d = String(as.data || ''), i = d.indexOf(','), u8 = b64bytes(i >= 0 ? d.slice(i + 1) : d), buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); glbMem.set(as, buf); return buf; };
  /** Voxel model -> merged geometry with per-vertex colours, hidden faces culled. */
  VXRT.voxelGeometry = function (T, model) {
    const key = (x, y, z) => x + ',' + y + ',' + z, set = new Map(); for (const [x, y, z, c] of model.voxels || []) set.set(key(x, y, z), c);
    const pos = [], col = [], nor = [], idx = []; const pal = (model.palette || ['#ffffff']).map((h) => new T.Color(h));
    const faces = [[1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [-1, 0, 0, [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]], [0, 1, 0, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]], [0, 0, 1, [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [0, 0, -1, [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]];
    let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
    for (const [x, y, z, c] of model.voxels || []) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y + 1); maxZ = Math.max(maxZ, z + 1);
      for (const [dx, dy, dz, corners] of faces) {
        if (set.has(key(x + dx, y + dy, z + dz))) continue; const base = pos.length / 3; const color = pal[c % pal.length] || pal[0];
        for (const [cx, cy, cz] of corners) { pos.push(x + cx, y + cy, z + cz); nor.push(dx, dy, dz); col.push(color.r, color.g, color.b); }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    if (pos.length) { const sx = maxX - minX, sy = maxY - minY, sz = maxZ - minZ, s = 1 / Math.max(sx, sy, sz); g.translate(-(minX + maxX) / 2, -minY - sy / 2, -(minZ + maxZ) / 2); g.scale(s, s, s); } return g;
  };

  /* ---------- materials ---------- */
  function texture(T, env, id, rx, ry) {
    const sp = (env.assets || (env.data && env.data.assets) || {}).sprites?.[id]; if (!sp || !sp.frames || !sp.frames[0]) return null;
    const cache = env.tex3d || (env.tex3d = new Map()); const key = id + ':' + sp.frames[0].length; let t = cache.get(key);
    if (!t) { t = new T.TextureLoader().load(sp.frames[0], () => env.onImageLoad && env.onImageLoad()); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.NearestFilter; cache.set(key, t); }
    const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx || 1, ry || 1); return c;
  }
  /** Procedural pattern textures for material assets (no image needed). */
  VXRT.patternCanvas = function (kind, c1, c2, size) {
    const S = size || 64, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.fillStyle = c1 || '#888'; x.fillRect(0, 0, S, S); x.fillStyle = c2 || '#444'; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (kind === 'checker') { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * S / 8, j * S / 8, S / 8, S / 8); }
    else if (kind === 'stripes') { for (let i = 0; i < 8; i += 2) x.fillRect(i * S / 8, 0, S / 8, S); }
    else if (kind === 'bricks') { for (let r = 0; r < 4; r++) { for (let k = 0; k < 2; k++) x.fillRect(((k * S / 2 + (r % 2) * S / 4) % S), r * S / 4 + 1, S / 2 - 2, S / 4 - 2); } x.globalAlpha = 0.0; }
    else if (kind === 'noise') { for (let i = 0; i < S * 14; i++) { x.globalAlpha = rnd() * 0.5; x.fillRect(rnd() * S, rnd() * S, 2, 2); } }
    else if (kind === 'wood') { x.globalAlpha = 0.5; for (let i = 0; i < 12; i++) { x.fillRect(0, (i * S) / 12 + rnd() * 3, S, 1 + rnd() * 2); } }
    else if (kind === 'grass') { for (let i = 0; i < 260; i++) { x.globalAlpha = 0.25 + rnd() * 0.5; x.fillRect(rnd() * S, rnd() * S, 1, 2 + rnd() * 4); } }
    else if (kind === 'dots') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc((i + 0.5) * S / 4, (j + 0.5) * S / 4, S / 12, 0, 6.3); x.fill(); } }
    else if (kind === 'grid') { x.fillRect(0, 0, S, 2); x.fillRect(0, 0, 2, S); }
    x.globalAlpha = 1; return c;
  };
  /** The material asset (if any) that applies to this object / model. */
  function materialAsset(o, env) {
    const A = (env.assets || (env.data && env.data.assets) || {}), mats = A.materials; if (!mats) return null; const id = o.matAsset || (o.props && o.props.material) || (o.props && o.props.model && A.models && A.models[o.props.model] && A.models[o.props.model].matAsset); return (id && mats[id]) || null;
  }
  VXRT.materialAsset = materialAsset;
  function applyMaterialAsset(T, mat, ma, env, vertexColors) {
    mat.metalness = ma.metalness ?? 0.1; mat.roughness = ma.roughness ?? 0.7; mat.emissive.set(ma.emissive || '#000000'); mat.emissiveIntensity = ma.emissiveIntensity ?? 1; mat.wireframe = !!ma.wireframe; mat.flatShading = !!ma.flat;
    const op = (ma.opacity ?? 1) * mat.opacity; mat.opacity = op; mat.transparent = op < 1; mat.side = ma.doubleSided ? T.DoubleSide : mat.side; if (!vertexColors) mat.color.set(ma.color || '#cccccc');
    let tex = null; if (ma.texture) tex = texture(T, env, ma.texture, ma.repeatX, ma.repeatY);
    if (!tex && ma.pattern && ma.pattern !== 'none') { const cache = env.patTex || (env.patTex = new Map()); const key = [ma.pattern, ma.color, ma.color2].join('|'); let t = cache.get(key); if (!t) { t = new T.CanvasTexture(VXRT.patternCanvas(ma.pattern, ma.color, ma.color2 || '#444')); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; cache.set(key, t); } tex = t.clone(); tex.needsUpdate = true; tex.repeat.set(ma.repeatX || 1, ma.repeatY || 1); if (!vertexColors) mat.color.set('#ffffff'); }
    if (ma.realism && mat.isMeshPhysicalMaterial && VXRT.realismApply) VXRT.realismApply(T, mat, ma, env);
    if (tex) mat.map = tex; if (ma.bump) { const b = texture(T, env, ma.bump, ma.repeatX, ma.repeatY); if (b) { mat.bumpMap = b; mat.bumpScale = ma.bumpScale ?? 1; } }
  }
  function makeMaterial(T, o, env, vertexColors) {
    const m = o.material || {}; const alpha = U.clamp(o.alpha ?? 1, 0, 1), op = (m.opacity ?? 1) * alpha;
    const mat = new (((materialAsset(o, env) || {}).realism && T.MeshPhysicalMaterial) || T.MeshStandardMaterial)({ color: o.color || m.color || '#cccccc', metalness: m.metalness ?? 0.1, roughness: m.roughness ?? 0.7, emissive: m.emissive || '#000000', emissiveIntensity: m.emissiveIntensity ?? 1, transparent: op < 1, opacity: op, wireframe: !!m.wireframe, flatShading: !!m.flat, vertexColors: !!vertexColors, side: o.type === 'plane' ? T.DoubleSide : T.FrontSide });
    if (vertexColors) mat.color.set('#ffffff');
    if (m.texture) { const t = texture(T, env, m.texture, m.repeatX, m.repeatY); if (t) { mat.map = t; } }
    const ma = materialAsset(o, env); if (ma) { applyMaterialAsset(T, mat, ma, env, vertexColors); mat.userData.vxMat = true; }
    return mat;
  }
  const VERT = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';
  function shaderMaterial(T, o, base, env) {
    const sh = o.shader; if (!sh || !sh.name || sh.name === 'none') return base;
    const col = new T.Color(sh.color || o.color || '#6c8cff'); const U3 = { uTime: { value: 0 }, uColor: { value: col }, uColor2: { value: new T.Color(sh.color2 || '#34e1c5') }, uAmount: { value: U.num(sh.amount, 1) } };
    const mk = (frag, extra) => { const m = new T.ShaderMaterial(Object.assign({ uniforms: U3, vertexShader: VERT, fragmentShader: frag, transparent: true }, extra || {})); m.isVxShader = true; return m; };
    switch (sh.name) {
      case 'toon': { const m = new T.MeshToonMaterial({ color: o.color || '#cccccc', map: base.map || null, vertexColors: base.vertexColors }); return m; }
      case 'wireframe': return new T.MeshBasicMaterial({ color: sh.color || o.color || '#6c8cff', wireframe: true });
      case 'unlit': return new T.MeshBasicMaterial({ color: o.color || '#cccccc', map: base.map || null, vertexColors: base.vertexColors });
      case 'glass': return new T.MeshStandardMaterial({ color: o.color || '#bfe8ff', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35 });
      case 'hologram': return mk('uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0); float scan=0.5+0.5*sin(vUv.y*80.0-uTime*4.0); gl_FragColor=vec4(uColor*(0.35+f*1.4)*(0.6+0.4*scan),0.35+f*0.6); }', { blending: T.AdditiveBlending, depthWrite: false });
      case 'fresnel': return mk('uniform vec3 uColor; uniform vec3 uColor2; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),3.0); gl_FragColor=vec4(mix(uColor,uColor2,f),1.0); }', { transparent: false });
      case 'gradient': return mk('uniform vec3 uColor; uniform vec3 uColor2; varying vec2 vUv; void main(){ gl_FragColor=vec4(mix(uColor2,uColor,vUv.y),1.0); }', { transparent: false });
      case 'realism': return VXRT.realismMaterial ? VXRT.realismMaterial(T, o, base, sh, env) : base;
      case 'custom': { if (sh.file) { try { const as = ((env.assets || (env.data && env.data.assets) || {}).shaders || {})[sh.file]; if (!as) return base; const U3b = { uTime: { value: 0 }, uT: { value: 0 }, uColor: { value: new T.Vector4(col.r, col.g, col.b, 1) }, uAmount: { value: U.num(sh.amount, 1) }, uSize: { value: U.num(sh.size, 8) }, uA: { value: U.num(sh.a, 0) }, uB: { value: U.num(sh.b, 0) }, uRes: { value: new T.Vector2(1, 1) }, uPos: { value: new T.Vector2(0.5, 0.5) }, uDir: { value: new T.Vector2(1, 0) }, uScale: { value: 1 } }; const m = new T.ShaderMaterial({ uniforms: U3b, vertexShader: VERT, fragmentShader: VXRT.fxCustomFrag3D(as.code), transparent: false }); m.isVxShader = true; m.userData.u3 = U3b; return m; } catch { return base; } }
        try { return mk(sh.code && sh.code.includes('main') ? 'precision highp float; uniform float uTime; uniform vec3 uColor; uniform vec3 uColor2; uniform float uAmount; varying vec2 vUv; varying vec3 vN; varying vec3 vV; ' + sh.code : 'uniform vec3 uColor; void main(){ gl_FragColor=vec4(uColor,1.0); }', { transparent: false }); } catch { return base; } }
      default: return base;
    }
  }
  VXRT.applyShader3D = function (T, o, env) {
    const root = o.obj3d; if (!root) return; root.traverse((ch) => { if (ch.isMesh && ch.userData.baseMat) { ch.material = shaderMaterial(T, o, ch.userData.baseMat, env); } });
  };

  /* ---------- object builder ---------- */
  VXRT.build3D = function (T, o, env) {
    const p = o.props || {}; let root;
    if (o.type === 'light') {
      const kind = p.kind || 'point', color = o.color || '#ffffff', inten = U.num(p.intensity, 1);
      let L; if (kind === 'directional') { L = new T.DirectionalLight(color, inten * 2); L.castShadow = p.shadows !== false; L.shadow.mapSize.set(1024, 1024); const c = L.shadow.camera; c.left = c.bottom = -30; c.right = c.top = 30; c.near = 0.5; c.far = 120; }
      else if (kind === 'spot') { L = new T.SpotLight(color, inten * 60, 0, U.rad(U.num(p.angle, 40)), 0.4); L.castShadow = p.shadows !== false; }
      else if (kind === 'ambient') L = new T.AmbientLight(color, inten); else if (kind === 'hemisphere') L = new T.HemisphereLight(color, '#223', inten); else { L = new T.PointLight(color, inten * 120, U.num(p.range, 0)); L.castShadow = !!p.shadows; }
      L.userData.isLight = true; root = L;
    } else if (o.type === 'camera' || o.type === 'empty') { root = new T.Group(); }
    else if (o.type === 'model') {
      const as = (env.assets || (env.data && env.data.assets) || {}).models?.[p.model]; root = new T.Group();
      if (as) { const part = buildModel(T, as, o, env); root.add(part); }
      else { const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: '#ff5577', wireframe: true })); root.add(m); }
    } else if (o.type === 'text') {
      /* 3D text: a flat plane showing the text (kept up to date every frame, so {score} etc. work). Great for VR / AR, where the screen HUD is not visible. */
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.max(64, Math.round(1024 * (U.num(o.h, 1) / Math.max(0.01, U.num(o.w, 1))))); const tx = new T.CanvasTexture(cv); if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false })); m.userData.txt = { cv, tx, last: null }; m.castShadow = m.receiveShadow = false; root = m; try { VXRT.refreshText3D(env || {}, o, m); } catch { /* drawn on the first frame */ }
    } else if (VXRT.objectTypes && VXRT.objectTypes[o.type] && VXRT.objectTypes[o.type].build) {
      try { root = VXRT.objectTypes[o.type].build(T, o, env) || new T.Group(); } catch (e) { console.warn('Object type ' + o.type + ' build failed: ' + e.message); root = new T.Group(); }
    } else {
      const geo = primGeometry(T, PRIMS.has(o.type) ? o.type : 'cube'); const mat = makeMaterial(T, o, env); const mesh = new T.Mesh(geo, mat); mesh.userData.baseMat = mat; mesh.castShadow = o.castShadow !== false; mesh.receiveShadow = o.receiveShadow !== false; root = mesh;
    }
    root.userData.vxObj = o; root.traverse((c) => { c.userData.vxObj = o; if (o.layer === 'background') { c.renderOrder = -10; if (c.material && !Array.isArray(c.material)) c.material.depthWrite = false; } }); return root;
  };
  function buildModel(T, as, o, env) {
    const g = new T.Group();
    if (as.kind === 'voxel') { const geo = VXRT.voxelGeometry(T, as); const mat = makeMaterial(T, o, env, true); const m = new T.Mesh(geo, mat); m.userData.baseMat = mat; m.castShadow = m.receiveShadow = true; g.add(m); }
    else if (as.kind === 'obj') { const geo = VXRT.parseOBJ(T, as.text || ''); const mat = makeMaterial(T, o, env); const m = new T.Mesh(geo, mat); m.userData.baseMat = mat; m.castShadow = m.receiveShadow = true; g.add(m); }
    else if (as.kind === 'glb' || as.kind === 'gltf') {
      try { let json, bin = null; if (as.kind === 'glb') { const c = VXRT.glbChunks(VXRT.glbBytes(as)); json = c.json; bin = c.bin; } else json = JSON.parse(as.text || '{}'); g.add(VXRT.buildGLTF(T, json, bin)); }
      catch (e) { console.warn('3D model "' + (as.name || '') + '" could not be loaded: ' + e.message); const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xff3366, wireframe: true })); g.add(m); }
    }
    else if (as.kind === 'group') {
      for (const part of as.parts || []) {
        const sub = Object.assign({ type: 'cube', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, w: 1, h: 1, d: 1, color: '#cccccc', alpha: 1, material: {}, props: {} }, part);
        const mesh = VXRT.build3D(T, sub, env); mesh.position.set(sub.x, sub.y, sub.z); mesh.rotation.set(U.rad(sub.rx), U.rad(sub.ry), U.rad(sub.rz), 'YXZ'); mesh.scale.set(sub.w, sub.h, sub.d); mesh.traverse((c) => { if (c.userData) c.userData.keepColor = true; }); g.add(mesh);
      }
      const box = new T.Box3().setFromObject(g); const sz = new T.Vector3(); box.getSize(sz); const s = 1 / Math.max(sz.x, sz.y, sz.z, 1e-6); const c = new T.Vector3(); box.getCenter(c);
      g.children.forEach((ch) => { ch.position.sub(c); ch.position.multiplyScalar(s); ch.scale.multiplyScalar(s); });
    }
    return g;
  }
  VXRT.syncTransform3D = function (T, o) {
    const r = o.obj3d; if (!r) return; const fx = o.fxo || {}; r.position.set(o.x + (fx.x || 0), o.y + (fx.y || 0), o.z); r.rotation.set(U.rad(o.rx), U.rad(o.ry), U.rad(o.rz + (fx.rot || 0)), 'YXZ');
    if (!r.userData.isLight && o.type !== 'camera') r.scale.set(o.w * (o.flipX ? -1 : 1) * (fx.sx || 1), o.h * (o.flipY ? -1 : 1) * (fx.sy || 1), o.d * (fx.sx || 1));
  };

  /* ---------- runtime hooks ---------- */
  /** A soft sky/ground studio environment so metallic and glossy materials have something to reflect. */
  VXRT.studioEnv = function (T, renderer, scene) {
    try {
      const key = renderer.__vxEnv; let tex = key; if (!tex) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#cfe3ff'); gr.addColorStop(0.48, '#ffffff'); gr.addColorStop(0.5, '#6b7385'); gr.addColorStop(1, '#2a3047'); x.fillStyle = gr; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.fillRect(40, 18, 40, 14); x.fillRect(170, 26, 50, 10);
        const eq = new T.CanvasTexture(cv); eq.mapping = T.EquirectangularReflectionMapping; eq.colorSpace = T.SRGBColorSpace; const pm = new T.PMREMGenerator(renderer); tex = pm.fromEquirectangular(eq).texture; pm.dispose(); eq.dispose(); renderer.__vxEnv = tex; }
      scene.environment = tex; if ('environmentIntensity' in scene) scene.environmentIntensity = 0.55;
    } catch (e) { /* PMREM unavailable: metals simply look darker */ }
  };
  VXRT.setupScene3D = function (g, sc) {
    const T = window.THREE; if (!T) throw new Error('This scene is 3D but three.js is not loaded');
    if (!g.canvas3d) { const c = document.createElement('canvas'); c.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%'; g.stageEl.append(c); g.canvas3d = c; g.renderer3d = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: !!g.opts.preserveBuffer }); g.renderer3d.shadowMap.enabled = true; g.renderer3d.shadowMap.type = T.PCFShadowMap; g.renderer3d.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); }
    g.canvas3d.style.display = 'block';
    const env = sc.env || {}; g.scene3d = new T.Scene(); g.THREE = T; VXRT.studioEnv(T, g.renderer3d, g.scene3d);
    if (env.skyMode === 'gradient') { const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256; const x = cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, env.skyTop || '#3a6bd8'); gr.addColorStop(1, env.skyBottom || '#cfe8ff'); x.fillStyle = gr; x.fillRect(0, 0, 2, 256); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; g.scene3d.background = t; } else g.scene3d.background = new T.Color(env.sky || sc.bg || '#1a2233');
    if (env.fog) g.scene3d.fog = new T.Fog(env.fogColor || env.sky || '#1a2233', U.num(env.fogNear, 20), U.num(env.fogFar, 120));
    if (env.ambient !== false) g.scene3d.add(new T.AmbientLight(env.ambientColor || '#ffffff', U.num(env.ambientIntensity, 0.45)));
    g.renderer3d.shadowMap.enabled = env.shadows !== false;
    g.cam3d = { mode: 'fixed', fov: 60, pos: { x: 8, y: 6, z: 10 }, target: { x: 0, y: 1, z: 0 }, follow: null, distance: 8, height: 3, lerp: 0.1, yaw: 0, pitch: 0, shake: 0, eye: 1.6 };
    const c3 = sc.camera3d || {}; Object.assign(g.cam3d, c3); g.camera3d = new T.PerspectiveCamera(g.cam3d.fov, 1, 0.1, 1000); g.tex = g.tex || new Map();
    g.renderer3d.setClearColor(env.sky || '#1a2233'); g.raycaster3d = new T.Raycaster(); g.particles3d = null; if (g.realismOn && VXRT.realism) VXRT.realism.apply(g);
  };
  VXRT.onObjectAdded = function (g, o) {
    if (g.dim !== '3d' || !g.scene3d) return; const T = g.THREE; if (o.isScene) return;
    g.imgs = g.imgs || new Map(); g.assets = g.data.assets; const obj = VXRT.build3D(T, o, g); o.obj3d = obj; g.scene3d.add(obj); if (g.realismOn && VXRT.realism && obj.userData && obj.userData.isLight) VXRT.realism.tuneLight(obj); VXRT.syncTransform3D(T, o);
    if (o.shader && o.shader.name) VXRT.applyShader3D(T, o, g);
    if (o.type === 'camera' && !g._camObj) { g._camObj = o; Object.assign(g.cam3d.pos, { x: o.x, y: o.y, z: o.z }); const d = new T.Vector3(0, 0, -1).applyEuler(new T.Euler(U.rad(o.rx), U.rad(o.ry), U.rad(o.rz), 'YXZ')); g.cam3d.target = { x: o.x + d.x * 10, y: o.y + d.y * 10, z: o.z + d.z * 10 }; if (o.props.fov) g.cam3d.fov = o.props.fov; }
  };
  VXRT.onObjectRemoved = function (g, o) { if (o.obj3d && g.scene3d) { g.scene3d.remove(o.obj3d); o.obj3d.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); o.obj3d = null; } if (g._camObj === o) g._camObj = null; };
  VXRT.resize3D = function (g, cw, ch) { if (!g.renderer3d) return; g.renderer3d.setSize(cw, ch, false); if (g.camera3d) { g.camera3d.aspect = cw / ch; g.camera3d.updateProjectionMatrix(); } };
  VXRT.destroy3D = function (g) { if (g.renderer3d) { g.renderer3d.dispose(); g.renderer3d = null; } };
  VXRT.worldToScreen3D = (g, o) => { if (!g.camera3d) return { x: 0, y: 0 }; const T = g.THREE, v = new T.Vector3(o.x, o.y, o.z).project(g.camera3d); return { x: (v.x * 0.5 + 0.5) * g.container.clientWidth, y: (-v.y * 0.5 + 0.5) * g.container.clientHeight }; };
  VXRT.isInView3D = (g, o) => { if (!g.camera3d) return true; const T = g.THREE; const f = new T.Frustum(); f.setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(g.camera3d.projectionMatrix, g.camera3d.matrixWorldInverse)); return f.intersectsSphere(new T.Sphere(new T.Vector3(o.x, o.y, o.z), Math.max(o.w, o.h, o.d) / 2)); };
  VXRT.pick3D = function (g, sx, sy) {
    if (!g.camera3d) return null; const T = g.THREE, w = g.container.clientWidth, h = g.container.clientHeight; g.raycaster3d.setFromCamera(new T.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), g.camera3d);
    const meshes = []; for (const o of g.objects) if (o.obj3d && o.alive && o.visible && !o.isScene) meshes.push(o.obj3d); const hits = g.raycaster3d.intersectObjects(meshes, true); return hits.length ? hits[0].object.userData.vxObj : null;
  };

  /** F3: 1st person → 3rd person (back) → 3rd person (front); called once per frame from the game loop */
  /** the camera mode that is really being drawn: 'fps' or 'follow' can be switched with the view key, so c.mode alone can be wrong */
  VXRT.camMode = function (g) { const c = g.cam3d; if (!c) return 'fixed'; if ((c.mode === 'fps' || c.mode === 'follow') && c.follow && c.follow.alive && g.camView !== undefined) return g.camView === 0 ? 'fps' : 'follow'; return c.mode; };
  VXRT.cycleCamView = function (g) { const c = g.cam3d; if (!c || !(c.follow && c.follow.alive) || !(c.mode === 'fps' || c.mode === 'follow')) return; if (g.camView === undefined) g.camView = c.mode === 'fps' ? 0 : 1; g.camView = (g.camView + 1) % 3; g.camViewName = ['1st person', '3rd person – back', '3rd person – front'][g.camView]; g.camViewT = 1.6; g.emit('cameraView', ['first', 'back', 'front'][g.camView]); };
  /** redraw a 3D text object when its text (with {variables} filled in) changed; optionally turn it to face the camera */
  VXRT.refreshText3D = function (g, o, mesh) {
    const m = mesh || o.obj3d, t = m.userData.txt, p = o.props || {}, str = U.tpl(p.text ?? 'Text', Object.assign({}, g.vars, g.sceneVars || {})), key = str + '|' + o.color + '|' + p.size + '|' + p.align + '|' + p.bold + '|' + (p.bg || '');
    if (t.last !== key) { t.last = key; const cx = t.cv.getContext('2d'), W = t.cv.width, H = t.cv.height; cx.clearRect(0, 0, W, H); if (p.bg) { cx.fillStyle = p.bg; cx.beginPath(); cx.roundRect ? cx.roundRect(0, 0, W, H, 40) : cx.rect(0, 0, W, H); cx.fill(); }
      const px = U.clamp(U.num(p.size, 28), 6, 200) * 2.4; cx.font = `${p.bold === false ? 400 : 700} ${px}px ${p.font || 'system-ui, sans-serif'}`; cx.fillStyle = o.color || '#ffffff'; cx.textBaseline = 'middle'; const al = p.align || 'center'; cx.textAlign = al; const x = al === 'left' ? 24 : al === 'right' ? W - 24 : W / 2;
      const lines = String(str).split('\n'); lines.forEach((ln, i) => cx.fillText(ln, x, H / 2 + (i - (lines.length - 1) / 2) * px * 1.2, W - 48)); t.tx.needsUpdate = true; }
    if (p.billboard && g.camera3d) { const c = g.camera3d.position; m.rotation.set(0, Math.atan2(c.x - o.x, c.z - o.z), 0); }
  };
  VXRT.render3D = function (g, dt) {
    const T = g.THREE; if (!g.renderer3d || !g.scene3d) return; const c = g.cam3d, cam = g.camera3d;
    // sync objects
    for (const o of g.objects) {
      if (!o.obj3d) continue; VXRT.syncTransform3D(T, o); if (o.type === 'text' && o.obj3d.userData.txt) VXRT.refreshText3D(g, o); const vis = o.visible && o.enabled; if (o.obj3d.visible !== vis) o.obj3d.visible = vis;
      if (o.dirty3d) { o.dirty3d = false; if (o.obj3d) { g.scene3d.remove(o.obj3d); VXRT.onObjectAdded(g, o); } continue; }
      if (o.obj3d.isMesh || o.obj3d.type === 'Group') o.obj3d.traverse((m) => {
        if (!m.isMesh) return; const mat = m.userData.baseMat; if (mat) {
          if (o._lastColor !== o.color && !mat.map && !mat.vertexColors && !m.userData.keepColor && !mat.userData.vxMat) { mat.color.set(o.color); }
          const op = U.clamp(o.alpha, 0, 1) * ((o.material && o.material.opacity) ?? 1); if (mat.opacity !== op) { mat.opacity = op; mat.transparent = op < 1; mat.needsUpdate = true; }
          if (o.material) { if (o.material.metalness !== undefined) mat.metalness = o.material.metalness; if (o.material.roughness !== undefined) mat.roughness = o.material.roughness; if (o.material.emissive) mat.emissive.set(o.material.emissive); mat.wireframe = !!o.material.wireframe; }
        }
        if (m.material && m.material.isVxShader) m.material.uniforms.uTime.value = g.time;
      });
      o._lastColor = o.color;
      if (o.shaderDirty) { o.shaderDirty = false; VXRT.applyShader3D(T, o, g); }
    }
    // camera
    const fo = c.follow && c.follow.alive ? c.follow : null; const k = c.lerp >= 1 ? 1 : 1 - Math.pow(1 - c.lerp, dt * 60 + 0.0001);
    /* F3 cycles the view of the followed object: 1st person → 3rd person (behind) → 3rd person (front) */
    let cm = c.mode, yo = 0; if (fo && (c.mode === 'fps' || c.mode === 'follow')) {
      if (g.camView === undefined) g.camView = c.mode === 'fps' ? 0 : 1;
      cm = g.camView === 0 ? 'fps' : 'follow'; yo = g.camView === 2 ? 180 : 0; if (cm === 'follow' && c.mode === 'fps') { c.distance = c.distance || 6; }
    }
    if (g.camViewT > 0) { g.camViewT -= dt; if (g.container && !g._camLbl) { g._camLbl = document.createElement('div'); g._camLbl.style.cssText = 'position:absolute;left:50%;top:12px;transform:translateX(-50%);padding:4px 12px;border-radius:14px;background:rgba(0,0,0,.6);color:#fff;font:600 12px system-ui;pointer-events:none;z-index:5;transition:opacity .3s'; g.container.appendChild(g._camLbl); } if (g._camLbl) { g._camLbl.textContent = '📷 ' + g.camViewName + '  (F3)'; g._camLbl.style.opacity = g.camViewT > 0 ? 1 : 0; } } else if (g._camLbl) g._camLbl.style.opacity = 0;
    if (fo && fo.obj3d && cm !== 'fps' && fo._fpsHid) { fo.obj3d.visible = true; fo._fpsHid = false; }
    if (cm === 'follow' && fo) { const yaw = U.rad(c.yaw + yo), pit = U.rad(c.pitch); const dx = Math.sin(yaw) * Math.cos(pit) * c.distance, dz = Math.cos(yaw) * Math.cos(pit) * c.distance, dy = Math.sin(pit) * c.distance + c.height; const tx = fo.x + dx, ty = fo.y + dy, tz = fo.z + dz; c.pos.x += (tx - c.pos.x) * k; c.pos.y += (ty - c.pos.y) * k; c.pos.z += (tz - c.pos.z) * k; c.target = { x: fo.x, y: fo.y + 1, z: fo.z }; }
    else if (c.mode === 'orbit') { const t = fo ? { x: fo.x, y: fo.y, z: fo.z } : c.target; const yaw = U.rad(c.yaw), pit = U.rad(c.pitch); c.pos = { x: t.x + Math.sin(yaw) * Math.cos(pit) * c.distance, y: t.y + Math.sin(pit) * c.distance, z: t.z + Math.cos(yaw) * Math.cos(pit) * c.distance }; c.target = { x: t.x, y: t.y, z: t.z }; }
    else if (cm === 'fps' && fo) { if (fo.obj3d) { fo.obj3d.visible = false; fo._fpsHid = true; } c.pos = { x: fo.x, y: fo.y + c.eye, z: fo.z }; const yaw = U.rad(c.yaw), pit = U.rad(c.pitch); c.target = { x: c.pos.x - Math.sin(yaw) * Math.cos(pit), y: c.pos.y + Math.sin(pit), z: c.pos.z - Math.cos(yaw) * Math.cos(pit) }; }
    if (g.sense) { const SN = VXRT.sense; if (g.sense.vr.active) SN.vrPre(g, c); else if (g.sense.ar.active) SN.arPre(g, c); }
    cam.fov = c.fov; cam.updateProjectionMatrix(); const sh = c.shake > 0 ? c.shake * 0.05 : 0; if (c.shake > 0) c.shake = Math.max(0, c.shake - dt * 20);
    cam.position.set(c.pos.x + (Math.random() - 0.5) * sh, c.pos.y + (Math.random() - 0.5) * sh, c.pos.z + (Math.random() - 0.5) * sh); cam.lookAt(c.target.x, c.target.y, c.target.z); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    // particles
    const P = g.particles || []; if (P.length) {
      if (!g.particles3d) { const geo = new T.BufferGeometry(); const mat = new T.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }); g.particles3d = new T.Points(geo, mat); g.particles3d.frustumCulled = false; g.scene3d.add(g.particles3d); }
      const n = P.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), cc = new T.Color(); P.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; cc.set(p.color); const f = p.fade ? 1 - p.life / p.max : 1; col[i * 3] = cc.r * f; col[i * 3 + 1] = cc.g * f; col[i * 3 + 2] = cc.b * f; });
      g.particles3d.geometry.setAttribute('position', new T.BufferAttribute(pos, 3)); g.particles3d.geometry.setAttribute('color', new T.BufferAttribute(col, 3)); g.particles3d.visible = true; g.particles3d.material.size = Math.max(0.1, (P[0].size || 6) / 24);
    } else if (g.particles3d) g.particles3d.visible = false;
    if (g.sense && g.sense.vr.active && g.sense.vr.mode === 'webxr') { cam.position.set(c.pos.x, c.pos.y, c.pos.z); cam.rotation.set(0, U.rad(g.sense.vr.rig.yaw), 0); cam.updateMatrixWorld(); }
    if (g.sense && g.sense.vr.active && VXRT.sense.vrRender(g, cam)) return; g.renderer3d.render(g.scene3d, cam); VXRT.fx && VXRT.fx.screen(g, g.canvas3d);
  };
})();
