// Builds the Android app with the Java, Gradle and Android SDK that toolchain.js installed (no Android Studio needed).
//   node scripts/build-android.js          debug APK  -> dist/<name>-debug.apk   (also android/app/build/outputs/apk/debug)
//   node scripts/build-android.js --aab    release bundle -> dist/<name>-release.aab (unsigned – sign it for Google Play)
// The android/ folder stays portable: open it in Android Studio (Windows / Mac / Linux) and it works as is.
// If the newest Java / Gradle does not work with the project's Android Gradle plugin, the build is retried automatically
// with Java 21 and the Gradle version the project itself asks for.
const cp = require('child_process'), path = require('path'), fs = require('fs'), T = require('./toolchain.js');
const root = path.resolve(__dirname, '..'), dir = path.join(root, 'android'), win = process.platform === 'win32', say = (state, text) => T.emit('build', state, text);
const aab = process.argv.includes('--aab');
const slug = (() => { try { return String(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name || 'app').replace(/-mobile$/, ''); } catch { return 'app'; } })();
const COMPAT = /Unsupported class file major version|Unsupported Java|requires Java|incompatible with Java|Gradle .* requires|Could not (?:initialize|create) class|BUG! exception|Unsupported (?:Gradle|major)|Failed to apply plugin|minimum supported Gradle|org\.gradle\.api\.internal\.tasks\.TaskDependencyResolveException/i;
const TARGET = /Failed to find target with hash string|Failed to find Platform SDK|Cannot cast object 'android-|does not specify `compileSdk`|compileSdk(?:Version)? .*(?:not|unsupported)/i;
const tail = (s) => String(s).split(/\r?\n/).filter((l) => l.trim()).slice(-40).join('\n');
function edit(file, fn) { try { if (fs.existsSync(file)) { const a = fs.readFileSync(file, 'utf8'), b = fn(a); if (b !== a) fs.writeFileSync(file, b); } } catch (e) { console.error('prepare: ' + e.message); } }
/** installed platforms, best first: whole-number ones (android-36) are what Gradle plugins know how to find, "37.0"-style ones come after */
function platforms(R) {
  /* Platforms the Android Gradle plugin can be pointed at. Folders like "37.0" (Android 17) are used through a small link folder (see overlay()): the
     plugin addresses a platform by its whole number, the link makes android-37 lead to the real android-37.0. Installed ones come first (they work offline);
     if none is usable the plugin downloads platform 36 itself. Older than 35 is the last resort – current libraries need 35 or newer. */
  let names = []; try { names = fs.readdirSync(path.join(R.sdk.root, 'platforms')).map((x) => (/^android-(\d+(?:\.\d+)?)$/.exec(x) || [])[1]).filter(Boolean); } catch { /* none */ }
  const ints = names.filter((x) => !/\./.test(x)).sort((a, b) => +b - +a), dotted = names.filter((x) => /\./.test(x) && !ints.includes(x.split('.')[0])).sort((a, b) => T.cmp(b, a));
  let ok = [...dotted, ...ints].filter((x) => parseInt(x, 10) >= 35).sort((a, b) => T.cmp(b, a)); const old = [...ints, ...dotted].filter((x) => parseInt(x, 10) < 35).sort((a, b) => T.cmp(b, a));
  const pick = T.cfg().platform; if (pick !== 'auto' && ok.includes(pick)) ok = [pick, ...ok.filter((x) => x !== pick)]; if (!ok.some((x) => parseInt(x, 10) === 36)) ok.push('36'); return [...ok, ...old];
}
/** A folder next to Vextra's tools that looks like an SDK: every entry of the real SDK is linked in, and android-<N> leads to android-<N>.<M>. Nothing in the real SDK is moved, copied or changed. */
function overlay(realRoot, plat) {
  const o = path.join(T.ROOT, 'sdk-overlay'); fs.mkdirSync(path.join(o, 'platforms'), { recursive: true });
  const rmLink = (p) => { let st; try { st = fs.lstatSync(p); } catch { return; } if (!st.isSymbolicLink()) return; try { fs.unlinkSync(p); } catch { try { fs.rmdirSync(p); } catch { /* leave it */ } } }; // never recursive: a link is removed, what it points to is untouched
  const link = (target, p) => { rmLink(p); try { fs.symlinkSync(target, p, 'junction'); } catch (e) { if (!fs.existsSync(p)) throw e; } };
  for (const x of fs.readdirSync(o)) if (x !== 'platforms') rmLink(path.join(o, x)); for (const x of fs.readdirSync(path.join(o, 'platforms'))) rmLink(path.join(o, 'platforms', x));
  for (const x of fs.readdirSync(realRoot)) if (x !== 'platforms') link(path.join(realRoot, x), path.join(o, x));
  for (const x of fs.readdirSync(path.join(realRoot, 'platforms'))) link(path.join(realRoot, 'platforms', x), path.join(o, 'platforms', x));
  const whole = plat.split('.')[0]; if (!fs.existsSync(path.join(realRoot, 'platforms', 'android-' + whole))) link(path.join(realRoot, 'platforms', 'android-' + plat), path.join(o, 'platforms', 'android-' + whole));
  return o;
}
function prepare(R, plat) {
  const level = String(plat || '').split('.')[0], dotted = /\./.test(plat || ''); let root = R.sdk.root;
  if (dotted) { try { root = overlay(R.sdk.root, plat); } catch (e) { console.error('overlay: ' + e.message); root = R.sdk.root; } }
  if (level) {
    edit(path.join(dir, 'variables.gradle'), (t) => t.replace(/(compileSdkVersion\s*=\s*)(?:\d+|'[^']*'|"[^"]*")/, '$1' + level).replace(/(targetSdkVersion\s*=\s*)\d+/, '$1' + level));
    edit(path.join(dir, 'gradle.properties'), (t) => { const v = level + (dotted ? ',' + plat : ''); return /android\.suppressUnsupportedCompileSdk/.test(t) ? t.replace(/android\.suppressUnsupportedCompileSdk=.*/, 'android.suppressUnsupportedCompileSdk=' + v) : t.replace(/\s*$/, '\n') + 'android.suppressUnsupportedCompileSdk=' + v + '\n'; });
  }
  const lp = path.join(dir, 'local.properties'); fs.writeFileSync(lp, 'sdk.dir=' + root.replace(/\\/g, '\\\\').replace(/:/g, '\\:') + '\n');
}
/** the machine-specific local.properties must never travel to Android Studio on another computer */
function cleanup() { try { fs.unlinkSync(path.join(dir, 'local.properties')); } catch { /* none */ } }
function gradle(cmd, R, args) { return cp.spawnSync(cmd, [aab ? 'bundleRelease' : 'assembleDebug', '--console=plain', '--warning-mode=none', '--no-daemon', ...(args || [])], { cwd: dir, env: R.env, encoding: 'utf8', shell: win && /\.(bat|cmd)$/i.test(cmd), maxBuffer: 256 * 1024 * 1024 }); }
function collect() {
  const src = aab ? path.join(dir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab') : path.join(dir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (!fs.existsSync(src)) return null; const d = path.join(root, 'dist'); fs.mkdirSync(d, { recursive: true }); const dest = path.join(d, slug + (aab ? '-release.aab' : '-debug.apk')); fs.copyFileSync(src, dest); return path.relative(root, dest).replace(/\\/g, '/');
}
(async () => {
  try {
    if (!fs.existsSync(dir)) { say('fail', 'The android/ folder is missing – the Android project was not created.'); return 1; }
    let R = T.resolve(); if (!R.java || !R.sdk || (!R.gradle && T.cfg().gradle !== 'project')) { say('fail', 'Java, Gradle or the Android SDK is not ready – run "npm run toolchain:update" first.'); return 2; }
    const plats = platforms(R); let ti = 0, r, out, wrap = null;
    /** Java 21 + the Gradle version the project itself asks for (works with every Android Gradle plugin Capacitor ships) */
    async function useFallback() {
      const j = R.java && R.java.source === 'chosen' && R.java.major >= 17 && R.java.major <= 23 ? R.java : (T.setKeep('java', [21]), await T.ensureJava({ major: 21 })); const keepJ = j; R = T.resolve({ javaMajor: 21 }); R.java = keepJ; R.env = T.envWith(j.home, R.sdk.root);
      const w = path.join(dir, win ? 'gradlew.bat' : 'gradlew'); if (!win) { try { fs.chmodSync(w, 0o755); } catch { /* ignore */ } } if (fs.existsSync(w)) wrap = w;
    }
    const run = () => { r = gradle(wrap || T.gradleBin(R.gradle.home), R); out = (r.stdout || '') + (r.stderr || ''); };
    /* the wrapper points at the latest Gradle (services.gradle.org); if the project's Android Gradle plugin cannot run on it, the original version is restored */
    let wr = null; try { wr = await T.setWrapper(dir); if (wr && wr.changed) say('run', 'Gradle wrapper set to the latest release: ' + wr.url.replace(/^.*gradle-/, 'gradle-').replace(/-bin\.zip$/, '')); } catch { /* keep the project's own */ }
    let fell = !!wrap;
    for (;;) {
      const plat = plats[ti] || R.sdk.platform; prepare(R, plat); say('run', 'Building the Android ' + (aab ? 'bundle' : 'app') + ' (Java ' + R.java.major + ', Gradle ' + (wrap ? 'of the project' : R.gradle && R.gradle.version) + ', Android ' + plat + ') – the first build can take several minutes …');
      run();
      if (r.status !== 0 && wr && wr.changed && COMPAT.test(out)) { T.restoreWrapper(wr); wr.changed = false; say('run', 'This project\'s Android Gradle plugin needs an older Gradle – using the version the project asks for …'); run(); }
      if (r.status !== 0 && !fell && COMPAT.test(out)) { fell = true; say('run', 'The newest Java / Gradle does not fit this project – trying again with Java 21 and the project\'s own Gradle …'); try { await useFallback(); prepare(R, plat); run(); } catch (e) { console.error('fallback: ' + (e && e.message || e)); } }
      if (r.status !== 0 && TARGET.test(out) && ti + 1 < plats.length) { ti++; say('run', 'Android ' + plat + ' is not usable with this project – trying Android ' + plats[ti] + ' …'); continue; }
      break;
    }
    if (r.status === 0) { const rel = collect(); say('ok', rel ? (aab ? 'Release bundle ready: ' + rel + ' (unsigned – sign it for Google Play). The android/ folder opens in Android Studio as is.' : 'App ready: ' + rel + ' – install it on a phone, or open the android/ folder in Android Studio.') : 'Build finished.'); return 0; }
    console.error(tail(out));
    const why = TARGET.test(out) ? 'The Android platform in the SDK could not be used by this project – open the android/ folder in Android Studio and let it install / sync the platform it asks for.' : COMPAT.test(out) ? 'This project\'s Android Gradle plugin does not work with the installed Java / Gradle – run "npm update" to get the newest Capacitor and try again.' : /licen[sc]e/i.test(out) ? 'An Android SDK licence has not been accepted – run "npm run toolchain:update" and build again.' : /No space left|ENOSPC/i.test(out) ? 'The disk is full – free some space and build again.' : /Could not resolve|UnknownHost|timed out|Connection|Could not GET/i.test(out) ? 'Gradle could not download a library – check the internet connection and build again.' : 'The Android build failed – "Copy technical details" has the full output.';
    say('fail', why); return r.status === null ? 1 : r.status;
  } catch (e) { console.error(e && e.stack || e); say('fail', 'The Android build could not be started: ' + (e && e.message || e)); return 1; } finally { cleanup(); }
})().then((c) => process.exit(c || 0));
