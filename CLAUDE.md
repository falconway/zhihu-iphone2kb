# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A fork of [qtqz/zhihu-backup-collect](https://github.com/qtqz/zhihu-backup-collect) (a Tampermonkey userscript that saves Zhihu articles/answers/thoughts as Markdown / ZIP / PNG) **adapted to run on iOS Safari**, where the original cannot save files because iOS WebKit lacks the File System Access API and ignores the `<a download>` attribute under userscript sandboxing.

The fix: on iOS, route every file save through `navigator.share({ files: [...] })` so the user gets the share sheet → "Save to Files" → any folder in the Files app.

## Repository layout

Two sibling folders, both at the repo root:

- `zhihu-backup-collect/` — **read-only vendored clone of upstream**, kept as a reference for future re-syncs after upstream updates. Has its own `.git`. Listed in this repo's `.gitignore` and not tracked. Do not edit.
- `zhihu-backup-collect-ios/` — **the actual maintained code**. All work happens here.

When upstream updates: `cd zhihu-backup-collect && git pull`, then diff the `src/` against `zhihu-backup-collect-ios/src/` and reapply iOS patches by hand. The list of patched files is short — see "iOS-specific changes" below.

## Build & test (run inside `zhihu-backup-collect-ios/`)

The original repo expected `pnpm`; this fork uses npm with `--legacy-peer-deps` because `uglifyjs-webpack-plugin@2.2.0` declares a webpack 4 peer that webpack 5 doesn't satisfy.

```bash
npm install --legacy-peer-deps      # one-time
npm run build                        # webpack production + assemble dist/tampermonkey-script.user.js
npm run dev                          # webpack --watch (development bundle)
npm run lint
```

Build output: `dist/tampermonkey-script.user.js` is the user-facing artifact. The `.user.js` suffix is **mandatory** — both desktop Tampermonkey and Tampermonkey/Userscripts on iOS only show the install prompt when navigating to a URL whose path ends in `.user.js`. Renaming this file (or the `@updateURL`/`@downloadURL` it points at) breaks one-click install. `dist/bundle.min.js` is the webpack output that `scripts/build-tampermonkey.js` wraps with the `==UserScript==` header.

There is **no test framework** wired up. If asked to add tests, use Node's built-in `node --test` runner before reaching for Jest/Vitest — keeps the dep tree clean.

## Architecture (what to know before touching code)

The original codebase is structured as a DOM-scraping pipeline → in-memory Markdown/ZIP/PNG → file save. The iOS fork only changes the **last** step.

**Pipeline (untouched from upstream — do not modify unless fixing a scraping bug):**

1. `src/index.ts` mounts buttons on Zhihu DOM nodes (`.RichText` blocks) and wires click handlers.
2. `src/dealItem.ts` orchestrates per-item processing (detects page type, gathers comments, etc.).
3. `src/core/lexer.ts` + `parser.ts` walk the DOM and emit Markdown.
4. `src/core/savelex.ts` + `download2zip.ts` build a JSZip with images + Markdown + metadata.
5. `src/core/parseComments.js` + `renderComments.js` handle the comment subsystem.
6. `src/core/obsidianSaver.ts` is upstream's "save to a chosen folder" feature using the **File System Access API** — does not work on iOS and gracefully alerts when `window.showDirectoryPicker` is missing. Leave its detection branch alone.

**iOS-specific changes (this is what we maintain):**

- `src/core/iosSave.ts` — new file. Exports `iosAwareSave(blob, name, mime)` and `iosAwareSaveDataUrl(dataUrl, name, mime)`. Detects iOS via UA (including iPadOS-as-Mac via `MacIntel` + `maxTouchPoints > 1`) and prefers `navigator.share({ files: [File] })`, with `window.open(blobUrl)` as fallback when `canShare({files})` is false. Falls through to the original `file-saver` `saveAs` on desktop.
- `src/index.ts` — three save call sites swapped to use the helper:
  - ZIP button: `saveAs(blob, ".zip")` → `iosAwareSave(...)`
  - Text/MD button: `saveAs(blob, ".md")` → `iosAwareSave(...)`
  - PNG button: `<a download>.click()` → `iosAwareSaveDataUrl(dataUrl, ".png", "image/png")` (note the surrounding `.then(...)` was made `async` so we can `await`)
- `package.json` name → `zhihu-backup-collect-ios`, version suffix `-ios.N`
- `TampermonkeyConfig.js` script `name` → `知乎备份剪藏 (iOS)`, `namespace` → `qtqz-ios` (so it can coexist with the desktop original in the same script manager)

When `navigator.share` is invoked it MUST be inside the synchronous user-gesture stack on iOS Safari, otherwise the call is rejected. The current call sites are already inside click handlers, so this works — but if you refactor, do not introduce extra `await`s before the share call.

## When making changes

- Scraping/parsing bug? Likely upstream's problem. Check if upstream fixed it (`cd zhihu-backup-collect && git log --since=...`) before patching locally.
- Save-path bug? That's our patch surface — `iosSave.ts` and the three call sites in `index.ts`.
- Don't add the iOS save logic to `obsidianSaver.ts`; that whole module is gated on `showDirectoryPicker` and stays inert on iOS by design.
- Verify after build: `grep -c "canShare\|navigator\.share" zhihu-backup-collect-ios/dist/tampermonkey-script.user.js` should return ≥ 2, confirming the share API survived minification.
