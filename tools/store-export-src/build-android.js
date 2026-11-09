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
const TARGET = /Failed to find target with hash string|Failed to find Platform SDK|compileSdk(?:Version)? .*(?:not|unsupported)/i;
const tail = (s) => String(s).split(/\r?\n/).filter((l) => l.trim()).slice(-40).join('\n');
function edit(file, fn) { try { if (fs.existsSync(file)) { const a = fs.readFileSync(file, 'utf8'), b = fn(a); if (b !== a) fs.writeFileSync(file, b); } } catch (e) { console.error('prepare: ' + e.message); } }
/** installed platforms, best first: whole-number ones (android-36) are what Gradle plugins know how to find, "37.0"-style ones come after */
function platforms(R) { try { const all = fs.readdirSync(path.join(R.sdk.root, 'platforms')).map((x) => (/^android-(\d+(?:\.\d+)?)$/.exec(x) || [])[1]).filter(Boolean).sort((a, b) => ((/\./.test(b) ? 0 : 1) - (/\./.test(a) ? 0 : 1)) || T.cmp(b, a)); const pick = T.cfg().platform; return pick !== 'auto' && all.includes(pick) ? [pick, ...all.filter((x) => x !== pick)] : all; } catch { return [R.sdk.platform]; } }
function prepare(R, plat) {
  const level = String(plat || '').split('.')[0], exact = /\./.test(plat || '');
  if (level) {
    /* compileSdk names the exact platform folder (a "37.0" folder needs the full "android-37.0" name), targetSdk is the whole number */
    edit(path.join(dir, 'variables.gradle'), (t) => t.replace(/(compileSdkVersion\s*=\s*)(?:\d+|'[^']*'|"[^"]*")/, '$1' + (exact ? "'android-" + plat + "'" : level)).replace(/(targetSdkVersion\s*=\s*)\d+/, '$1' + level));
    edit(path.join(dir, 'gradle.properties'), (t) => (/android\.suppressUnsupportedCompileSdk/.test(t) ? t.replace(/android\.suppressUnsupportedCompileSdk=.*/, 'android.suppressUnsupportedCompileSdk=' + level + (exact ? ',' + plat : '')) : t.replace(/\s*$/, '\n') + 'android.suppressUnsupportedCompileSdk=' + level + (exact ? ',' + plat : '') + '\n'));
  }
  const lp = path.join(dir, 'local.properties'); fs.writeFileSync(lp, 'sdk.dir=' + R.sdk.root.replace(/\\/g, '\\\\').replace(/:/g, '\\:') + '\n');
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
    /* Gradle 9 cannot run Android Gradle plugin 8 or older: go straight to the matching setup instead of failing first */
    if (!R.gradle) { const w0 = path.join(dir, win ? 'gradlew.bat' : 'gradlew'); if (!win) { try { fs.chmodSync(w0, 0o755); } catch { /* ignore */ } } if (fs.existsSync(w0)) wrap = w0; else { say('fail', 'The project has no Gradle wrapper – pick a Gradle in the Android tools dialog.'); return 2; } }
    let agp = 0; try { const m = /com\.android\.tools\.build:gradle:(\d+)/.exec(fs.readFileSync(path.join(dir, 'build.gradle'), 'utf8')); agp = m ? +m[1] : 0; } catch { /* unknown */ }
    if (agp && agp < 9) { say('run', 'This project uses Android Gradle plugin ' + agp + ' – using Java 21 and the project\'s own Gradle …'); try { await useFallback(); } catch (e) { console.error('fallback: ' + (e && e.message || e)); } }
    let fell = !!wrap;
    for (;;) {
      const plat = plats[ti] || R.sdk.platform; prepare(R, plat); say('run', 'Building the Android ' + (aab ? 'bundle' : 'app') + ' (Java ' + R.java.major + ', Gradle ' + (wrap ? 'of the project' : R.gradle && R.gradle.version) + ', Android ' + plat + ') – the first build can take several minutes …');
      run();
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
