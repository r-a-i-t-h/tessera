# Tessera

Client-side site runtime that renders an entire small website from one validated JSON document plus a shared component catalogue — **layouts declare zones**, **content fills them**, **components ship with Tessera and every site may name them**.

| Doc | Role |
|-----|------|
| [SPEC.md](./SPEC.md) | Product + architecture: goals, design decisions, acceptance criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-built engine contract (packages, pipeline, Zod) |
| [ROADMAP.md](./ROADMAP.md) | Where the product is, and the work still ahead |
| [GUIDE.md](./GUIDE.md) | Authoring how-to: YAML, menus, and styles. The editor’s Guide page shows the same notes |

## Quick start

```bash
npm install
npm run dev                 # site (5173), API (7356), and editor (7355)
npm run dev:site            # data/ shell only; empty until a backup is restored
npm run dev:api             # editor API only (seed login admin / admin)
npm run dev:editor          # editor SPA only (proxies /auth /api /health /preview)
```

The seed login is for first setup only. Change its password before exposing the editor outside a trusted development network.

## Test

```bash
npm test
```

GitHub CI runs the existing install, typecheck, test, and build commands on Node 20, 22, and 24. Those root scripts remain the source of truth and work on any CI service or local machine; the tag release workflow and local `npm run pack` stay independent.

## Packages

| Package | Path |
|---------|------|
| `@r-a-i-t-h/tessera-model` | `packages/model` |
| `@r-a-i-t-h/tessera-renderer` | `packages/renderer` |
| `@r-a-i-t-h/tessera-skin-w3` | `packages/skin-w3` |
| `@r-a-i-t-h/tessera-wc-base` | `packages/wc-base` |
| `@r-a-i-t-h/tessera-demo-kit` | `packages/demo-kit` (fonts, nav chrome, w3 helpers) |
| `@r-a-i-t-h/tessera-extras` | `packages/extras` (shared component catalogue) |
| `@r-a-i-t-h/tessera-sections` | `packages/sections` (Compose palette; zone HTML in, zone HTML out) |
| `@r-a-i-t-h/tessera-site` | `apps/site` (one runtime; dev serves `data/shell`, or `sites/<name>/shell` when `TESSERA_SITE` is set) |
| `@r-a-i-t-h/tessera-editor` | `apps/editor` |
| `@r-a-i-t-h/tessera-editor-api` | `apps/editor-api` |

## Sites

A site is a directory, not a package. Tessera’s version is the editor and the libraries. `TESSERA_DATA` points at one directory (default `data/`, empty until you restore an archive or start a blank site from the editor). `backup/` sits next to it and is not part of a release. Replacing `TESSERA_DATA` and restarting changes the site.

| Directory | Notes |
|-----------|--------|
| `sites/willow` | Community showcase (templates, types, bindings, gallery). Copied to `backup/willow.tar.gz` on boot when the release archive differs; not the running site |

Willow’s committed `publish/data`, `publish/img`, and `publish/media` files are reference fixtures for the showcase and its tests. Runtime JavaScript, CSS, and generated HTML under `publish/` are build artifacts and remain ignored.

Each directory has `records/` (YAML records), `shell/` (static chrome: `index.html` and `site.css`), and `publish/` (static export: hashed `site.json`, media, and the stamped runtime). `meta.json` holds `schemaVersion`. Users and page history live in the same directory and are created when the editor runs. A site has no build step and does not contain component source.

Editor: run `npm run dev:api` and `npm run dev:editor`, then open the SPA (port 7355). An empty directory can be started from the editor (shell, left sidebar, standard type and layout, Hello world home page, common-footer item, and a blog for tenant blogger with one article dated 9 October 2026). A content page opens on Compose (drag sections onto the page). A new page can start from a template; a locked template keeps the arrangement fixed. Library holds images and PDFs. Styles tunes the chrome. Fields still edits zone HTML, and Raw file still edits the page YAML. Unsaved edits carry across those tabs; Revert restores the last saved file. Saving appends the previous file to `history/content/<id>.history` and refreshes the SPA preview in `preview/data/`. **Render site** rebuilds that preview for every page. **Publish** writes the copyable `publish/` dist. When the site record sets `publishTo` to an existing directory, it also replaces the files in that directory. The editor serves that working snapshot at `/preview/` on the editor origin. The shell HTML is unchanged, so `./tessera.js`, `./data/`, `./skin/`, and `./media/` resolve inside that folder. The runtime is the built `tessera.js`, not the Vite dev server. `npm run dev:site` on port 5173 still serves the same snapshot with live TypeScript for engine work. `delivery` on the Site record chooses the dist: `pages` (one HTML file per page; the default) or `snapshot` (the single-index SPA). A pages dist needs `origin`. `sites/` is reference material and is not that output. The API edits `data/` unless you set `TESSERA_DATA`. After `npm run build -w @r-a-i-t-h/tessera-editor`, the API also serves that build on port 7356. Editors live in `$TESSERA_DATA/users/`. The release only carries a seed (`apps/editor-api/seed/users/`, login `admin` / `admin`); the first boot copies it when `users/` is empty, and a later boot does not replace it. `npm run seed:user -w @r-a-i-t-h/tessera-editor-api -- <name> <password>` rewrites that seed, not the site you have open. Switching `TESSERA_DATA` switches users with the site.

Library uploads default to at most 25 MiB per file, 100 files, and 100 MiB for the complete multipart request. Set byte counts with `TESSERA_UPLOAD_MAX_FILE_BYTES` and `TESSERA_UPLOAD_MAX_TOTAL_BYTES`, and set the file count with `TESSERA_UPLOAD_MAX_FILES`. Multipart parsing still holds an allowed request in memory, so keep the total limit bounded. Configure the reverse proxy too—for nginx, set `client_max_body_size` to the same total limit or slightly higher to allow multipart overhead.

The copyable site is `publish/` inside that same directory. Copy that folder to the live host, or set `publishTo` in `site.yaml` to an existing directory the app user can write. Publish then replaces the files inside that directory and leaves the directory itself in place. It does not create a missing path and does not run as root. On Ubuntu, `/var/www` stays root-owned; `chown` the live folder to the app user once. That folder should contain only the published site. Nginx can serve the copy with the editor stopped. The editor process does not serve it, and the SPA preview does not write into it. `npm run build -w @r-a-i-t-h/tessera-site` builds `tessera.js` and `tessera-pages.js` and stamps `tessera.js`, plus skin CSS, into each reference site’s `publish/` tree. Adding a component is a Tessera release: it is then available to every site. A checkout builds that runtime before a pages or snapshot dist can be written. The packed release already includes it.

The editor’s Backups page writes a dated `tar.gz` of `data/` into the sibling `backup/` folder (`TESSERA_BACKUP` overrides it). A file of the form `2026-09-28T191500Z.tar.gz` dropped there over SFTP can be downloaded or restored. Restore writes a safety archive first. Each boot copies `seed/examples/willow.tar.gz` into that folder when the file is missing or the release copy has changed. A checkout with no packed seed archives `sites/willow/` the first time only. Dated backups are left as they are. Restoring that archive fills `data/` and keeps the site’s editors. The Backups page can also re-seed the open site onto that same starter (safety archive first, editors kept). A starter site can also be written when the directory has no records yet.

## Release

`npm run release -- --patch` (or `--minor` / `--major`) bumps the root `package.json` version, commits it, tags `vX.Y.Z`, and pushes. That tag runs `.github/workflows/release.yml`, which packs `dist-release/tessera.tar.gz` (and a versioned copy) and attaches both to a GitHub Release. [node-vps-kit](https://github.com/r-a-i-t-h/node-vps-kit) installs that tarball as one process: `node dist/server.js` serves the API and the editor UI in `spa/`. The same tree carries `runtime/` and `skin/`, which preview and publish copy into the site. The kit keeps instance data at `/opt/tessera/<name>/data` and sets `TESSERA_DATA` to that path. Updates replace `current/` and leave `data/` alone. Locally: `npm run pack`.

Before making a production editor reachable:

- terminate HTTPS at the reverse proxy and set `TESSERA_SECURE_COOKIES=1` if Node is not running with `NODE_ENV=production`;
- sign in with the seed account and change the known `admin` password immediately;
- restrict editor access to trusted authors; authored HTML is trusted and every signed-in user currently has full editor access;
- keep `$TESSERA_DATA` and the sibling backup directory writable only by the app user, and test restore separately from the live directory;
- keep the API and reverse-proxy upload limits aligned; the API rejects over-limit requests but buffers allowed multipart bodies;
- use the HTML and immutable-asset cache rules in `ARCHITECTURE.md` for the published site.

Authoring schema migrations (the hook node-vps-kit runs as `deploy/post-update.sh`) stamp `schemaVersion` on `$TESSERA_DATA/meta.json`. The app does not bump that counter. Migrations `001` and `002` stamp versions 1 and 2 without rewriting records. Records are inside that directory, so a later migration can rewrite them and must carry before/after fixture coverage.

```bash
TESSERA_DATA=sites/willow sh deploy/migrate.sh
```
