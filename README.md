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
npm run dev                 # pure demo (port 5173)
npm run dev:ineffable       # ineffable port (5174)
npm run dev:millersark      # Miller's Ark port (5175)
npm run dev:willow          # Willow Hall community demo (5176)
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

## Demo apps

| App | Notes |
|-----|--------|
| `apps/demo-pure` | Engine lab: zones, components, font switch |
| `apps/demo-ineffable` | Port of the personal site (layouts, fonts, W3 chrome) |
| `apps/demo-millersark` | Port of Miller's Ark CMS content + `openDaysTable` |
| `apps/demo-willow` | Content showcase; YAML source in sibling `data/` |
| `apps/editor` | Editor SPA: login + file-based record editor |
| `apps/editor-api` | Editing back-end: JSON auth + YAML records + flatten |

Editor: run `npm run dev:api` and `npm run dev:editor`, then open the SPA (port 7355). Willow records live in `apps/demo-willow/data/` (outside `public/`). A content page opens as raw YAML. Saving appends the previous file to `history/content/<id>.history`, then flattens to `apps/demo-willow/public/data/site.json`, writes `site.<hash>.json` and `rev.json`, and points `index.html` at the hashed file. That hashed name is what the browser caches. After `npm run build -w @r-a-i-t-h/tessera-editor`, the API also serves that build on port 7356. Add a user with `npm run seed:user -w @r-a-i-t-h/tessera-editor-api -- <name> <password>` (writes `apps/editor-api/seed/users/`). First boot copies seed users and `seed/meta.json` into `apps/editor-api/data/` when those files are absent. Seed login is `admin` / `admin`.

Authoring schema migrations (the hook node-vps-kit runs as `deploy/post-update.sh`) stamp `schemaVersion` on `data/meta.json`. The app does not bump that counter. After the API has created `meta.json`:

```bash
TESSERA_DATA=apps/editor-api/data sh deploy/migrate.sh
```

Legacy RecTem sources can be re-converted with `npm run convert:legacy` (needs a local `.ref-legacy/` checkout).

## Migration scripts

[`ps/`](./ps/) holds PowerShell helpers from the PurpleCMS → site-data era. They still target the old RecTem shapes and will be rewritten for Tessera’s `SiteDocument` later.
