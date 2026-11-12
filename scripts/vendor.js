// Copies third-party browser files (Ace editor, three.js) from node_modules into renderer/vendor.
// Runs automatically after `npm install`. Safe to run again at any time (`npm run vendor`).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const out = (...p) => path.join(root, 'renderer', 'vendor', ...p);
const mk = (d) => fs.mkdirSync(d, { recursive: true });
const cp = (a, b) => { mk(path.dirname(b)); fs.copyFileSync(a, b); };
let n = 0;

if (!fs.existsSync(nm('ace-builds')) || !fs.existsSync(nm('three'))) {
  console.log('[vendor] node_modules not installed yet – run `npm install` first.'); process.exit(0);
}

/* Ace */
const aceSrc = nm('ace-builds', 'src-min-noconflict'), aceDst = out('ace');
fs.rmSync(aceDst, { recursive: true, force: true }); mk(path.join(aceDst, 'snippets'));
const keep = (f) => f === 'ace.js' || /^ext-(language_tools|searchbox|beautify|whitespace|modelist)\.js$/.test(f) || /^(mode|worker)-.*\.js$/.test(f);
for (const f of fs.readdirSync(aceSrc)) if (keep(f)) { cp(path.join(aceSrc, f), path.join(aceDst, f)); n++; }
for (const f of fs.readdirSync(path.join(aceSrc, 'snippets'))) if (f.endsWith('.js')) { cp(path.join(aceSrc, 'snippets', f), path.join(aceDst, 'snippets', f)); n++; }
const lic = nm('ace-builds', 'LICENSE'); if (fs.existsSync(lic)) cp(lic, path.join(aceDst, 'LICENSE'));

/* three.js (single-file module build, pinned) */
const t = out('three'); fs.rmSync(t, { recursive: true, force: true });
// three >= r17x splits build/three.module.js + three.core.js; bundle them into ONE minified module (the game export inlines a single file)
fs.mkdirSync(t, { recursive: true });
require('esbuild').buildSync({ entryPoints: [nm('three', 'build', 'three.module.js')], bundle: true, format: 'esm', minify: true, legalComments: 'none', outfile: path.join(t, 'three.module.min.js') }); n++;
for (const f of ['OrbitControls', 'TransformControls']) { cp(nm('three', 'examples', 'jsm', 'controls', f + '.js'), path.join(t, f + '.js')); n++; }
const lic3 = nm('three', 'LICENSE'); if (fs.existsSync(lic3)) cp(lic3, path.join(t, 'LICENSE'));
// examples import from the bare specifier 'three'; index.html maps that to ./vendor/three/three.module.min.js
/* glTF toolkit: three's own GLTFLoader (skins, animations, morph targets, KHR_* extensions) + SkeletonUtils + DRACOLoader + Meshopt decoder,
   bundled into ONE script that reads the global THREE (so editor and exported games share the same three.js). Draco's decoder files sit beside it. */
{
  const J = nm('three', 'examples', 'jsm'), tmp = path.join(root, 'scripts', '.gltf-kit-entry.js'), shim = path.join(root, 'scripts', '.three-global-shim.js');
  fs.writeFileSync(shim, 'module.exports = window.THREE;\n');
  fs.writeFileSync(tmp, `import { GLTFLoader } from ${JSON.stringify(path.join(J, 'loaders', 'GLTFLoader.js'))};\nimport { DRACOLoader } from ${JSON.stringify(path.join(J, 'loaders', 'DRACOLoader.js'))};\nimport { MeshoptDecoder } from ${JSON.stringify(path.join(J, 'libs', 'meshopt_decoder.module.js'))};\nimport * as SkeletonUtils from ${JSON.stringify(path.join(J, 'utils', 'SkeletonUtils.js'))};\nwindow.VXGLTF = { GLTFLoader, DRACOLoader, MeshoptDecoder, SkeletonUtils };\n`);
  try {
    require('esbuild').buildSync({ entryPoints: [tmp], bundle: true, format: 'iife', minify: true, legalComments: 'none', outfile: path.join(t, 'gltf-kit.min.js'), alias: { three: shim }, define: { 'import.meta.url': '"https://vextra.invalid/three/examples/jsm/loaders/DRACOLoader.js"' } }); n++;
    for (const f of ['draco_wasm_wrapper.js', 'draco_decoder.wasm']) { cp(path.join(J, 'libs', 'draco', f), path.join(t, 'draco', f)); n++; }
  } finally { fs.rmSync(tmp, { force: true }); fs.rmSync(shim, { force: true }); }
}
/* Model import kit (editor only, loaded on demand – never part of an exported game): FBX / Collada / STL / PLY / 3MF readers + GLTFExporter,
   so models from Blender, Maya, 3ds Max, Cinema 4D, Mixamo, MagicaVoxel exporters, CAD tools … become a game-ready .glb (skeleton and animations kept). */
{
  const J = nm('three', 'examples', 'jsm'), tmp = path.join(root, 'scripts', '.import-kit-entry.js'), shim = path.join(root, 'scripts', '.three-global-shim.js');
  fs.writeFileSync(shim, 'module.exports = window.THREE;\n');
  const L = (...x) => JSON.stringify(path.join(J, ...x));
  fs.writeFileSync(tmp, `import { FBXLoader } from ${L('loaders', 'FBXLoader.js')};\nimport { ColladaLoader } from ${L('loaders', 'ColladaLoader.js')};\nimport { STLLoader } from ${L('loaders', 'STLLoader.js')};\nimport { PLYLoader } from ${L('loaders', 'PLYLoader.js')};\nimport { ThreeMFLoader } from ${L('loaders', '3MFLoader.js')};\nimport { GLTFExporter } from ${L('exporters', 'GLTFExporter.js')};\nwindow.VXIMPORT = { FBXLoader, ColladaLoader, STLLoader, PLYLoader, ThreeMFLoader, GLTFExporter };\n`);
  try { require('esbuild').buildSync({ entryPoints: [tmp], bundle: true, format: 'iife', minify: true, legalComments: 'none', outfile: path.join(t, 'import-kit.min.js'), alias: { three: shim } }); n++; }
  finally { fs.rmSync(tmp, { force: true }); fs.rmSync(shim, { force: true }); }
}
/* sql.js (SQLite compiled to WebAssembly) – powers the built-in database tool */
if (fs.existsSync(nm('sql.js', 'dist', 'sql-wasm.js'))) { const q = out('sqljs'); fs.rmSync(q, { recursive: true, force: true }); cp(nm('sql.js', 'dist', 'sql-wasm.js'), path.join(q, 'sql-wasm.js')); cp(nm('sql.js', 'dist', 'sql-wasm.wasm'), path.join(q, 'sql-wasm.wasm')); const l = nm('sql.js', 'LICENSE'); if (fs.existsSync(l)) cp(l, path.join(q, 'LICENSE')); n += 2; }
console.log('[vendor] copied', n, 'files into renderer/vendor');
