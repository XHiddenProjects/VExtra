# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 3.2.x   | ✅ security fixes (current) |
| 3.1.x   | ⚠️ please upgrade to 3.2.x |
| 3.0.x   | ❌ please upgrade |
| 2.0.x   | ❌ please upgrade |
| 1.0.x   | ❌ please upgrade |

Current version: **3.2.0** (see `VERSION`). This policy was last reviewed for 3.2.0.

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

## v3.1.0 notes (still apply in 3.2.0)
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
