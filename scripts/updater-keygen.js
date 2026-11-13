#!/usr/bin/env node
/* One-time setup of the signed auto-updater.
     npm run updater:keygen                  → asks for a password (recommended), makes the key pair
     npm run updater:keygen -- --password "" → no password (not recommended)
   It makes a key pair with the Tauri CLI, writes the PUBLIC key into src-tauri/updater/pubkey.txt (commit that file – it is meant to be public)
   and tells you how to store the PRIVATE key as GitHub secrets. The private key stays in your home folder: never commit it, never share it.
   Options: --out <file> (default ~/.tauri/vextra-updater.key)   --password <text>   --force (replace an existing key – old releases can then no longer update!) */
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), pubFile = path.join(root, 'src-tauri', 'updater', 'pubkey.txt');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const out = path.resolve(arg('--out') || path.join(os.homedir(), '.tauri', 'vextra-updater.key')), force = process.argv.includes('--force');
const rel = path.relative(root, out); if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) { console.error('✖ The private key must not live inside the project folder (it could be committed by accident). Use --out with a path outside it.'); process.exit(1); }
if ((fs.existsSync(out) || fs.existsSync(out + '.pub')) && !force) { console.error('✖ ' + out + ' already exists. Keep using it, or pass --force to replace it (releases signed with the old key can then NOT update to new ones).'); process.exit(1); }
fs.mkdirSync(path.dirname(out), { recursive: true });
if (force) for (const f of [out, out + '.pub']) fs.rmSync(f, { force: true });
const pw = arg('--password');
const args = ['tauri', 'signer', 'generate', '-w', out].concat(pw !== undefined ? ['--ci', '-p', pw] : []);
const r = cp.spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0 || !fs.existsSync(out + '.pub')) { console.error('✖ The Tauri CLI did not make a key (is `npm install` done?)'); process.exit(r.status || 1); }
fs.writeFileSync(pubFile, fs.readFileSync(out + '.pub', 'utf8').trim() + '\n');
console.log(`
✔ Key pair made.
   private key : ${out}      (keep it safe – lose it and installed apps can never update again)
   public key  : written to src-tauri/updater/pubkey.txt  → commit this file

Next, store the private key as GitHub repository secrets (Settings → Secrets and variables → Actions), or with the GitHub CLI:
   gh secret set TAURI_SIGNING_PRIVATE_KEY < "${out}"
   gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD        (type the password you chose; skip it if you used none)

Then publish a release: the release workflow signs every installer and attaches latest.json, and apps built from this version on can update themselves.
(Apps built BEFORE the public key was added cannot update themselves – they need one manual install of a release built with it.)`);
