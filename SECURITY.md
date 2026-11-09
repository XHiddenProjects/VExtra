# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 3.4.x   | ✅ security fixes (current) |
| 3.3.x   | ⚠️ please upgrade to 3.4.x |
| 3.2.x   | ⚠️ please upgrade to 3.3.x |
| 3.1.x   | ⚠️ please upgrade to 3.3.x |
| 3.0.x   | ❌ please upgrade |
| 2.0.x   | ❌ please upgrade |
| 1.0.x   | ❌ please upgrade |

Current version: **3.8.0** (see `VERSION`). This policy was last reviewed for 3.8.0.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Email the maintainers (see `author` in `package.json`) with a description, reproduction steps and the affected version. You will get an acknowledgement within 5 working days; fixes are released as patch versions and listed in `CHANGELOG.md`.

## How Vextra Studio protects you

- **Sandboxed previews.** Game *Play* and web *Preview* run in sandboxed iframes without `allow-same-origin`, so user code cannot reach the editor, your files or the Tauri bridge.
- **Authenticated cross-window messaging.** Every parent ⇄ preview message carries a random per-session token (`VX.channel`). The editor ignores messages without the token or from a different `source` window, and replies are posted to a pinned origin. The one exception is the Play iframe: it is sandboxed with an *opaque* origin, which browsers only address with `'*'`. That channel is protected by the token and the `source` check instead, and carries no secrets beyond the session token.
- **Local servers** (PHP preview, "Local server") bind to `127.0.0.1` only and serve only the opened project folder; path traversal is rejected.
- **Archive writers** strip `..` and absolute path segments from entry names.
- **Plugins** run with editor privileges. Only install plugins you trust; review the source first.
- **Dependencies** are declared with `^` ranges and refreshed for each release (`npm audit`, `cargo update`).

## Known advisories

### RUSTSEC-2024-0429 – unsoundness in `Iterator`/`DoubleEndedIterator` for `glib::VariantStrIter` (glib 0.18.5)

- **Status:** not exploitable from Vextra Studio; cannot be upgraded yet.
- **Why:** `glib 0.18` is a *transitive* dependency of the Linux GTK3 stack (`gtk → tao / muda / wry → tauri 2.x`). The fixed `glib ≥ 0.20` is a semver-incompatible GTK-rs release that Tauri 2 does not yet use, and `Cargo.lock` is already at the newest compatible versions of every crate (`cargo update` makes no change).
- **Our code:** Vextra never calls `glib::VariantStrIter` (or any `glib::Variant` API); the affected iterator is not reachable from our Rust sources or from the web frontend.
- **Scope:** Linux builds only. Windows and macOS builds do not link glib.
- **Plan:** moves with Tauri. We will upgrade as soon as a Tauri release depends on a fixed glib. Track this entry in `CHANGELOG.md`.

## Hardening tips for deployments

- Keep the optional cloud/sharing server (`npm run server`) behind HTTPS and set a strong secret.
- Exported websites ship `.htaccess` / `nginx.conf` with conservative headers; review them for your host.

## Static analysis

The repository is scanned by GitHub CodeQL. Values embedded in generated inline `<script>` blocks are serialised with `VX.jsLit`, which escapes `<`, `>`, `&`, U+2028 and U+2029, so they cannot terminate the script or inject code.

## v3.0.0 additions (still apply in 3.1.0)
- **Library downloads** (`http_download`): https only, 50 MB cap, archive paths sanitised, user confirmation before anything is written. Templates and games are code: install only from sources you trust.
- **Process runner** (`run_start`): only `npm`, `npx`, `node`; working directory must be inside a `store-export` folder; arguments limited to `[A-Za-z0-9@./:=,+-_]`; no shell is used. npm packages named in generated `package.json` files run their install scripts as usual.

## v3.8.0 notes
- **Loading page** (`settings.loading`): the title, subtitle, tips and colours you type are HTML-escaped when the page is generated, colours must be `#hex` values, and the logo must be a `data:image/` URL taken from your own sprites. Nothing from these settings is evaluated as code.
- **Credit footer** for exported websites and UI designs is fixed text with no links or scripts; only its alignment and colours are configurable.
- **Store Export toolchain:** downloads still use HTTPS to the same fixed list of hosts with SHA-256 verification. The new retry only repeats the same verified request (up to 4 times) after network errors; a download that fails its checksum is never retried or used. Java 27 is the requested JDK.
- **Spawn fix:** an `undefined` override no longer replaces a default value on a spawned object.

## v3.6.0 notes
- **Script → behaviour conversion** only moves text from one field of the project file to another; nothing is executed during conversion. Code behaviours run exactly as before: inside the sandboxed Play frame / exported page, never in the editor's own context.
- The **Logic tab preview** of a code behaviour runs the script once against inert stand-ins (`game`, `self`, `VXRT`… do nothing), so previewing no longer reaches real engine services such as the microphone or camera.
- **UI layout** (`scene.uiLayout`) stores only an anchor name and two numbers per element id; values are validated as numbers/known anchors when applied and are never evaluated as code.
- Layer visibility / lock in the editor is view-only state and is not saved into the game.
- **Example games are block graphs**, so they run through the same block runtime as any project (Expressions are parsed by the engine's arithmetic parser, not `eval`). The new **Light** block only sets a light's numeric brightness and a colour string on the object.
- Accessibility reports can be filed publicly (see `ACCESSIBILITY.md`); security problems should still go through the process above.

## v3.5.0 notes
- **Android toolchain auto-install (Store Export):** HTTPS only; hosts limited to api.adoptium.net, github.com / githubusercontent.com, services.gradle.org / downloads.gradle.org, developer.android.com and dl.google.com; every archive's SHA-256 is verified before it is unpacked; archive paths are checked (no zip-slip); installs go to your user folder (`~/.vextra/toolchain`), never need administrator rights, and no shell is used except Gradle's own launcher. The process runner restrictions above are unchanged.
- **Speech service fallback** is off unless you set a URL and key in Settings. The key is stored in the app settings on your computer and audio is sent only to that URL while a Voice Command block is listening.
- Example games are ordinary projects (scripts included) – review any game you import from elsewhere.

## v3.4.1 notes
- The editor's Play frame stays sandboxed (no `allow-same-origin`). Instead of loosening it for the microphone and camera, the editor opens the devices and sends the game only data (audio analysis arrays, small camera frames, recognised text). Only the frame the panel started may ask (one-time token + source check); the streams are stopped when the game stops, and nothing leaves the computer.

## v3.4.0 notes
- **Microphone, camera, VR and AR** blocks ask the browser for permission and only work while the game is open. Microphone sound and camera frames are analysed **locally in memory** (level, motion, colour) – no audio or video is recorded, stored or sent anywhere by Vextra. The *Photo* block keeps a picture only in a game variable (or a download the player triggers). Speech recognition (Voice Command) is done by the browser's own service, which may send audio to its vendor (Google / Apple) – mention this in your game's privacy notice.
- Games run inside a sandboxed frame in the editor; the frame is allowed `microphone`, `camera` and `xr-spatial-tracking` only (no geolocation, no clipboard).
- Streams are released when a block stops, the scene changes or the game is closed (reference-counted, so the camera light turns off).

## v3.3.0 notes
- **CodeQL findings fixed** (`plugins/vextra-shield.js`): *Improper code sanitization* (×3) – the exported-game scripts (save guard, embed guard) are now fixed text and read their settings from escaped `data-` attributes instead of having JSON spliced into JavaScript; *Bad HTML filtering regexp* – script-tag matching now also handles end tags such as `</script foo>`. The same regular expression was corrected in the AI site preview and the web tools.
- **Repository hygiene**: the generated server binary (`vextra-server[.exe]`) is stored with Git LFS and installers are git-ignored; publish release builds with checksums and verify downloads against them. LFS objects are fetched from GitHub over HTTPS like any other file.
- **Vextra AI**: new *Build & change site* permission (Deny / Ask / Allow); website files are written only under it, and `new_site` never overwrites existing files. Stop now aborts a pending request or approval immediately. The *Context window* limit trims what is sent to the provider.
- Dependencies were updated to their latest releases (`npm audit`: 0 known vulnerabilities).
- Drag-to-reorder uses the pointer only and moves no data outside the window.

## v3.1.0 notes (still apply in 3.3.0)
- No new network, file or process permissions. The new animation studios, 2D lights and model poses are pure front-end features that run inside the existing sandboxed game preview.
- Sprite/model animation data is stored as plain JSON inside the game file and is validated on load (frame indices outside the sprite are dropped; unknown track names are ignored).

## v3.2.0 notes
- **Vextra Shield** (built-in plugin, configurable via its ⚙ button) hardens exported games with a Content-Security-Policy (inline scripts pinned by SHA-256, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, network limited to HTTPS/WSS plus hosts you list; `unsafe-eval` stays because the engine and code behaviours need it), signs local saves to detect edits, enforces a password policy and client-side sign-in lockout, signs out idle sessions, warns before sending passwords over `http://` to non-local servers, and scans files for secrets before publishing. These are defence-in-depth measures: client-side checks can be bypassed by someone modifying the app, so the server's own controls (scrypt hashing, rate limiting) remain authoritative.
- New plugin hooks (`game.export.html`, `account.*`, `publish.before`) let plugins veto or change those actions. Plugins already run with editor privileges, so only install plugins you trust.
- `package.json` allows install scripts only for `esbuild` (`allowScripts` for npm 11.16+/12, `pnpm.onlyBuiltDependencies`, `trustedDependencies`, `dependenciesMeta`). Review any dependency before adding it to those lists.
- Fixed: selection outlines left in the 3D editor after scaling (no security impact).
- **Two-step sign-in** (server): authenticator-app codes (TOTP, SHA-1/6 digits/30 s, ±1 step, a code cannot be reused), 8 one-time recovery codes (stored hashed), and WebAuthn security keys (ES256, attestation `none`, signature-counter check). The second step uses a 5-minute ticket limited to 6 tries, plus the per-IP rate limit. Turning it on/off, adding/removing keys and new recovery codes require the account password. The TOTP secret is stored in the server's `users.json` (protect the data folder like any credential store). Keys only work from the app address they were added from.
- **Vextra AI** plugin: prompts and anything the AI reads go to the provider you choose (local providers stay on your computer). API keys are stored in Vextra's local settings. Abilities (read, edit open file, create & edit files, delete/move, build & change game) are Deny / Ask / Allow; file deletion and moves have their own permission and never touch `.git`, `node_modules` or secret-looking files; secret-looking files (`.env`, keys, certificates) are never read or written; writes stay inside the open folder. Treat model output as untrusted – review changes you allow automatically (Agent mode).
- **Local server** started from the desktop app listens on `127.0.0.1` only and keeps its data in the app's data folder. `forge.net.request` only allows `https://` (and `http://localhost`).
- Store Export projects approve install scripts only for `electron`, `sharp` and `esbuild`.
