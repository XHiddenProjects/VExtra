# Contributing to Vextra Studio

Thank you for helping! Vextra Studio is a Tauri v2 + plain-JavaScript app for web development and 2D / 3D game making. It is licensed **AGPL-3.0-only**, and so are your contributions.

## Ways to help
- **Report a bug** or **suggest a feature** – see [ISSUE_TEMPLATES.md](ISSUE_TEMPLATES.md).
- **Improve the docs** – in-app docs live in `renderer/js/docs/content.js`, the rest in `README.md`.
- **Share a game, template or plugin** – example games live in `renderer/js/game/editor/examples/`, plugins in `plugins/` (see "Write a plugin" in the README).
- **Fix something** – open a pull request ([PULL_REQUEST_TEMPLATE.md](PULL_REQUEST_TEMPLATE.md)).

Be kind: everyone taking part follows our [Code of Conduct](CODE_OF_CONDUCT.md). Security problems: please read [SECURITY.md](SECURITY.md) and report them privately, not as a public issue.

## Set up
```bash
git clone https://github.com/XHiddenProjects/VExtraStudio.git
cd VExtraStudio
npm install
npm run lfs:setup        # once – the Vextra server binary uses Git LFS (install Git LFS first: https://git-lfs.com)
npm run dev              # desktop app (needs Rust + MSVC Build Tools on Windows)
node scripts/dev-server.js   # or just the web UI on http://localhost:5173
```
Android store exports need the latest **Android Studio** (it brings Java, Gradle and the SDK).

## Project map
| Path | What lives there |
|---|---|
| `renderer/` | the whole UI (plain JS, no build step): `js/app`, `js/core`, `js/web`, `js/game` |
| `renderer/js/game/` | game engine: `rt-*.js` runtime, `blocks-*.js` visual blocks, `editor/` game editor |
| `plugins/` | built-in plugins (AI, Shield, Store Export, Markdown preview …) |
| `server/` | optional Vextra server (accounts, collaboration, publishing) |
| `src-tauri/` | Rust side (native commands, sandboxed process runner) |
| `scripts/` | dev server, self-test, LFS and install helpers |

## Before you open a pull request
1. `node scripts/selftest.js` – must report **0 failed**.
2. `node --check <file>` for every JavaScript file you touched.
3. If you changed the game engine, run a game in the editor's Play panel (and export one) – no errors in the log.
4. Add an entry to **CHANGELOG.md** (under the current version, `Added` / `Changed` / `Fixed`) and update the in-app docs / README when behaviour changes.
5. Keep pull requests focused: one change, one PR.

## Code style
- Plain modern JavaScript, no framework, no build step. Match the surrounding code (2-space indent, single quotes, semicolons).
- Never insert untrusted text with `innerHTML`; use the `h()` helper or `textContent`. Never relax a sandbox (the game Play frame stays sandboxed).
- Anything that runs a program goes through the Rust runner's allow-list; do not add shell access.
- No tracking, no telemetry, no network calls the user did not ask for.
- Comments explain *why*, not *what*.

## Writing game blocks
Blocks are registered with `VXRT.registerBlock` (`B({ id, cat, label, desc, inputs, outputs, params, init, onInput })`). Give every block a short description, keep outputs predictable, clean up in `n.cleanups`, and add the block to the docs.

## Commit messages
Short imperative summary (`Fix kinematic bodies ignoring gravity`), then a blank line and details if needed. Reference the issue (`Fixes #123`).

## License
By contributing you agree that your work is released under **AGPL-3.0-only**, like the rest of the project. Do not copy code, art or sound you do not have the right to share.
