# AGENTS.md

Browser painting app (web release of Kleki). Pure client-side TS, bundled by Parcel 2.16.4. No server code, no build framework config beyond `package.json`.

## Commands
- `npm ci` — install (`.npmrc` sets `ignore-scripts=true`, so no postinstall side effects)
- `npm run start` — dev server for standalone only, serves `src/index.html`
- `npm run build` — standalone bundle into `dist/`
- `npm run build:embed` — embed bundle into `dist/` (`src/embed.ts` + `src/help.html`)
- Generators (must run from repo root; scripts hardcode `./src/languages` paths):
  - `npm run lang:build` — regenerate `src/app/languages/*`
  - `npm run lang:build -- --missing` — list keys missing a translation
  - `npm run lang:add <code>` — new language file; `<code>` is an ISO-639-1 code from `src/languages/languages.json`
  - `npm run icon:build` — regenerate `src/app/icons/*`
- No lint, typecheck, or test tooling installed (no `tsc` in `node_modules`). `src/tsconfig.json` is informational; Parcel does not typecheck.

## Generated code — must run generators
`src/app/languages/` and `src/app/icons/` are gitignored and absent from a fresh clone. They are imported directly by app code (`src/app/script/language/language.ts`, icon modules). Build/start fails without them. Before any build/start that touches them, run `npm run lang:build` and `npm run icon:build`.

## Translations
- `src/languages/_base-en.json5` is the source of truth. Base keys are either a plain string or `{ hint?, value }`.
- In a translation file each key is `{ hint?, original, value }`. `original` must match the base string exactly; otherwise the key falls back to English at runtime.
- A key cannot be added to a translation unless it exists in `_base-en.json5`.
- `lang:sync` is NOT implemented (prints "not implemented"). Use `lang:add` + manual edits.

## Icons
- SVG in `src/icons/`; filename becomes the icon name. Root `<svg>` must have a `viewBox` and must not set `width`/`height`. Names must be unique.

## Entrypoints
- Standalone: `src/index.html` → `src/app/script/main-standalone.ts` → `kl.ts`
- Embed: `src/embed.ts` exposes a global `Klecks` (see `examples/embed/example.html`, needs `npm run build:embed` first; the example loads `../../dist/embed.js`). Embed API: `openProject`, `readPsd`, `getPSD`, `getPNG`, `onSubmit`.
- Service worker: `src/klecks-service-worker.ts`; compiled with its own scope at `src/app/script/service-worker/internals/tsconfig.json` (lib `WebWorker`).

## Build quirks
- Both build scripts pass `--public-url .` → relative asset URLs, so bundles work under any subfolder/cross-domain.
- `npm run start` uses `--no-cache`; Parcel cache lives in `.parcel-cache/`.