// One-time Git LFS setup so the bundled server (vextra-server[.exe], ~100 MB) can be committed.
// Usage: npm run lfs:setup   (needs git and git-lfs: https://git-lfs.com)
const { execFileSync } = require('child_process');
const run = (...a) => { console.log('> git ' + a.join(' ')); return execFileSync('git', a, { stdio: 'inherit' }); };
try { execFileSync('git', ['lfs', 'version'], { stdio: 'ignore' }); } catch { console.error('Git LFS is not installed. Install it from https://git-lfs.com, then run this again.'); process.exit(1); }
run('lfs', 'install');
run('lfs', 'track', 'src-tauri/resources/server/vextra-server', 'src-tauri/resources/server/vextra-server.exe');
console.log('\nDone. Now: git add .gitattributes src-tauri/resources/server && git commit && git push');
console.log('If vextra-server.exe was already committed WITHOUT LFS, convert it: git lfs migrate import --include="src-tauri/resources/server/vextra-server.exe" --everything');
