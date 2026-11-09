// Sets up everything an Android build needs – by itself, from scratch, and keeps it up to date.
//   Java (Eclipse Temurin JDK 27), Gradle (latest release) and the Android SDK (command-line tools, platform-tools, newest platform + build-tools)
// are downloaded into  ~/.vextra/toolchain  (your own user folder – no administrator rights, nothing system-wide is changed).
// Nothing that is already installed on the computer is used or looked at (no Android Studio, JAVA_HOME, ANDROID_HOME or PATH lookups): the
// same managed tools are used on every build, so the result does not depend on the machine.
// When a newer version is available it is installed and the OLD VERSION IS DELETED, so the toolchain never grows.
//
//   node scripts/toolchain.js check              what is installed and what would be installed / updated (changes nothing)
//   node scripts/toolchain.js jdk [major]        Java (default 27)         node scripts/toolchain.js gradle [version|latest]
//   node scripts/toolchain.js sdk                Android SDK               node scripts/toolchain.js all     all three
//   node scripts/toolchain.js prune              delete tool versions that are no longer needed
//   node scripts/toolchain.js env                print the resolved environment as JSON
//
// Output lines starting with "@@vx " are progress events for the Vextra checklist:  {"id":"jdk","state":"run|ok|warn|fail","text":"plain sentence"}
// Security: HTTPS only; downloads only from the official hosts below (redirects included); every download is verified against the SHA-256 (SHA-1 for
// Google's repository index when it is the only checksum offered) published by the vendor before it is unpacked; unpacking refuses paths outside the target
// folder; nothing is run through a shell except Gradle's own launcher.
const fs = require('fs'), path = require('path'), os = require('os'), https = require('https'), crypto = require('crypto'), zlib = require('zlib'), cp = require('child_process');
const win = process.platform === 'win32', mac = process.platform === 'darwin';
const ARCH = process.arch === 'arm64' ? 'aarch64' : 'x64';
const ROOT = process.env.VEXTRA_TOOLCHAIN || path.join(os.homedir(), '.vextra', 'toolchain');
const HOSTS = ['api.adoptium.net', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com', 'services.gradle.org', 'downloads.gradle.org', 'downloads.gradle-dn.com', 'developer.android.com', 'dl.google.com'];
const MAX_BYTES = 1200 * 1024 * 1024;
let emitAs = null; const emit = (id, state, text) => console.log('@@vx ' + JSON.stringify({ id: emitAs || id, state, text }));
const setEmitId = (id) => { emitAs = id; };
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ls = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
const exe = (n) => (win ? n + '.exe' : n), bat = (n) => (win ? n + '.bat' : n);

/* ---------- versions ---------- */
const nums = (s) => (String(s).match(/\d+/g) || []).map(Number);
function cmp(a, b) { const x = nums(a), y = nums(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; }

/* ---------- safe https ---------- */
function okHost(u) { return u.protocol === 'https:' && HOSTS.includes(u.hostname); }
function getOnce(url, { binary = false, dest = null, hops = 0, algo = 'sha256' } = {}) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(url); } catch { return reject(new Error('bad address')); }
    if (!okHost(u)) return reject(new Error('blocked address (only official https hosts are allowed): ' + u.hostname));
    const req = https.get(u, { headers: { 'user-agent': 'VextraStudio-toolchain', accept: '*/*' }, timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); if (hops >= 5) return reject(new Error('too many redirects')); return getOnce(new URL(res.headers.location, u).href, { binary, dest, hops: hops + 1, algo }).then(resolve, reject); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' from ' + u.hostname)); }
      const len = +res.headers['content-length'] || 0; if (len > MAX_BYTES) { res.resume(); return reject(new Error('download too large')); }
      if (dest) {
        const h = crypto.createHash(algo); let n = 0; const out = fs.createWriteStream(dest);
        res.on('data', (c) => { n += c.length; h.update(c); if (n > MAX_BYTES) { req.destroy(new Error('download too large')); } if (getOnce.onProgress) getOnce.onProgress(n, len); });
        res.pipe(out); out.on('finish', () => resolve({ sha256: h.digest('hex'), bytes: n })); out.on('error', reject); res.on('error', reject);
      } else { const parts = []; let n = 0; res.on('data', (c) => { n += c.length; if (n > 40 * 1024 * 1024) req.destroy(new Error('answer too large')); parts.push(c); }); res.on('end', () => resolve(binary ? Buffer.concat(parts) : Buffer.concat(parts).toString('utf8'))); }
    });
    req.on('timeout', () => req.destroy(new Error('timed out'))); req.on('error', reject);
  });
}
/** network hiccups (slow CDN, reset connection) are retried up to 4 times with a growing pause */
const TRANSIENT = /timed out|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|aborted|HTTP 5\d\d|HTTP 429/i;
async function get(url, o = {}) { let last; for (let i = 0; i < 4; i++) { try { return await getOnce(url, o); } catch (e) { last = e; if (!TRANSIENT.test(String(e && (e.code || e.message)))) throw e; if (o.dest) { try { fs.unlinkSync(o.dest); } catch { /* none */ } } await new Promise((r) => setTimeout(r, 1500 * (i + 1))); } } throw last; }
const getJson = async (u) => JSON.parse(await get(u));
/** download to a temp file, verify SHA-256, return the file path */
async function fetchVerified(url, sha256, label, id, algo = 'sha256') {
  fs.mkdirSync(ROOT, { recursive: true }); const tmp = path.join(ROOT, '.dl-' + crypto.randomBytes(6).toString('hex'));
  let last = 0; getOnce.onProgress = (n, len) => { const now = Date.now(); if (now - last > 700) { last = now; emit(id, 'run', label + (len ? ' – ' + Math.round(n / len * 100) + '%' : ' – ' + Math.round(n / 1048576) + ' MB')); } };
  try { const r = await get(url, { dest: tmp, algo }); if (!sha256 || String(sha256).toLowerCase() !== r.sha256) { throw new Error('the download did not match its published SHA-256 checksum – it was discarded'); } return tmp; } catch (e) { try { fs.unlinkSync(tmp); } catch { /* none */ } throw e; } finally { getOnce.onProgress = null; }
}

/* ---------- unpacking (zip without extra tools; tar.gz with the system tar) ---------- */
function inside(root, target) { const r = path.resolve(root) + path.sep, t = path.resolve(target); return t === path.resolve(root) || t.startsWith(r); }
function unzip(file, dir) {
  const buf = fs.readFileSync(file); let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; if (e < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged zip'); const made = buf.readUInt16LE(p + 4), method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), attr = buf.readUInt32LE(p + 38), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8'); p += 46 + nlen + xlen + clen;
    const target = path.join(dir, name); if (!inside(dir, target)) throw new Error('unsafe path in archive: ' + name);
    if (name.endsWith('/')) { fs.mkdirSync(target, { recursive: true }); continue; }
    const mode = made >> 8 === 3 ? (attr >>> 16) & 0o7777 : 0, type = made >> 8 === 3 ? (attr >>> 16) & 0o170000 : 0; if (type === 0o120000) continue; // no symlinks
    const lnlen = buf.readUInt16LE(off + 26), lxlen = buf.readUInt16LE(off + 28), start = off + 30 + lnlen + lxlen, data = buf.slice(start, start + csize);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, method === 0 ? data : zlib.inflateRawSync(data)); if (mode && !win) fs.chmodSync(target, mode & 0o777 | 0o200);
  }
}
function untar(file, dir) { fs.mkdirSync(dir, { recursive: true }); const r = cp.spawnSync('tar', ['-xzf', file, '-C', dir], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('could not unpack: ' + (r.stderr || r.error || '').toString().slice(0, 200)); }
function unpack(file, dir, name) { /\.zip$/i.test(name) ? unzip(file, dir) : untar(file, dir); }
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* locked */ } };
const only = (dir) => { const l = ls(dir).filter((x) => !x.startsWith('.')); return l.length === 1 && fs.statSync(path.join(dir, l[0])).isDirectory() ? path.join(dir, l[0]) : dir; };


/* ---------- state, disk space, leftovers ---------- */
const STATE = path.join(ROOT, 'state.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
const writeState = (s) => { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 1)); };
function run(cmd, args, o) { return cp.spawnSync(cmd, args, Object.assign({ encoding: 'utf8', timeout: 120000, shell: win && /\.(bat|cmd)$/i.test(cmd) }, o)); }
function freeBytes(dir) { try { fs.mkdirSync(dir, { recursive: true }); const s = fs.statfsSync(dir); return Number(s.bavail) * Number(s.bsize); } catch { return Infinity; } }
function needSpace(mb, label, id) { const f = freeBytes(ROOT); if (f < mb * 1048576) { emit(id, 'fail', 'Not enough free disk space for ' + label + ': about ' + mb + ' MB are needed, ' + Math.floor(f / 1048576) + ' MB are free. Free some space and try again.'); throw new Error('disk full'); } }
/** leftovers of an interrupted download / unpack are deleted first (they are never reused) */
function cleanTemp() { for (const d of [ROOT, path.join(ROOT, 'jdk'), path.join(ROOT, 'gradle')]) for (const x of ls(d).filter((n) => /^\.(dl|new|old|sdk)-/.test(n))) rmrf(path.join(d, x)); }
/** put a freshly unpacked folder in place of the old one; the old one is deleted only after the new one is in place (and restored if that fails) */
function swapIn(src, dest) { const old = exists(dest) ? dest + '.old-' + Date.now() : null; fs.mkdirSync(path.dirname(dest), { recursive: true }); if (old) fs.renameSync(dest, path.join(path.dirname(dest), '.old-' + path.basename(old))); const oldp = old && path.join(path.dirname(dest), '.old-' + path.basename(old)); try { fs.renameSync(src, dest); } catch (e) { if (oldp) { try { fs.renameSync(oldp, dest); } catch { /* keep going */ } } throw e; } if (oldp) rmrf(oldp); }
const keepOf = (kind, extra) => { const k = (readState().keep || {})[kind]; return new Set([...(Array.isArray(k) ? k : []), ...[].concat(extra == null ? [] : extra)].map(String)); };
function setKeep(kind, list) { const s = readState(); s.keep = Object.assign({}, s.keep, { [kind]: list.map(String) }); writeState(s); }

/* ---------- JAVA ---------- */
const DEFAULT_JAVA = 27;
const javaBin = (h) => path.join(h, 'bin', exe('java'));
const jdkDir = (major) => path.join(ROOT, 'jdk', 'jdk-' + major);
const homeOf = (d) => (mac && exists(path.join(d, 'Contents', 'Home')) ? path.join(d, 'Contents', 'Home') : d);
function javaInfo(home) { if (!home || !exists(javaBin(home))) return null; const r = run(javaBin(home), ['-version']); const m = /version "(\d+)(?:\.(\d+))?[^"]*"/.exec((r.stderr || '') + (r.stdout || '')); if (!m) return null; const major = m[1] === '1' ? +m[2] : +m[1]; const full = (/version "([^"]+)"/.exec(r.stderr || '') || [])[1] || String(major); return { home, major, full, jdk: exists(path.join(home, 'bin', exe('javac'))) }; }
function managedJava(major) {
  const majors = ls(path.join(ROOT, 'jdk')).filter((x) => /^jdk-\d+$/.test(x)).map((x) => +x.slice(4)).sort((a, b) => b - a);
  for (const m of majors) { if (major && m !== +major) continue; const d = jdkDir(m), i = javaInfo(homeOf(d)); if (i && i.jdk) { let release = ''; try { release = fs.readFileSync(path.join(d, '.vextra-version'), 'utf8').trim(); } catch { /* none */ } return Object.assign(i, { source: 'downloaded', dir: d, release }); } }
  return null;
}
async function latestJava(want) {
  const rel = await getJson('https://api.adoptium.net/v3/info/available_releases'); const avail = (rel.available_releases || []).map(Number);
  const major = avail.includes(want) ? want : (avail.filter((v) => v <= want).sort((a, b) => b - a)[0] || rel.most_recent_lts); const os_ = win ? 'windows' : mac ? 'mac' : 'linux';
  const a = await getJson(`https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${ARCH}&image_type=jdk&os=${os_}&vendor=eclipse`); const x = a && a[0]; if (!x || !x.binary || !x.binary.package) throw new Error('no Java download found for this computer');
  const pk = x.binary.package; return { major, release: x.release_name || String(x.version && x.version.semver), version: (x.version && x.version.semver) || x.release_name, url: pk.link, sha256: pk.checksum, name: pk.name };
}
function pruneJava(extra) { const keep = keepOf('java', [DEFAULT_JAVA].concat(extra == null ? [] : extra)); for (const x of ls(path.join(ROOT, 'jdk'))) { const m = /^jdk-(\d+)$/.exec(x); if (!m || !keep.has(m[1])) rmrf(path.join(ROOT, 'jdk', x)); } }
async function ensureJava(opts = {}) {
  const want = +opts.major || DEFAULT_JAVA; cleanTemp(); emit('jdk', 'run', 'Looking for Java …');
  let latest = null; try { latest = await latestJava(want); } catch { /* offline */ }
  const have = managedJava(latest ? latest.major : want) || (latest ? null : managedJava()); const same = have && latest && have.release === latest.release;
  if (opts.check) { if (!have) emit('jdk', 'warn', latest ? 'Java ' + latest.major + ' is not installed – it will be downloaded automatically' : 'Java is not installed (and the download service cannot be reached right now)'); else if (!latest) emit('jdk', 'ok', 'Java ' + have.full + ' installed – could not check for a newer version'); else if (same) emit('jdk', 'ok', 'Java ' + have.full + ' installed – up to date'); else emit('jdk', 'warn', 'Java ' + have.full + ' installed – the newer ' + latest.release + ' will replace it (the old one is deleted)'); return have; }
  if (same) { emit('jdk', 'ok', 'Java ' + have.full + ' is up to date'); pruneJava(have.major); return have; }
  if (!latest) { if (have) { emit('jdk', 'warn', 'Java ' + have.full + ' will be used (could not check for a newer version: no internet?)'); return have; } emit('jdk', 'fail', 'Java is not installed and could not be downloaded (no internet?). Connect to the internet and try again.'); throw new Error('no java'); }
  needSpace(1100, 'Java', 'jdk'); emit('jdk', 'run', 'Downloading Java ' + latest.major + ' (' + latest.version + ') …');
  let f; try { f = await fetchVerified(latest.url, latest.sha256, 'Downloading Java ' + latest.major, 'jdk'); } catch (e) { if (have) { emit('jdk', 'warn', 'Java ' + latest.major + ' could not be downloaded (' + e.message + ') – the installed Java ' + have.full + ' will be used'); return have; } emit('jdk', 'fail', 'Java could not be downloaded: ' + e.message); throw e; }
  emit('jdk', 'run', 'Unpacking Java …'); const tmp = path.join(ROOT, 'jdk', '.new-' + Date.now()); try { unpack(f, tmp, latest.name); } finally { try { fs.unlinkSync(f); } catch { /* gone */ } }
  const dest = jdkDir(latest.major); try { swapIn(only(tmp), dest); } finally { rmrf(tmp); }
  const m = managedJava(latest.major); if (!m) { rmrf(dest); emit('jdk', 'fail', 'Java was unpacked but does not run on this computer.'); throw new Error('java does not run'); }
  try { fs.writeFileSync(path.join(dest, '.vextra-version'), latest.release); } catch { /* optional */ } pruneJava(latest.major);
  emit('jdk', 'ok', (have ? 'Updated to Java ' : 'Installed Java ') + m.full + (have ? ' (the old version was deleted)' : '')); m.release = latest.release; return m;
}

/* ---------- GRADLE ---------- */
const gradleBin = (h) => path.join(h, 'bin', bat('gradle'));
const GRADLE_HOME_DIR = path.join(ROOT, 'gradle-home'); // Gradle's own cache / daemon folder lives here too, so old versions can be cleaned up
function managedGradle(version) { const d = path.join(ROOT, 'gradle'); for (const x of ls(d).filter((y) => /^gradle-\d/.test(y)).sort((a, b) => cmp(a.slice(7), b.slice(7))).reverse()) { if (version && version !== 'latest' && x.slice(7) !== version) continue; if (exists(gradleBin(path.join(d, x)))) return { home: path.join(d, x), version: x.slice(7), source: 'downloaded' }; } return null; }
async function latestGradle() { const j = await getJson('https://services.gradle.org/versions/current'); if (!j || !j.version || !j.downloadUrl) throw new Error('unexpected answer'); let sum = j.checksum; if (!sum && j.checksumUrl) sum = String(await get(j.checksumUrl)).trim().split(/\s+/)[0]; return { version: j.version, url: j.downloadUrl, sha256: sum }; }
async function gradleRelease(version) { if (!version || version === 'latest') return latestGradle(); if (!/^\d+(\.\d+){1,2}(-[\w.]+)?$/.test(version)) throw new Error('bad Gradle version'); const url = 'https://services.gradle.org/distributions/gradle-' + version + '-bin.zip'; return { version, url, sha256: String(await get(url + '.sha256')).trim().split(/\s+/)[0] }; }
function pruneGradle(extra) {
  const keep = keepOf('gradle', extra); const have = ls(path.join(ROOT, 'gradle')).filter((x) => /^gradle-\d/.test(x)); const newest = have.map((x) => x.slice(7)).sort(cmp).reverse()[0]; if (newest) keep.add(newest);
  for (const x of have) if (!keep.has(x.slice(7))) rmrf(path.join(ROOT, 'gradle', x));
  /* Gradle's per-version caches, daemons and wrapper downloads of versions that are gone */
  for (const sub of ['caches', 'daemon']) for (const x of ls(path.join(GRADLE_HOME_DIR, sub)).filter((y) => /^\d+\.\d+/.test(y))) if (!keep.has(x)) rmrf(path.join(GRADLE_HOME_DIR, sub, x));
  for (const x of ls(path.join(GRADLE_HOME_DIR, 'wrapper', 'dists'))) { const m = /^gradle-(\d[\w.-]*?)-(bin|all)$/.exec(x); if (!m || !keep.has(m[1])) rmrf(path.join(GRADLE_HOME_DIR, 'wrapper', 'dists', x)); }
  rmrf(path.join(GRADLE_HOME_DIR, 'daemon', 'old'));
}
async function ensureGradle(opts = {}) {
  const want = opts.version || 'latest'; cleanTemp(); emit('gradle', 'run', 'Looking for Gradle …');
  let latest = null; try { latest = await gradleRelease(want); } catch { /* offline */ }
  const have = managedGradle(latest ? latest.version : want) || (latest ? null : managedGradle(want)); const same = have && latest && cmp(have.version, latest.version) === 0, newer = have && latest && want === 'latest' && cmp(have.version, latest.version) > 0;
  if (opts.check) { if (!have) emit('gradle', 'warn', latest ? 'Gradle ' + latest.version + ' is not installed – it will be downloaded automatically' : 'Gradle is not installed (and the download service cannot be reached right now)'); else if (!latest) emit('gradle', 'ok', 'Gradle ' + have.version + ' installed – could not check for a newer version'); else if (same || newer) emit('gradle', 'ok', 'Gradle ' + have.version + ' installed – up to date'); else emit('gradle', 'warn', 'Gradle ' + have.version + ' installed – ' + latest.version + ' will replace it (the old one is deleted)'); return have; }
  if (same || newer) { emit('gradle', 'ok', 'Gradle ' + have.version + ' is up to date'); pruneGradle(have.version); return have; }
  if (!latest) { if (have) { emit('gradle', 'warn', 'Gradle ' + have.version + ' will be used (could not check for a newer version: no internet?)'); return have; } emit('gradle', 'fail', 'Gradle is not installed and could not be downloaded (no internet?).'); throw new Error('no gradle'); }
  needSpace(600, 'Gradle', 'gradle'); emit('gradle', 'run', 'Downloading Gradle ' + latest.version + ' …');
  let f; try { f = await fetchVerified(latest.url, latest.sha256, 'Downloading Gradle ' + latest.version, 'gradle'); } catch (e) { if (have) { emit('gradle', 'warn', 'Gradle ' + latest.version + ' could not be downloaded (' + e.message + ') – Gradle ' + have.version + ' will be used'); return have; } emit('gradle', 'fail', 'Gradle could not be downloaded: ' + e.message); throw e; }
  emit('gradle', 'run', 'Unpacking Gradle …'); const dir = path.join(ROOT, 'gradle'), tmp = path.join(dir, '.new-' + Date.now()); try { unzip(f, tmp); } finally { try { fs.unlinkSync(f); } catch { /* gone */ } }
  const dest = path.join(dir, 'gradle-' + latest.version); try { swapIn(only(tmp), dest); } finally { rmrf(tmp); }
  if (!win) { try { fs.chmodSync(gradleBin(dest), 0o755); } catch { /* ignore */ } }
  if (!exists(gradleBin(dest))) { rmrf(dest); emit('gradle', 'fail', 'Gradle was unpacked but its launcher is missing.'); throw new Error('bad gradle'); }
  pruneGradle(latest.version); emit('gradle', 'ok', (have ? 'Updated to Gradle ' : 'Installed Gradle ') + latest.version + (have && have.version !== latest.version ? ' (the old version was deleted)' : '')); return { home: dest, version: latest.version, source: 'downloaded' };
}

/* ---------- ANDROID SDK ---------- */
const SDK = path.join(ROOT, 'android-sdk');
const sdkMgr = (root) => [path.join(root, 'cmdline-tools', 'latest', 'bin', bat('sdkmanager')), ...ls(path.join(root, 'cmdline-tools')).filter((x) => x !== 'latest').map((v) => path.join(root, 'cmdline-tools', v, 'bin', bat('sdkmanager')))].find(exists) || null;
const platVer = (x) => (/^android-(\d+(?:\.\d+)?)$/.exec(x) || [])[1];
const sdkPlatform = (root) => ls(path.join(root, 'platforms')).map(platVer).filter(Boolean).sort(cmp).reverse()[0] || null;
const sdkBuildTools = (root) => ls(path.join(root, 'build-tools')).filter((x) => /^\d+(\.\d+)+$/.test(x)).sort(cmp).reverse()[0] || null;
function parseSdkList(text) { const plats = [], bts = []; for (const l of String(text).split(/\r?\n/)) { const m = l.trim().split('|')[0].trim(); let x; if ((x = /^platforms;android-(\d+(?:\.\d+)?)$/.exec(m))) plats.push(x[1]); else if ((x = /^build-tools;(\d+(?:\.\d+)+)$/.exec(m))) bts.push(x[1]); } return { platform: plats.sort(cmp).reverse()[0] || null, buildTools: bts.sort(cmp).reverse()[0] || null }; }
function cmdlineTarget() { return win ? 'win' : mac ? (process.arch === 'arm64' ? 'mac_arm64' : 'mac_x86_64') : 'linux'; }
function parseCmdlineTools(html) { const t = cmdlineTarget(), re = new RegExp('(commandlinetools-' + t + '-\\d+_latest\\.zip)[\\s\\S]{0,600}?\\b([a-f0-9]{64})\\b', 'i'); const m = re.exec(String(html).replace(/<[^>]+>/g, ' ')); return m ? { name: m[1], sha256: m[2].toLowerCase(), algo: 'sha256', url: 'https://dl.google.com/android/repository/' + m[1] } : null; }
/** second source for the command-line tools: Google's repository index (publishes SHA-1) */
function parseRepoXml(xml) {
  const pkg = /<remotePackage path="cmdline-tools;latest">([\s\S]*?)<\/remotePackage>/.exec(String(xml)); if (!pkg) return null; const os_ = win ? 'windows' : mac ? 'macosx' : 'linux'; let best = null;
  for (const a of pkg[1].matchAll(/<archive>([\s\S]*?)<\/archive>/g)) { const b = a[1]; if (!new RegExp('<host-os>' + os_ + '</host-os>').test(b)) continue; const arch = (/<host-arch>([^<]+)<\/host-arch>/.exec(b) || [])[1] || ''; const sum = /<checksum type="sha1">([a-f0-9]{40})<\/checksum>/i.exec(b), url = /<url>([^<]+\.zip)<\/url>/.exec(b); if (!sum || !url) continue; const cand = { name: url[1], sha256: sum[1].toLowerCase(), algo: 'sha1', url: 'https://dl.google.com/android/repository/' + url[1] }; if (!best || (mac && process.arch === 'arm64' && /aarch64|arm64/.test(arch))) best = cand; }
  return best;
}
async function cmdlineToolsInfo() { try { const i = parseCmdlineTools(await get('https://developer.android.com/studio')); if (i) return i; } catch { /* try the second source */ } try { const i = parseRepoXml(await get('https://dl.google.com/android/repository/repository2-3.xml')); if (i) return i; } catch { /* none */ } return null; }
function pruneSdk(root, sm) {
  const plats = ls(path.join(root, 'platforms')).map(platVer).filter(Boolean).sort(cmp), bts = ls(path.join(root, 'build-tools')).filter((x) => /^\d+(\.\d+)+$/.test(x)).sort(cmp); let removed = 0;
  for (const p of plats.slice(0, -1)) { if (sm) sm(['--uninstall', 'platforms;android-' + p]); rmrf(path.join(root, 'platforms', 'android-' + p)); removed++; }
  for (const b of bts.slice(0, -1)) { if (sm) sm(['--uninstall', 'build-tools;' + b]); rmrf(path.join(root, 'build-tools', b)); removed++; }
  for (const x of ['.temp', '.downloadIntermediates']) rmrf(path.join(root, x)); return removed;
}
async function ensureSdk(jdkIn, opts = {}) {
  cleanTemp(); emit('sdk', 'run', 'Looking for the Android SDK …'); const root = SDK; let mgr = sdkMgr(root);
  if (opts.check) { const p = sdkPlatform(root); emit('sdk', mgr || p ? 'ok' : 'warn', mgr || p ? 'Android SDK installed' + (p ? ' (platform ' + p + ')' : '') + ' – checked for updates before each build; older platforms are deleted when a newer one is installed' : 'The Android SDK is not installed – it will be downloaded automatically'); return mgr ? { root, platform: p } : null; }
  if (!mgr) {
    needSpace(1500, 'the Android SDK', 'sdk'); emit('sdk', 'run', 'Looking up the latest Android command-line tools …'); const info = await cmdlineToolsInfo();
    if (!info) { emit('sdk', 'fail', 'Could not find the Android command-line tools on developer.android.com or dl.google.com (no internet?).'); throw new Error('no cmdline-tools'); }
    let f; try { f = await fetchVerified(info.url, info.sha256, 'Downloading the Android SDK tools', 'sdk', info.algo); } catch (e) { emit('sdk', 'fail', 'The Android SDK tools could not be downloaded: ' + e.message); throw e; }
    const tmp = path.join(ROOT, '.sdk-' + Date.now()); try { unzip(f, tmp); } finally { try { fs.unlinkSync(f); } catch { /* gone */ } }
    const dest = path.join(root, 'cmdline-tools', 'latest'); try { swapIn(path.join(tmp, 'cmdline-tools'), dest); } finally { rmrf(tmp); }
    if (!win) for (const b of ls(path.join(dest, 'bin'))) { try { fs.chmodSync(path.join(dest, 'bin', b), 0o755); } catch { /* ignore */ } } mgr = sdkMgr(root);
  }
  if (!mgr) { emit('sdk', 'fail', 'The Android SDK tools were unpacked but sdkmanager is missing.'); throw new Error('sdkmanager missing'); }
  let jdk = jdkIn || managedJava(); if (!jdk) jdk = await ensureJava({});
  const mk = (j) => (args, input) => run(mgr, ['--sdk_root=' + root, ...args], { env: envWith(j && j.home), input, timeout: 25 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  let sm = mk(jdk);
  emit('sdk', 'run', 'Accepting the Android SDK licences …'); let lic = sm(['--licenses'], 'y\n'.repeat(80));
  if (lic.status !== 0 && /Unsupported|class file|UnsupportedClassVersion|requires Java|major version/i.test((lic.stderr || '') + (lic.stdout || '')) && jdk.major > 21) { /* the newest Java is too new for sdkmanager: use Java 21 for the SDK steps only (it is deleted again afterwards) */ emit('sdk', 'run', 'Using Java 21 for the SDK tools …'); const j21 = await ensureJava({ major: 21 }); sm = mk(j21); lic = sm(['--licenses'], 'y\n'.repeat(80)); emit('jdk', 'ok', 'Java ' + jdk.full + ' ready'); }
  emit('sdk', 'run', 'Checking for the latest Android platform …'); const l = sm(['--list']); const latest = parseSdkList((l.stdout || '') + '\n' + (l.stderr || ''));
  if (!latest.platform) { const p = sdkPlatform(root); if (p) { pruneSdk(root, null); emit('sdk', 'warn', 'Android platform ' + p + ' will be used (could not check for a newer one: no internet?)'); return { root, platform: p, buildTools: sdkBuildTools(root) }; } emit('sdk', 'fail', 'Could not read the list of Android SDK packages (no internet?).'); throw new Error('no list'); }
  const before = sdkPlatform(root), want = ['platform-tools', 'platforms;android-' + latest.platform, ...(latest.buildTools ? ['build-tools;' + latest.buildTools] : [])];
  emit('sdk', 'run', 'Installing Android ' + latest.platform + ' (API level) and build tools …'); let r = sm(['--install', ...want]); if (r.status !== 0) { emit('sdk', 'run', 'Trying again …'); r = sm(['--install', ...want]); }
  if (r.status !== 0) { emit('sdk', 'fail', 'Installing the Android SDK packages failed: ' + String((r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-2).join(' ')).slice(0, 220)); throw new Error('sdk install'); }
  emit('sdk', 'run', 'Updating installed Android SDK packages …'); sm(['--update']);
  const gone = pruneSdk(root, sm); const after = sdkPlatform(root);
  emit('sdk', 'ok', 'Android SDK ready – platform ' + after + (before && cmp(before, after) < 0 ? ' (updated from ' + before + (gone ? '; the old version was deleted' : '') + ')' : '') + (latest.buildTools ? ', build-tools ' + sdkBuildTools(root) : ''));
  return { root, platform: after, buildTools: sdkBuildTools(root) };
}

/* ---------- environment for Gradle ---------- */
function envWith(javaHome, sdkRoot) {
  const env = Object.assign({}, process.env), sep = path.delimiter; delete env.ANDROID_HOME; delete env.ANDROID_SDK_ROOT; delete env.JAVA_HOME;
  if (javaHome) { env.JAVA_HOME = javaHome; env.PATH = path.join(javaHome, 'bin') + sep + (env.PATH || env.Path || ''); if (win) env.Path = env.PATH; }
  if (sdkRoot) { env.ANDROID_HOME = sdkRoot; env.ANDROID_SDK_ROOT = sdkRoot; } env.GRADLE_USER_HOME = GRADLE_HOME_DIR; return env;
}
/** Everything the build needs, from the managed folder only (run `all` first). */
function resolve(o = {}) {
  const java = managedJava(o.javaMajor) || (o.javaMajor ? null : managedJava()), gradle = managedGradle(o.gradleVersion) || (o.gradleVersion && o.gradleVersion !== 'latest' ? null : managedGradle());
  const p = sdkPlatform(SDK), sdk = p ? { root: SDK, platform: p, buildTools: sdkBuildTools(SDK) } : null;
  return { java, gradle, sdk, env: envWith(java && java.home, sdk && sdk.root) };
}
function prune() { pruneJava(); pruneGradle(); pruneSdk(SDK, null); }
module.exports = { get, fetchVerified, resolve, envWith, cmp, parseSdkList, parseCmdlineTools, parseRepoXml, unzip, ROOT, gradleBin, sdkPlatform, sdkBuildTools, emit, setEmitId, readState, writeState, ensureJava, ensureGradle, ensureSdk, managedJava, managedGradle, pruneJava, pruneGradle, prune, setKeep, keepOf, DEFAULT_JAVA, latestGradle };

if (require.main === module) {
  (async () => {
    const cmd = process.argv[2] || 'check', arg = process.argv[3], check = cmd === 'check';
    const guard = (id, p) => p.catch((e) => { if (check) emit(id, 'warn', String(e.message)); else throw e; });
    try {
      if (cmd === 'env') { const r = resolve(); console.log(JSON.stringify({ java: r.java && r.java.home, gradle: r.gradle && r.gradle.home, sdk: r.sdk && r.sdk.root }, null, 1)); return; }
      if (cmd === 'prune') { prune(); console.log('pruned'); return; }
      if (cmd === 'jdk' || cmd === 'all' || check) await guard('jdk', ensureJava({ check, major: cmd === 'jdk' ? +arg || 0 : 0 }));
      if (cmd === 'gradle' || cmd === 'all' || check) await guard('gradle', ensureGradle({ check, version: cmd === 'gradle' ? arg : 'latest' }));
      if (cmd === 'sdk' || cmd === 'all' || check) await guard('sdk', ensureSdk(null, { check }));
      if (cmd === 'all') prune();
    } catch (e) { console.error('toolchain: ' + (e && e.message || e)); process.exit(1); }
  })();
}
