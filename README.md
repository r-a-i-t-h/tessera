# Tessera

Client-side site runtime that renders an entire small website from one validated JSON document plus a shared component catalogue — **layouts declare zones**, **content fills them**, **components ship with Tessera and every site may name them**.

| Doc | Role |
|-----|------|
| [SPEC.md](./SPEC.md) | Product + architecture: goals, design decisions, acceptance criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-built engine contract (packages, pipeline, Zod) |
| [ROADMAP.md](./ROADMAP.md) | Sequenced upcoming features |

## Quick start

```bash
npm install
npm run dev                 # site (5173), API (7356), and editor (7355)
npm run dev:site            # data/ shell only; empty until a backup is restored
npm run dev:api             # editor API only (seed login admin / admin)
npm run dev:editor          # editor SPA only (proxies /auth /api /health)
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
| `@r-a-i-t-h/tessera-extras` | `packages/extras` (shared component catalogue) |
| `@r-a-i-t-h/tessera-site` | `apps/site` (one runtime; dev serves `data/shell`, or `sites/<name>/shell` when `TESSERA_SITE` is set) |
| `@r-a-i-t-h/tessera-editor` | `apps/editor` |
| `@r-a-i-t-h/tessera-editor-api` | `apps/editor-api` |

## Sites

A site is a directory, not a package. Tessera’s version is the editor and the libraries. `TESSERA_DATA` points at one directory (default `data/`, empty until you restore an archive). `backup/` sits next to it and is not part of a release. Replacing `TESSERA_DATA` and restarting changes the site.

| Directory | Notes |
|-----------|--------|
| `sites/pure` | Engine lab: zones, components, font switch |
| `sites/ineffable` | Personal site (layouts, fonts, W3 chrome, `randomCells`) |
| `sites/millersark` | Miller's Ark content + `openDaysTable` |
| `sites/willow` | Community showcase. Archived into `backup/willow.tar.gz` on first boot; not the running site |

Each directory has `records/` (YAML records), `shell/` (static chrome: `index.html` and `site.css`), and `publish/` (static export: hashed `site.json`, media, and the stamped runtime). `meta.json` holds `schemaVersion`. Users and page history live in the same directory and are created when the editor runs. A site has no build step and does not contain component source.

Editor: run `npm run dev:api` and `npm run dev:editor`, then open the SPA (port 7355). A content page opens as raw YAML. Saving appends the previous file to `history/content/<id>.history` and updates the snapshot. **Render site** flattens every page into the instance `publish/` tree that the preview on port 5173 is serving (`site.json`, `site.<hash>.json`, and `rev.json`), and points the shell at the hashed file. That hashed name is what the browser caches. `sites/` is reference material and is not that output. The API edits `data/` unless you set `TESSERA_DATA`. After `npm run build -w @r-a-i-t-h/tessera-editor`, the API also serves that build on port 7356. Editors live in `$TESSERA_DATA/users/`. The release only carries a seed (`apps/editor-api/seed/users/`, login `admin` / `admin`); the first boot copies it when `users/` is empty, and a later boot does not replace it. `npm run seed:user -w @r-a-i-t-h/tessera-editor-api -- <name> <password>` rewrites that seed, not the site you have open. Switching `TESSERA_DATA` switches users with the site.

The public site is `publish/` inside that same directory. Nginx can serve it with the editor stopped, or you can copy that folder somewhere else. The editor process does not serve it. `npm run build -w @r-a-i-t-h/tessera-site` builds one `tessera.js` and stamps it, plus skin CSS, into each reference site’s `publish/` tree. Adding a component is a Tessera release: it is then available to every site.

The editor’s Backups page writes a dated `tar.gz` of `data/` into the sibling `backup/` folder (`TESSERA_BACKUP` overrides it). A file of the form `2026-09-28T191500Z.tar.gz` dropped there over SFTP can be downloaded or restored. Restore writes a safety archive first. The first boot also places `pure.tar.gz`, `ineffable.tar.gz`, `millersark.tar.gz`, and `willow.tar.gz` in that folder when they are missing, and leaves them alone after that. Restoring one fills `data/` and keeps the site’s editors.

## Release

Pushing a `v*` tag runs `.github/workflows/release.yml`, which packs `dist-release/tessera.tar.gz` (and a versioned copy) and attaches both to a GitHub Release. [node-vps-kit](https://github.com/r-a-i-t-h/node-vps-kit) installs that tarball as one process: `node dist/server.js` serves the API and the editor UI in `spa/`. The kit keeps instance data at `/opt/tessera/<name>/data` and sets `TESSERA_DATA` to that path. Updates replace `current/` and leave `data/` alone. Locally: `npm run pack`.

Authoring schema migrations (the hook node-vps-kit runs as `deploy/post-update.sh`) stamp `schemaVersion` on `$TESSERA_DATA/meta.json`. The app does not bump that counter. Records are inside that directory, so a later migration can rewrite them.

```bash
TESSERA_DATA=sites/willow sh deploy/migrate.sh
```

Legacy RecTem sources can be re-converted with `npm run convert:legacy` (needs a local `.ref-legacy/` checkout).

## Migration scripts

[`ps/`](./ps/) holds PowerShell helpers from the PurpleCMS → site-data era. They still target the old RecTem shapes and will be rewritten for Tessera’s `SiteDocument` later.
