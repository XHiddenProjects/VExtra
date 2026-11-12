/* Vextra – model importer for other tools. Reads FBX (Mixamo, Maya, 3ds Max, Cinema 4D, Blender…), Collada (.dae), STL, PLY and 3MF with three.js' loaders
 * and converts the result to a game-ready .glb (skeleton, skin, animations and embedded textures are kept). The readers live in vendor/three/import-kit.min.js
 * and are loaded only when you import such a file – they are never part of an exported game. */
(function () {
  const EXTS = ['fbx', 'dae', 'stl', 'ply', '3mf'];
  let kitPromise = null;
  const kit = () => window.VXIMPORT ? Promise.resolve(window.VXIMPORT) : (kitPromise ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/three/import-kit.min.js'; s.onload = () => (window.VXIMPORT ? res(window.VXIMPORT) : rej(new Error('import kit missing'))); s.onerror = () => rej(new Error('Could not load the model importer (vendor/three/import-kit.min.js) – run "npm run vendor"')); document.head.append(s); }));
  const toDataURL = (buf) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(new Blob([buf], { type: 'model/gltf-binary' })); });
  const ext = (name) => (/\.([a-z0-9]+)$/i.exec(name) || [])[1]?.toLowerCase() || '';

  /** Reads a file of another 3D format and returns { name, glb: ArrayBuffer, data: 'data:…' (data URL), info: { meshes, bones, clips } }. */
  async function convert(file) {
    const T = window.THREE, K = await kit(), e = ext(file.name); if (!EXTS.includes(e)) throw new Error('unsupported 3D format .' + e);
    let obj, animations = [];
    if (e === 'fbx') { obj = new K.FBXLoader().parse(await file.arrayBuffer(), ''); animations = obj.animations || []; }
    else if (e === 'dae') { const r = new K.ColladaLoader().parse(await file.text(), ''); obj = r.scene; animations = r.animations || []; }
    else if (e === '3mf') { obj = new K.ThreeMFLoader().parse(await file.arrayBuffer()); animations = obj.animations || []; }
    else {
      const geo = e === 'stl' ? new K.STLLoader().parse(await file.arrayBuffer()) : new K.PLYLoader().parse(await file.arrayBuffer());
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      const hasColor = !!geo.getAttribute('color'), mat = new T.MeshStandardMaterial({ color: hasColor ? 0xffffff : 0xb8c4d9, vertexColors: hasColor, roughness: 0.6, metalness: 0.1 });
      obj = new T.Group(); obj.add(geo.index || geo.getAttribute('position').count >= 3 ? new T.Mesh(geo, mat) : new T.Points(geo, new T.PointsMaterial({ size: 0.02 })));
    }
    if (!obj) throw new Error('the file contains no model');
    let meshes = 0, bones = 0; obj.traverse((c) => { if (c.isMesh || c.isSkinnedMesh) meshes++; if (c.isBone) bones++; });
    if (!meshes) throw new Error('the file contains no meshes');
    /* textures that point to files next to the original (not embedded) cannot be read – drop them instead of failing, the material keeps its colour */
    let dropped = 0; obj.traverse((c) => { for (const m of [].concat(c.material || [])) for (const k of Object.keys(m)) { const tx = m[k]; if (tx && tx.isTexture) { const im = tx.image, ok = im && (im.width || im.videoWidth || im.naturalWidth) > 0 && im.complete !== false; if (!ok) { m[k] = null; m.needsUpdate = true; dropped++; } } } });
    animations = animations.filter((a) => a.duration > 0);
    const glb = await new K.GLTFExporter().parseAsync(obj, { binary: true, animations, onlyVisible: false, maxTextureSize: 1024 });
    if (!(glb instanceof ArrayBuffer)) throw new Error('conversion failed');
    return { name: file.name.replace(/\.[^.]+$/, ''), glb, data: await toDataURL(glb), info: { meshes, bones, clips: animations.length, droppedTextures: dropped } };
  }
  VX.modelImport = { exts: EXTS, convert };
})();
