# Tessera

Client-side site runtime that renders an entire small website from one validated JSON document plus a site-owned component registry — **layouts declare zones**, **content fills them**, **components are TypeScript the site imports**.

| Doc | Role |
|-----|------|
| [SPEC.md](./SPEC.md) | Product + architecture: goals, design decisions, acceptance criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-built engine contract (packages, pipeline, Zod) |
| [ROADMAP.md](./ROADMAP.md) | Sequenced upcoming features |

## Quick start

```bash
npm install
npm run dev:site            # willow shell (port 5173); TESSERA_SITE=pure|ineffable|millersark
npm run dev:api             # editor API (port 7356; seed login admin / admin)
npm run dev:editor          # editor SPA (port 7355; proxies /auth /api /health)
```

## Test

```bash
npm test
```

## Packages

| Package | Path |
|---------|------|
| `@r-a-i-t-h/tessera-model` | `packages/model` |
| `@r-a-i-t-h/tessera-renderer` | `packages/renderer` |
| `@r-a-i-t-h/tessera-skin-w3` | `packages/skin-w3` |
| `@r-a-i-t-h/tessera-wc-base` | `packages/wc-base` |
| `@r-a-i-t-h/tessera-demo-kit` | `packages/demo-kit` (fonts, nav chrome, w3 helpers) |
| `@r-a-i-t-h/tessera-site` | `apps/site` (one host for `sites/<name>/shell`) |
| `@r-a-i-t-h/tessera-editor` | `apps/editor` |
| `@r-a-i-t-h/tessera-editor-api` | `apps/editor-api` |

## Sites

A site is a directory, not a package. Tessera’s version is the editor and the libraries. `TESSERA_DATA` points at one directory (default `sites/willow`). Replacing it and restarting changes the site.

| Directory | Notes |
|-----------|--------|
| `sites/pure` | Engine lab: zones, components, font switch |
| `sites/ineffable` | Personal site (layouts, fonts, W3 chrome, `randomCells`) |
| `sites/millersark` | Miller's Ark content + `openDaysTable` |
| `sites/willow` | Community showcase; the default editable site |

Each directory has `data/` (YAML records), `shell/` (chrome and micro-apps), and `publish/` (static export: hashed `site.json`, media). `meta.json` holds `schemaVersion`. Users and page history live in the same directory and are created when the editor runs.

Editor: run `npm run dev:api` and `npm run dev:editor`, then open the SPA (port 7355). A content page opens as raw YAML. Saving appends the previous file to `history/content/<id>.history`, then flattens to `publish/data/site.json`, writes `site.<hash>.json` and `rev.json`, and points the shell at the hashed file. That hashed name is what the browser caches. `TESSERA_DATA=sites/pure npm run dev:api` edits a different example. After `npm run build -w @r-a-i-t-h/tessera-editor`, the API also serves that build on port 7356. Add a user with `npm run seed:user -w @r-a-i-t-h/tessera-editor-api -- <name> <password>` (writes `apps/editor-api/seed/users/`). First boot copies seed users into `$TESSERA_DATA/users/` when that folder is empty. Seed login is `admin` / `admin`.

The public site is `publish/`. Nginx can serve it with the editor stopped, or you can copy that folder somewhere else. `npm run build -w @r-a-i-t-h/tessera-site` builds every shell into its `publish/` tree.

Authoring schema migrations (the hook node-vps-kit runs as `deploy/post-update.sh`) stamp `schemaVersion` on `$TESSERA_DATA/meta.json`. The app does not bump that counter. Records are inside that directory, so a later migration can rewrite them.

```bash
TESSERA_DATA=sites/willow sh deploy/migrate.sh
```

Legacy RecTem sources can be re-converted with `npm run convert:legacy` (needs a local `.ref-legacy/` checkout).

## Migration scripts

[`ps/`](./ps/) holds PowerShell helpers from the PurpleCMS → site-data era. They still target the old RecTem shapes and will be rewritten for Tessera’s `SiteDocument` later.
