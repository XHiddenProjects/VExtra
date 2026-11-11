# Block demo clips

One short clip per block, shown in Docs → Blocks. Each clip = the block's wiring + the real game running it + a one-line caption.

    node scripts/dev-server.js &            # the editor must be reachable on :5173
    node tools/block-demos/build.js         # all blocks   (or: build.js keyboard timer …)
    node tools/block-demos/build.js --manifest   # rewrite renderer/docs/clips/manifest.js

Needs Playwright (set `PW=/path/to/playwright` if it is not in `/opt/npm-tools`) and `ffmpeg`. Recipes live in `recipes-*.js` (`def(id, caption, graphFn, options)`); `core.js` builds the tiny game. A new block without a recipe simply has no clip.
