# Changelog

All notable changes to Vextra Studio. Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [3.8.0] — current

### Added
- **Languages:** Settings → Interface → Language – Español, Français, Deutsch, Português, Italiano, 日本語, 简体中文, 한국어, Русский, العربية (right-to-left) or Automatic. Menus, Settings, Welcome and file actions are translated; anything without a translation stays English. Plugins can add languages with `VX.i18n.register`.
- **Accessibility (the gaps listed in ACCESSIBILITY.md):** landmarks, roles and accessible names for icon buttons and unlabeled fields; dialogs trap focus, restore it on close and are announced; a live announcer for toasts, tab changes and canvas selections; *Skip to the editor* link; visible (optionally extra-thick) keyboard focus; Enter / Space on tabs and tiles.
- **Keyboard alternatives to dragging:** block graph – `[` / `]` step through blocks, arrow keys move the selection (Shift = 50), Enter opens a bundle; UI designer announces nudges.
- **Reduce motion** (Settings → Accessibility: System / Always / Never) – stops animations and skips Camera shake in games, also in exported games when the player's system asks for it.
- **High Contrast Dark / Light themes**, **Interface zoom** (70–200%).
- Docs: *Languages & accessibility*.

### Changed
- **Store Export installs everything from scratch.** Java 27 and the latest Gradle are always downloaded into `~/.vextra/toolchain` (`JAVA_HOME` / `GRADLE_HOME` are ignored). **Android SDK:** if Android Studio (or `ANDROID_HOME`) already has a complete SDK it is used as it is – nothing is downloaded and it is never changed; otherwise the newest SDK (platform, build-tools, licences) is installed there. If the SDK tools do not run on Java 27 they are run with Java 21 automatically, rechecks them before every export and, when a newer version exists, **deletes the old one** (JDK, Gradle + its caches, old SDK platforms / build-tools) before installing the new one. Disk space is checked first, interrupted downloads are cleaned up, and a failed update keeps the installed version – setup never stops the export with an error.
- The Android build writes `mobile/dist/<name>-debug.apk` (or `-release.aab`), removes the machine-specific `local.properties`, and retries with Java 21 and the project's own Gradle if the newest Java does not fit. The `android/` folder opens in Android Studio (or on a Mac) as is; README-MOBILE explains the transfer. Capacitor packages use `latest`.
- **Android builds sync with Android Studio automatically (no dropdowns):** Vextra looks at the computer by itself – Android Studio's bundled Java (or `JAVA_HOME` / PATH Java 17–23), the Android SDK Studio uses (including newer platforms like Android 17) – and uses them as they are; only what is missing is downloaded (Java 21 LTS, newest SDK). Android builds do not run on Java 27, so the default download is now Java 21.
- **Gradle wrapper → latest:** `android/gradle/wrapper/gradle-wrapper.properties` gets the `distributionUrl` of the latest release from `services.gradle.org` (checksum updated); if the project's Android Gradle plugin cannot run on it, the original version is restored and the build continues.
- **Android Gradle plugin updates:** `npm run update:agp` (and automatically when a build fails because the plugin is too old for the Gradle or Android platform) raises the project's Android Gradle plugin to the newest stable release from Google's Maven repository (`dl.google.com`); if the newer plugin does not build either, the project's original version is restored.
- **ProGuard / R8:** release builds use `proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`.
- **Android build fixes:** an installed platform such as **Android 17 (API 37.0)** is used through a link folder (`~/.vextra/toolchain/sdk-overlay`, where `android-37` leads to your `android-37.0`) because the Android Gradle plugin can only name whole-number platforms – your SDK itself is never changed; if a platform cannot be used the next installed one is tried, then platform 36, which the Android plugin fetches itself when missing; projects with Android Gradle plugin 8 or older go straight to Java 21 + the project's own Gradle instead of failing on Gradle 9 first; a missing platform is no longer reported as a licence problem.
- Plugin Store Export 2.3.0.

## [3.7.0]

### Added
- **Loading page for every game** (Game toolbar → ⏳ Loading page): shown while a game loads in exported pages and in Play. Customize the title, subtitle, progress style (bar / spinner / dots), colours, logo (one of your sprites), rotating tips, minimum time and the percentage. It has a real progress bar (runtime → pictures → start). The game starts when it is done.
- **Credit and copyright:** the loading page always shows “Made with Vextra Studio · © <year> XHiddenProjects” (move it top / bottom and change colours). Exported **websites** get the same line as a footer on every page (or the home page only) with alignment / style options in Export website; exported **UI designs** carry it too.

### Changed
- **Store Export uses Java 27** (falls back to the newest older release if the download service does not offer it yet). Downloads wait up to 2 minutes for a slow server and retry network errors up to 4 times instead of failing with “timed out”. Store Export plugin 2.2.1.


### Fixed
- **Spawned objects were invisible in some games** (Marble Lanes pins, Core Defender crawlers…): the Spawn block passed an empty rotation that wiped the object's default, so its 3D rotation became NaN and it was not drawn. Spawned objects now keep their defaults.
- **Echo Maze:** the Stalker now hears your real voice (the Voice Noise range was far too small, so only shouting next to it worked), and the “No microphone” text only appears when the microphone really cannot be opened.

## [3.6.0]

### Added
- **`ACCESSIBILITY.md`** – what the editor supports today, known gaps, and how to make accessible games.
- **Light block** (Properties): changes a 3D light's brightness and colour live (day / night switches, flickers, torches). The Showroom's keys 1-3 use it.
- **Layers – Background, World, UI.** Every object has a *Layer* (Inspector → Appearance). Background is drawn first, World follows the camera, **UI is screen-space and always on top** (it ignores the camera and screen shake, and clicks on it use screen coordinates). In 3D, Background objects render behind the scene. The viewport toolbar has a layer bar: pick the layer new objects are added to, hide a layer or lock it (locked layers can't be picked) while you edit. The hierarchy marks BG / UI objects.
- **Cursor and object position readout** in the 2D and 3D viewports: live `Cursor X, Y` (3D: `Ground X, Z`) plus the selected object's position (and size), so you know exactly where to place things.
- **Edit UI layout** (viewport toolbar): shows the game screen with every Label / Bar block of the scene and drag them to where you want them. Pick the anchor (9 positions) and type exact X / Y, snap to 4 px (hold Alt for free movement), Reset to go back to the block's own values. The layout is saved per scene (`scene.uiLayout`) and applied when the game runs, even for blocks written in code behaviours.
- The screen position readout also works inside the UI-layout editor (`Screen X, Y`).

### Changed
- **All ten example games are built from blocks.** Every game is a set of wired block graphs (Mailbox / Message, Timer, Sensor, Proximity, Hearing, Ray Cast, List blocks, Expressions…) in the project's `behaviors` object – no raw code. Open one, press Logic and you can read, rewire and extend it.
- Ray Cast **"camera" direction** now includes where you look up / down (pitch), so a crosshair shot hits what the crosshair is on.
- **Object scripts are now behaviours.** Scripts that used to sit inside an object (all ten example games now store their logic in the project's `behaviors` object and list the behaviour ids on their objects – no `script` keys remain; older projects and plugins are converted on open) become real code behaviours (`Player script`, …) shown in the Logic tab, editable, reusable and attachable to other objects. Old projects are converted automatically when opened. (The runtime still understands a raw `script` field, so nothing breaks.)
- The Logic tab's code → blocks preview no longer touches real engine services (microphone, particles…) while previewing a script.
- Labels never wrap onto several lines when anchored to the right edge.

### Fixed
- **3D example lights:** the Sun and Sky light of the 3D examples were created as plain point lights (their settings were dropped), so shadows and brightness were off. They are now a real directional sun and a hemisphere sky light.

## [3.5.0]

### Added
- **Ten example games** in Library → Games (open one, press Play, then edit it): 2D – Neon Breakout, Drone Swarm, Sling Smash, Hopper, Echo Pads; 3D – Echo Maze (first person, the Stalker hears your real voice), Sky Parkour (kinematic moving / crumbling platforms, checkpoints), Hyper-Real Showroom (Realism look), Core Defender (arena defence) and Marble Lanes (bowling physics).
- **Store Export rework (plugin 2.2.0):** detects Java through `JAVA_HOME` (Android Studio is no longer used or required), shows the prerequisites, then a plain-text **checklist** (spinner → ✓ / ✕) instead of a terminal. Missing Java (Temurin, latest LTS) and Gradle (latest) are downloaded automatically into `~/.vextra/toolchain` (no admin rights) and updated automatically; the Android SDK command-line tools / platform / build-tools are installed and kept at the latest version. Every download is HTTPS-only, from an allow-listed official host, SHA-256 verified before unpacking.
- Plugin API: `forge.ui.checklist` (progress list with spinner / ✓ / ✕).
- **Speech service fallback:** Settings → Voice commands (games) – when the web engine has no speech recognition (desktop app), Voice Command can send short recordings to an OpenAI-compatible `/audio/transcriptions` endpoint you configure (mode Auto / Browser / Service).
- Community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ISSUE_TEMPLATES.md`, `PULL_REQUEST_TEMPLATE.md` and the matching `.github/` templates.
- Physics: **Kinematic + gravity** option (`kgravity`) so kinematic bodies can fall and still push other bodies.

### Fixed
- **Voice Command said "needs an internet connection"** while online: that was the desktop engine's speech service failing (`network`), not your connection. The message now says so, stops retrying, and points to the fallback above.
- **First-person mouse look was inverted** in some camera setups: the look action now follows the view that is actually drawn.
- **Kinematic bodies sometimes did not move / ignored gravity:** kinematic bodies are driven by their velocity and now optionally gravity (see above).

## [3.4.1]

### Changed
- `package.json` license is now **GNU Affero General Public License v3** (SPDX `AGPL-3.0-only`).

### Fixed
- **Microphone and camera blocks failed in the editor even with the device allowed.** The Play frame is sandboxed (no origin), and the browser / WebView2 / WebKit refuse `getUserMedia` there (`SecurityError`). The editor now owns the devices (new `editor/sense-host.js`) and streams plain data into the game: microphone analyser data, camera frames and recognised speech. Every Microphone, Sound Detector, Voice Noise / Hearing, Voice Command, Camera, Motion, Colour, Light, Face, Photo and AR-camera block now works in Play. Exported pages and phones still use the devices directly.
- **Camera hardening:** the editor retries simpler camera requests (many webcams reject width / height / facing constraints), keeps the camera element on-screen so the web engine keeps decoding, and reports "opened but sent no picture" instead of failing silently. Errors now always include the technical name (e.g. `[NotReadableError]`).
- Clear, specific error messages (blocked / no device / in use by another program / Windows or macOS privacy setting to switch on / no speech recognition in this engine), shown on the block's `error` exit **and** in the game log.
- The camera and microphone are released when the game is stopped or restarted.
- macOS: added `NSMicrophoneUsageDescription`, `NSCameraUsageDescription` and `NSSpeechRecognitionUsageDescription` (`src-tauri/Info.plist`) so the system asks instead of silently refusing.

### Note
- Voice Command needs a speech-recognition service in the web engine (Chrome, Edge, Safari). The desktop app's engine may not have one; the block then reports it – use its "say" entry / test keys, or play the exported game in a browser.

## [3.4.0]

### Added
- **Author** in package.json set to XHiddenProjects.
- **Store Export uses Android Studio** (plugin 2.1.0): Android builds now run on the latest Android Studio – its bundled Java (JBR) and the project's Gradle wrapper, plus the Android SDK. New generated `scripts/android-env.js` finds Android Studio / JDK / SDK on Windows, macOS and Linux (incl. JetBrains Toolbox, `ANDROID_STUDIO`, `ANDROID_HOME`), writes `local.properties`, accepts SDK licences; `build-android.js` (debug APK, or `--aab` release bundle), `open-android.js`; new `npm run doctor:android` / `build:aab`. The automatic export checks for Android Studio first; if it is missing you get the download link, the Android build is skipped and the rest still exports.
- **Realism** (hyper-realistic 3D): a physically based *Realism material* option in the Material editor (clear coat, sheen, transmission / real glass, index of refraction, thickness, iridescence, procedural micro-surface detail, reflection strength) with 11 ready-made materials (car paint, brushed steel, polished marble, leather, velvet, concrete, skin, glass, soap bubble, wet asphalt, rubber); a **realism** object shader; and a **Realism (hyper-real camera)** Shader-block effect – filmic tone curve, bloom, vignette, colour fringing, film grain, sharpening, plus filmic tone mapping, soft shadows and sky-based lighting for the whole 3D scene.
- **Microphone blocks** (new category): *Microphone* (level, pitch, bands, loud / quiet), *Voice Command* (speech recognition, one exit per command), *Sound Detector* (clap, double clap, whistle, shout, silence), *Voice Noise* + *Make Noise* + *Hearing* (enemies that hear the player's voice / footsteps and walk to the sound).
- **Camera blocks** (new category): *Camera Feed*, *Motion Sensor* (motion, swipes, 3×3 zones), *Color Tracker*, *Light Sensor*, *Face Tracker*, *Photo*. Frames are analysed on the device only.
- **VR blocks** (new category): *VR Mode* (WebXR headset or split-screen cardboard fallback), *VR Head* (with nod / shake), *VR Controller*, *VR Move* (smooth, snap turn, teleport), *VR Grab* (hold + throw), *VR Haptics*, *VR Gaze*.
- **AR blocks** (new category): *AR Mode* (WebXR or camera-behind fallback), *AR Surface*, *AR Place*, *AR Pinch & Turn*, *AR Light Match*, *AR Shadow Floor*, *AR Distance*.
- Docs: "Microphone, Camera, VR & AR blocks" and "Realism material & hyper-real look".

### Changed
- When a Shader block's effect is **Custom shader file** it shows a **drop-down of your shader files**; new effect **Custom material file (3D)** shows a drop-down of your materials; the custom 3D code box only appears for *Custom 3D code*. Blocks can now hide parameters that do not apply (`showIf`).
- Selecting **Shader → custom** on a 3D object in the Inspector shows a drop-down of your shader files. A shader file now also works on 3D objects (`T(uv)` is the lit object colour).
- The game preview allows microphone, camera and WebXR; the 3D canvas is now transparent-capable (needed for AR).

### Fixed
- Shader files / the realism shader could not use the game's assets on 3D objects (the asset list was not passed to the shader builder).

## [3.3.0]

### Added
- **Drag to reorder**: editor tabs, bottom-panel tabs (Console / Problems / Output) and the sidebar icons can now be moved by clicking and dragging them (a line shows where they will land; the order is remembered). Works with the pointer, so it also works inside the desktop webview.
- Vextra AI: **Build & change site** permission with `new_site` / `preview_site`, **checkpoints** with a Continue button, a **token usage bar**, a *Context window* setting that applies to every provider, a time-out lock banner, **Reconnect** with a 3-second auto-reconnect countdown, and more providers (Mistral, DeepSeek, xAI, Together AI, custom Anthropic-compatible).

### Changed
- `package.json` now lists every dependency as `"latest"` (so `npm install` always takes the newest release; `package-lock.json` records what was installed). `three` is 0.187.
- Vextra AI: the model list starts empty (“— select a model —” / “— none found —”) instead of auto-filling a default model; every provider remembers its own saved model.

### Fixed
- **Security (CodeQL)**: Vextra Shield no longer builds script code from strings – its scripts are fixed text and the settings (game id, allowed sites) travel as escaped HTML attributes (fixes “Improper code sanitization” ×3); the script-tag regular expressions now also match `</script foo>` (fixes “Bad HTML filtering regexp”, also in the AI preview and the web tools).
- **GitHub upload blocked by `vextra-server.exe`**: the bundled server binary is over GitHub's 100 MB file limit. It is now tracked with **Git LFS** (`.gitattributes`, not git-ignored; `npm run lfs:setup` does the one-time setup, see the README). Installers (`.msi`, `.dmg`, `.AppImage`, `.deb`) stay ignored.
- Tabs and panels can be rearranged by dragging (before, they could not be moved at all).
- Vextra AI: new permission **Build & change site** (Deny / Ask / Allow, part of every preset). Website files (html, css, js, ts, vue, svelte, json, svg, md…) are written under it; *Create & edit other files* covers the rest. New actions `new_site` (scaffolds index.html + style.css + script.js without overwriting) and `preview_site` (shows the page with its css/js inlined).
- Vextra AI settings: changing the provider no longer carries the previous model over or auto-fills one (no more `llama3.2:latest` default). The model list starts at “— select a model —” (“— none found —” when the server returns nothing); each provider remembers the model you saved for it.
- Vextra AI: the request timeout now defaults to **1 hour** (3600 s, also the maximum; was 120 s, max 300 s) so slow local models can finish long answers. If you saved a different value in Settings it is kept.
- Vextra AI: the **Context window** setting now applies to every provider – older messages are dropped to fit it and the answer length is capped to half of it (Ollama also gets it as `num_ctx`).
- Vextra AI: the token bar no longer goes backwards. It showed the size of the *latest* request, which can shrink (older messages are trimmed, Ollama reports only uncached prompt tokens, estimates vary); the context fill now only grows within a chat.
- Vextra AI: the chat always matches the Settings – the panel shows the current provider · model, and changing the model, provider or permissions updates the chat (model label, permission preset, usage window) immediately.
- Simple / Advanced mode: the status-bar toggle, the Settings page and the command palette stay in sync (changing it in one updates the others).
- Vextra AI: the **Stop** button now works immediately – it ends a waiting request or a pending action instead of only stopping between steps.
- Vextra AI: after a time-out the box is locked and a banner shows when you can run it again (30 s, doubling to 5 min on repeated time-outs).
- Vextra AI: **checkpoints** – when a run is stopped, times out, errors or hits the step limit, a Continue button picks up where it left off (saved with the chat, survives restarts).
- Vextra AI works with more models: adapts to what a server accepts (drops `response_format`, `temperature` or the system role, uses `max_completion_tokens` when asked), strips `<think>…</think>` reasoning, handles array-style replies, and adds Mistral, DeepSeek, xAI (Grok), Together AI and a custom Anthropic-compatible provider.
- Vextra AI: deleting a chat removes it right away, and if none are left a fresh empty chat is inserted. The internal `data-tag` attribute on chat bubbles is gone.
- Vextra AI: new **token usage bar** under the chat (context used vs. the model's window, amber above 70 %, red above 90 %, plus per-chat in/out totals; real counts from the provider, estimated otherwise). New *Context window* setting.
- Vextra AI: network failures now just say “⏱ The AI has timed out.”. Cloud providers get a **Reconnect** button that waits for the internet and then auto-reconnects after a 3-second countdown, resuming the request; local models get **Retry**.

## [3.2.0]

### Added
- **Vextra Shield** plugin (`plugins/vextra-shield.js`): CSP with script hashes and signed saves for exported games, password policy, sign-in lockout, idle sign-out, plain-http warning, secret scan before publishing and a **Security audit** command (writes `SECURITY-AUDIT.md`). Configurable with a ⚙ button.
- **Plugin API**: `forge.config.register` (⚙ **Configure** button on plugin cards), `forge.hooks` (`game.export.html`, `account.register/login/password`, `account.loginOk/loginFailed`, `publish.before`), `forge.onUnload`, `forge.fs.list`, `forge.account.signOut`.
- **One Animation block** does everything: sprite animations, 3D model poses, keyframe clips, **Auto** mode (idle / walk / jump / fall from movement, with facing) and effect presets. Its animation list **syncs with the target** (dropdown of what that object can play). The separate *Animation clip* and *Movement Animator* blocks are removed; old projects are converted automatically.
- **F3** in 3D games cycles 1st person → 3rd person (behind) → 3rd person (front) for the followed object.
- **Vextra AI builds for you**: ask for a game or website and it plans, then builds — opens a game, adds scenes, objects, pixel-art sprites and ready-made assets, writes block-coded behaviours (after looking up the real blocks, ports and params), attaches them, checks the result and fixes errors; for web projects it creates, edits, moves and deletes files and folders in the open folder. Each game change is one undo step. New **Builder** preset and a separate *Delete / move* permission. New plugin APIs: `forge.fs.remove/rename/mkdir/open`, `forge.game.kit()`, `forge.game.newGame()`.
- **Vextra AI** plugin (`plugins/vextra-ai.js`): chat with Claude, OpenAI, Gemini, Groq, OpenRouter, Ollama, LM Studio or any OpenAI-compatible server. Per-ability Deny / Ask / Allow permissions (read project, edit open file, write files, change game); secret files are never read. New `forge.net.request` and `forge.game.editor()` plugin APIs.
- **Account security** (Vextra Shield section in *Your account*): authenticator-app two-step sign-in (TOTP), one-time recovery codes and security keys / passkeys (WebAuthn). The server asks for the second step at sign-in and rate-limits attempts.
- **Local server button**: the desktop builds (`build:win`, `build:linux`, `build:mac`) bundle the Vextra server (compiled into one executable with Node's built-in single-executable support (needs Node 20+ and the small `postject` helper; ~120 MB), otherwise run with Node.js). *Cloud → Start local server* (and Settings, plus optional auto-start) starts it on 127.0.0.1 — no terminal.
- Plugin settings open as a roomy editor tab named `plugin:<name>`; the plugin card shows its buttons in a separate row under the tags.
- Every field that names an object (Target, Spawn → Object to spawn, Look at, Collides with, Send to, Only hit, HUD follow…) is now a dropdown of the project's objects and tags (with “Custom…” for expressions).
- Demos: the 2D demo robot now has idle, walk and jump animations; the 3D demo has a third-person animated robot model (walk, idle, jump) and stops when keys are released.

### Removed
- *State Flag* block (use a Variable or Toggle Switch).

### Fixed
- Vextra AI: **Ollama and LM Studio are local-only**. Ollama now uses its own local API (`/api/chat`, `/api/tags` on `http://localhost:11434`, whatever of `/api` or `/v1` you typed is ignored); any non-local address (such as ollama.com cloud) is refused with a clear message – pick the separate **Ollama Cloud** provider (API key) to use ollama.com, or *Custom* for another remote server. No API key is ever sent to a local provider.
- npm warning `prebuild-install@7.1.3: No longer maintained`: it came from the `@yao-pkg/pkg` dev dependency, which is removed. The local server is now compiled with Node's built-in single-executable feature (`postject`), so `npm install` has no deprecated packages.
- Local connections (AI/Ollama, local Vextra server) always use IPv4 (`127.0.0.1`), never `[::1]`.
- Vextra AI: a server URL without `/v1` (e.g. `http://localhost:11434`) now works for chat and the model list (404 fixed; `/v1` is added automatically, with a fallback). Local/small models are asked for a strict JSON reply (`response_format`) so they actually perform the build instead of describing it. The AI now sees what is open (the current game with its scenes/objects/behaviours, or the open file) and builds into it. Chats are saved: a history list, New and Delete in the AI panel.
- Vextra AI only described the build instead of doing it with smaller/local models: it now accepts sloppy action formats (```vx, ```json, bare JSON, game operations written as actions), folds them into one undoable game edit, and re-prompts the model once or twice when it describes steps without performing them.
- Plugin settings did not save or apply in the desktop app: the plugin host kept a stale copy of the settings object created before settings were loaded. It now reads the live settings.
- Vextra AI: the model is a dropdown (installed models for Ollama / LM Studio, models your key can use for cloud providers, “Other…” to type one), the provider is detected from the API key, and the panel icon is a bot.
- Store Export: the progress dialog no longer floods or hangs on long/failed builds; failed steps show a plain-language hint; generated projects approve the install scripts they need (`electron`, `sharp`, `esbuild`) and skip Windows code-signing tools that need admin rights.
- Checkboxes in forms were squeezed into a dot.
- Animation block restarted every frame while a key was held, so walking animations never advanced. A running animation is no longer restarted (new *Restart if already playing* option).
- 3D model animations leaked the previous pose into the next animation; poses now reset on change.
- Selection outlines were left behind (“ghost outline”) after scaling/editing 3D objects.

### Changed
- `package.json` allows the `esbuild` install script by default (`allowScripts` for npm 11.16+/12, plus pnpm, Bun and Yarn), so `npm install` no longer warns about it.

### Security
- See SECURITY.md (3.2.x). New hooks run with editor privileges like any plugin; Vextra Shield adds no network access.

## [3.1.0]

### Added
- **Animation studio for sprites** (new *🎞 Animate* tab in the Sprite editor): named animations, drag-to-reorder timeline, per-frame hold, fps, loop / once / ping-pong, frame bin, large pixel-perfect preview that **starts paused** (the old auto-looping mini preview is gone), Space/←/→ shortcuts.
- **Animation studio for 3D models** (new *🎞 Animate* tab in the Model editor): keyframe poses for the whole model or any part (move, rotate, scale), live 3D preview. Play with the Animation block (name = animation name).
- **2D lights**: a Light object for 2D scenes plus *Darkness* and dark colour in Scene settings. Circle or cone, radius, softness, intensity, flicker.
- 3D light helpers in the editor: reach spheres for point lights, aim lines for directional/spot lights.

### Changed
- Sprite animations store `animMeta` (fps, loop, timeline) next to the frame lists; older projects are upgraded automatically. The loop mode set in the editor is used by the Animation block.
- Sprite editor’s draw tab shows the current frame only.

### Security
- No new permissions. SECURITY.md updated with the supported-versions table for 3.1.x.

## [3.0.0] — previous release

### Added
- **Library** tab: install website templates and 2D/3D games from an https URL (zip, `.vxgame`, GitHub repo or `index.json` catalog) with defaults and a confirm step. New native `http_download` command and in-app ZIP reader.
- **Animation clips** (keyframe editor, loop modes, easing, relative values) and a **Play animation** block.
- **Material files** (`.vxmat`, `.mtl` import) usable on 3D objects, models and model parts; shared studio lighting so metals render correctly.
- **Shaders**: 25 effects with modes (everything, background, game layer, UI layer, labels, object) and custom shader files.
- More default 2D/3D assets via a default-asset picker.
- Blocks: self-connection, **Switch** and **Toggle switch**, Number rounding, Collision `side` output/filter, Cursor `none`, block icons, horizontally resizable block settings.
- File-type badges (PHP, SQL, SQLite, …) in the explorer.
- **Store Export 2.0**: after writing the packages it runs `npm install`, platform setup, asset generation and the build with a progress bar, live log and cancel. Backed by a restricted Rust runner (`run_start/run_poll/run_cancel`: npm/npx/node only, cwd must be inside `store-export`, no shell, safe argument characters).
- Plugin API: `forge.proc.run`, `forge.ui.progress`.

### Changed
- `build:exe` replaced by `build:win`, `build:linux`, `build:mac`.
- Responsive layout: toolbars wrap, side panels overlay on narrow windows, grids reflow.
- Read-only notice now shows at the top of the code pane.

### Security
- The Library only downloads over https, caps size at 50 MB and sanitises archive paths. See SECURITY.md.

## [2.0.0]

Everything after the first downloadable build (v1.0.0).

### Added
- **Close workspace** (explorer toolbar button and Command Palette). Closes all tabs (asking about unsaved changes), returns to the Welcome page and no longer auto-reopens the last folder.
- **Remove items from Recent**: ✕ on each entry plus *Clear all*; the Welcome page updates immediately.
- Full **Markdown Preview** plugin (outline sidebar, tables, task lists, syntax-highlighted code with line numbers, sticky Copy button, Rendered/Source toggle).
- **Web backend tooling**: any file type, internal SQLite database (`database.sqlite`, `VXDB` in previews), PHP preview (needs PHP installed), local static server, templates (blank first, PHP + SQLite).
- **Export website** as ZIP or tar.gz including `.htaccess` and `nginx.conf`.
- **Store export** plugin (Steam / Google Play / Apple App Store packaging helpers; store accounts required to publish).
- Blocks: `once` trigger, Expression inputs A–F, Ad block *service* option, camera width/height follow (2D) and first-person camera (3D); first-person 3D demo.
- Real **Simple / Advanced** mode; collapsible block editor panels and nodes; device frames that stay in view.
- Blank new 2D / 3D / UI / web projects.
- **Update indicator**: on start-up (and via *Settings → Check for updates*, the version label in the status bar, or the Command Palette) Studio reads the `VERSION` file of `XHiddenProjects/VExtraStudio` and shows a **⬆ Update vX.Y.Z** badge when a newer version exists, with *Skip this version*. A `VERSION` file now ships in the repo root — keep it in sync with `package.json` when you release. Can be turned off in Settings.
- `SECURITY.md` and this changelog.

### Changed
- Dependencies now use `^` ranges: `@tauri-apps/cli ^2.12.4`, `ace-builds ^1.45.2`, `three ^0.186.1`, `sql.js ^1.15.2`, `esbuild ^0.28.2`.
- three.js upgraded 0.170 → 0.186. Its split build (`three.module.js` + `three.core.js`) is bundled into a single file by `scripts/vendor.js` (via esbuild) so exported games still inline one module.
- Selection outline, preview interactivity hardening, adaptive layout, sticky documentation Copy button.

### Fixed
- **Explorer showed no files** in projects containing file types without a dedicated icon (`.php`, `.sql`, `.md`, `.htaccess`, `LICENSE`, …): the row builder threw on an empty CSS class and aborted the whole tree. Fixed, and a failing row can no longer blank the explorer.
- CodeQL alerts: *improper code sanitization* (inline-script values in the preview console/DB shims and game export are now escaped with `VX.jsLit`, covering `</script>`, `<!--` and U+2028/2029) and *replacement of a substring with itself* in `highlight.js`.
- **Double paste**: copy / paste / duplicate / undo / redo fired twice because the viewport or graph handler and the editor root both handled the same key press. Keys handled by a canvas are now flagged and skipped by the root.
- Labels disappearing after a game reset; Timer → Camera/Label wiring; Play device frame invisibility; Expression input state; unused-variable Rust warning.

### Security
- **Cross-window communication with unrestricted target origin**: all editor ⇄ preview messages now require a per-session token and a verified `source`; targets are pinned to the page origin (Play iframe uses `'*'` because it has an opaque origin, protected by the token). See `SECURITY.md`.
- **glib `VariantStrIter` unsoundness (RUSTSEC-2024-0429)**: transitive via Tauri's GTK3 stack, unused by Vextra, Linux only; documented in `SECURITY.md` and will be resolved with the Tauri upgrade.

## [1.0.0] — first downloadable build

- Tauri v2 desktop app: code editor, UI designer, 2D/3D game editor with block graph and script views (≈100 blocks in 9 categories), asset studios (sprite, model, sound), live web preview, plugin system with docs, cloud/sharing server with accounts, uninstaller/cleanup tools, documentation viewer, themes.
- Game export to standalone HTML; demo 2D and 3D games.
