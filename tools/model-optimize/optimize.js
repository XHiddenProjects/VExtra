#!/usr/bin/env node
/* Shrinks a .glb for games: removes duplicates / unused data, compresses geometry (Draco or Meshopt) and textures, keeps skeletons and animations.
 *   node tools/model-optimize/optimize.js character.glb [out.glb] [--compress draco|meshopt|none] [--texture-size 1024] [--webp]
 * Uses the open-source glTF-Transform CLI (downloaded on first use through npx). Vextra Studio loads the result as-is. */
const { spawnSync } = require('child_process'), path = require('path'), fs = require('fs');
const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const compress = flag('--compress', 'meshopt'), size = flag('--texture-size', '1024'), webpI = args.indexOf('--webp'), webp = webpI >= 0; if (webp) args.splice(webpI, 1);
const [input, out] = args; if (!input || !fs.existsSync(input)) { console.error('Usage: node tools/model-optimize/optimize.js model.glb [out.glb] [--compress draco|meshopt|none] [--texture-size 1024] [--webp]'); process.exit(1); }
const output = out || input.replace(/\.(glb|gltf)$/i, '') + '.optimized.glb';
if (!['draco', 'meshopt', 'none'].includes(compress)) { console.error('--compress must be draco, meshopt or none'); process.exit(1); }
const cli = ['--yes', '@gltf-transform/cli', 'optimize', input, output, '--compress', compress, '--texture-size', String(size)]; if (webp) cli.push('--texture-compress', 'webp');
console.log('Optimizing ' + path.basename(input) + ' (' + compress + (webp ? ', webp textures' : '') + ', textures ≤ ' + size + ' px) …');
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', cli, { stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) { console.error('Optimization failed. Is Node.js 18+ installed and are you online (first run downloads the tool)?'); process.exit(r.status || 1); }
const a = fs.statSync(input).size, b = fs.statSync(output).size; console.log('Done: ' + (a / 1e6).toFixed(2) + ' MB → ' + (b / 1e6).toFixed(2) + ' MB (' + Math.round(100 * b / a) + '%) → ' + output);
