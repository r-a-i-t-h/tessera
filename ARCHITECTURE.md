# Tessera architecture (v0.1)

As-built engine contract. Product ambition, Phase-1 design decisions, and acceptance criteria live in [SPEC.md](./SPEC.md). Upcoming work is sequenced in [ROADMAP.md](./ROADMAP.md).

Tessera is a small CMS runtime for sites whose full text/data payload is cheaper than a typical image. Content is authored as structured records. A **snapshot** site is flattened to one JSON document and rendered in the browser. A **pages** site publishes one HTML file per page. Micro-apps (event lists, galleries, and other interactive mounts) stay client-side in both flavours.

The name evokes mosaic tiles: layouts place the tiles (zones); content fills them — or leaves them empty.

The **editor** (see SPEC §9) edits one site directory and emits the flattened file. The **renderer** only consumes that file plus a site-owned component registry. The editor may host the renderer for preview; the renderer never depends on the editor.

Tessera’s version is the engine: `apps/editor-api`, `apps/editor`, and the packages below. A site is data. Replacing `$TESSERA_DATA` (and restarting) changes which site the instance edits. The public site is the static `publish/` tree inside that directory. Nginx can keep serving `publish/` with the editor process stopped, or that tree can be copied to another host.

The editor **API** lives in `apps/editor-api` (`@r-a-i-t-h/tessera-editor-api`): a Hono + Node process with file-backed users, in-memory sessions, and an all-or-nothing `requireEditor` gate on every mutation. The editor **SPA** lives in `apps/editor` (`@r-a-i-t-h/tessera-editor`) and talks to that API on the **same origin** (Vite proxy in dev). Hono serves the built UI when it is present: `spa/` next to a release bundle, or `apps/editor/dist` in a checkout. `apps/site` (`@r-a-i-t-h/tessera-site`) is the dev/build host for a site shell. It is not a site, and it does not version the site. A `v*` tag packs one tarball (`npm run pack`): `dist/server.js`, `spa/`, `seed/`, and `deploy/`. Instance data stays outside that tree.

## Packages

| Package | Role |
|---------|------|
| `@r-a-i-t-h/tessera-model` | `SiteDocument` types + Zod validation |
| `@r-a-i-t-h/tessera-renderer` | Zone merge, layout walk, component registry, hash SPA |
| `@r-a-i-t-h/tessera-skin-w3` | W3.CSS **5.01** + region→class skin |
| `@r-a-i-t-h/tessera-wc-base` | Cookie-cut custom element base (`a` / `b` / `c`) |
| `@r-a-i-t-h/tessera-demo-kit` | Shared chrome helpers shells may import at build time |
| `@r-a-i-t-h/tessera-site` | One Vite host: `TESSERA_SITE` selects `sites/<name>/shell` |

Example sites live under `sites/` (pure / ineffable / millersark / willow). They are not npm workspaces. The editing back-end is `apps/editor-api`; the login SPA is `apps/editor`.

`ps/` keeps PurpleCMS migration scripts (to be rewritten for Tessera’s document shape).

## Editor API

Hono app (Node ≥20). JSON routes first; if `spa/index.html` (a release), `apps/editor/dist/index.html` (a checkout), or `TESSERA_SPA_DIR` is present, the same process serves the editor SPA so cookies stay first-party. Runtime data is file-backed with an in-memory cache; writes use atomic temp+rename.

| Concern | Contract |
|---------|----------|
| Users | `$TESSERA_DATA/users/<username>.json` (hash + salt), one set per site directory. No `/auth/register`. The release seed (`seed/users`, `admin` / `admin`) is copied only when `users/` is empty. `npm run seed:user` rewrites that seed, not the open site. |
| Sessions | In-memory tokens; httpOnly `tessera_session` cookie (`Path=/`) or `Authorization: Bearer`. The editor is served at the hostname root. SIGTERM dumps hashed tokens to `$TESSERA_DATA/.sessions.json` once. |
| Permission | `requireEditor`: authenticated ⇒ full access; anonymous ⇒ 401. Every mutation must call it. |
| Records | YAML files in `$TESSERA_DATA/data`. Filename = Tessera `id`. `GET/PUT /api/records` accepts structured `data` or raw YAML. A changed content page appends the previous file to `$TESSERA_DATA/history/content/<id>.history`, then flattens to `$TESSERA_DATA/publish/data/site.json` plus `site.<hash>.json` and `rev.json`. |
| Public | `GET /health`, `POST /auth/login`. Protected: `GET /auth/me`, `POST /auth/password`, `POST /api/ping`, record CRUD. Logout is idempotent. |

Public HTML is the editor SPA when built. The published site remains `site.json` for the renderer. Authoring is file-based YAML (not JSON) so HTML does not need escaping.

Same origin is deliberate: the session cookie is `httpOnly` + `SameSite=Lax` with `Path=/`. A SPA on another port/origin would need CORS credentials and cookie relaxation. Dev uses a Vite proxy on port 7355 so the browser still sees one origin. The editor is not mounted under a URL prefix.

The published site is `publish/` inside the same directory (or a copy of that tree). The editor process does not serve it. Stopping the editor leaves the static files working. There is one path, `TESSERA_DATA` (default `sites/willow` in a checkout). On a VPS, node-vps-kit sets it to `/opt/tessera/<name>/data`, which is the site directory and is not replaced when the release in `current/` changes. Records, history, users, `meta.json`, and the export are derived from it.

## Content model

- **Layout** — tree of `region` | `zone` | `static` | `component`. **Only layouts declare zones** (and where they appear).
- **Page** — `id`, `title`, optional `description`, optional `slug`, optional `parentId` (published tree; ignored on the home page), optional `showInNav` (`false` keeps the URL and drops the nav link), optional `layoutId` (override), optional `includes` (shared items), and `zones` contributions. Drafts are pages left out of the published document. History is not a field on the page.
- **Sections** — hierarchical presentation profiles (`match` by tags / `pageIdPrefix` → `layoutId` / `skinId`). Resolved by `resolvePageProfile`: site default → matching sections → page override.
- **Item** — reusable zone contributions (footer, promo, …), pulled in via `page.includes`.
- **Blocks** inside a zone: `text` | `json` | `media` | `component`.
- **Nav / media / site meta** — also in the flattened document.

**Rule:** if a layout does not declare zone `aside`, contributions to `aside` are not painted. They remain on the merge map so components can still read “data zones” (e.g. JSON for a list) via `ctx.zoneJson("events")`.

## Site directory

`$TESSERA_DATA` is the instance. Swapping the directory swaps the site, including who may edit it.

```
sites/willow/
  meta.json                 # schemaVersion
  users/                    # editors; created on first boot from the release seed
  history/                  # append-only page history, not published
  data/                     # YAML records, not on the web path
    site.yaml  nav.yaml
    content/ items/ layouts/ bindings/ sections/ media/ folders/
  shell/                    # site-owned presentation source
    index.html  site.css  main.ts  components/
  publish/                  # static export; nginx document root
    index.html              # built shell
    assets/
    data/site.json  site.<hash>.json  rev.json
    media/  img/
```

`shell/` is chrome and micro-apps. It may import engine packages at build time. The built files in `publish/` do not. Adding a micro-app rebuilds that shell. It is not a Tessera release. The editor API does not load site code.

`npm run dev:site` serves `sites/$TESSERA_SITE/shell` (default `willow`) and the files in `publish/`. `npm run build -w @r-a-i-t-h/tessera-site` writes each shell into that site’s `publish/`.

## Authoring files

Records live in `$TESSERA_DATA/data/`, off the web path. Each record is one YAML file named with the same **`id`** the flattened document already uses (`page.id`, `item.id`, `layout.id`, `binding.id`, `section.id`, `media.id`, `folder.id`).

| Folder / file | Holds |
|---------------|--------|
| `content/*.yaml` | Pages |
| `items/*.yaml` | Shared items (e.g. footer) |
| `layouts/*.yaml` | Layout trees (templates) |
| `bindings/*.yaml` | Data → component bindings |
| `sections/*.yaml` | Section profiles |
| `media/*.yaml` | Media catalog entries |
| `folders/*.yaml` | Gallery folder records |
| `*/_order.yaml` | Record order (section order is significant) |
| `site.yaml` | Site meta |
| `nav.yaml` | Designed nav tree |

HTML zones use YAML `|` / `|-` scalars (`html:`) so markup is not JSON-escaped. Component implementations stay TypeScript in `shell/components`; only bindings are records.

The editor form for a page lists zones declared by the resolved layout (page `layoutId` → matching section → site default). Extra keys on the page that the layout does not declare stay editable under **Off layout**. A flat JSON object becomes one text field per key already on the file. The editor does not have content types. A person page is a normal page: a tag selects a section, the section selects a layout, and shell components read a JSON zone (Willow’s `meta` holds `role`, `email`, `photo`, `summary`). Those keys live in the shell, not in the engine. `schemaVersion` is how records are stored, not the list of person fields.

`npm run flatten:site` (or an editor save) writes `$TESSERA_DATA/publish/data/site.json` and stamps `<meta name="tessera-site">` in `shell/index.html` and, when it exists, `publish/index.html`.

There is **no** recursive `parentId` template chain and **no** inventing zones from inside page HTML. Section profiles replace Rec-Tem-style “templates as content” for hierarchy-wide layout/theme switching.

## Page history and authoring schema

Saving a content page writes the new YAML, then appends the **previous raw file** to `$TESSERA_DATA/history/content/<id>.history` (one append-only file per page, outside the web root). An unchanged file does not append. A publish failure restores the previous file and does not append. History is not a field on the published page and is not copied into `site.json`.

The editor can open that raw YAML, save it, and read earlier copies back. The save response names the new `site.<hash>.json`. That filename is the browser cache key: `rev.json` changes with it, and an open snapshot tab picks the new file up on its next poll.

**Authoring schema** is `schemaVersion` in `$TESSERA_DATA/meta.json`. It is not `SiteDocument.version` (the number the renderer validates). The process reads `schemaVersion` and stamps it on each history entry. It does not bump the counter. Missing or non-numeric means **0**.

[node-vps-kit](https://github.com/r-a-i-t-h/node-vps-kit) runs `deploy/post-update.sh` as the app user after it swaps `current` and before systemd restarts. The hook receives `TESSERA_DATA`, `TESSERA_SEED`, and `TESSERA_BACKUP`. It applies `deploy/migrations/NNN-*.sh` when `NNN` is greater than `schemaVersion`. `001` stamps `schemaVersion: 1` and leaves every other meta key alone. First boot copies `seed/meta.json` into `data/` only when `meta.json` is absent, so a later boot does not wipe the stamp.

```bash
TESSERA_DATA=sites/willow sh deploy/migrate.sh
```

Records live at `$TESSERA_DATA/data`, so a later migration can rewrite page files. `001` only stamps `schemaVersion` on `meta.json`. Three numbers stay distinct: the Tessera release (editor and libraries), `schemaVersion` (authoring files), and `SiteDocument.version` (the flattened document the renderer validates). An editor-only release does not require a new export. A renderer or document-schema change needs a migration, then a flatten. Already-exported `publish/` trees keep the shell they were built with until that export.

## Relative assets

A published site is a folder of files. It stays portable to any directory, including a path on a shared domain, without a server mount setting:

- Vite `base: "./"` (not `/`) on the site build. The editor SPA uses `base: "/"` because it is served at the hostname root.
- The snapshot shell points at `./data/site.<hash>.json` via `<meta name="tessera-site">` (not `/data/...`, and not a timestamp query)
- Media URLs in the document should be relative (`./media/...`), not root-absolute (`/media/...`) or required CDN URLs
- `normalizeSiteAssetUrl` rewrites accidental `/foo` media paths to `./foo` at render time
- Hash routing (`#page`) keeps the browser path on that folder

`localStorage` is shared by every page on an origin. The cache key for the hashed site file is that file’s absolute URL (`documentCacheKey`), so two published sites on one host do not share a cache. The URL is only a cache identity. It is not a server base path.

Flatten (`writeSnapshotFiles`) writes three files next to each other: the stable `site.json` (tools and the editor), `site.<hash>.json` (the bytes the browser fetches), and `rev.json` (`{ hash, file }`). The open-tab poll reads `rev.json` and downloads a new hashed file only when the hash changes. `npm run stamp:snapshot` refreshes those files for every example site from the `site.json` already on disk. When the flatten target is `publish/data/site.json`, the shell and built `publish/index.html` meta tags are updated to the new name.

## Gallery (spike)

First-class **`folders[]`** records are gallery sources (scan with `scripts/flatten-gallery.mjs`). A gallery binding/component says `folders: ["id"]` (optional merge of several; optional `filter` regex on filename). Inline variant uses nested `image` blocks in a `slides` zone — same slide shape `{ url, caption?, alt? }`. Captions default from filename after stripping an ordering prefix (`01-red.svg` → “Red”); `meta.json` may override per file.

The global `media[]` catalog remains for single-image references; it is not the gallery bank.

## Zod

[`zod`](https://zod.dev) is used only in `@r-a-i-t-h/tessera-model` to **validate** the flattened `site.json` when it is loaded. TypeScript types are inferred from the same schemas, so the editor (later) and renderer share one contract. A malformed document fails at parse time with a structured error instead of half-rendering.

## How dynamic lists / custom behaviour are defined

**Component implementations** are TypeScript the site imports and registers. **Bindings** (which data + which component, under a public id) live in `site.json`:

```json
"bindings": [
  {
    "id": "farm-open-days",
    "component": "eventList",
    "itemId": "open-days-data",
    "fromZone": "events"
  }
]
```

Content inserts the populated view with mustache or a component block:

```html
{{farm-open-days}}
```

```json
{ "type": "component", "name": "farm-open-days" }
```

**What requires a rebuild:** adding a *new* component implementation.  
**What does not:** changing text, JSON, layout trees, bindings, or which binding ids a page references.

Nav presentations (`navTags`, `navTree`, `navCollapse`, …) are registered components; designed `document.nav` plus optional `source` supply data. Page existence does not imply a nav entry.

Web components follow the same idea: implement with `WCBase`, `customElements.define`, then either emit the tag from a small registry function or `registry.defineElement(name, tagName)`.

## Rendering pipeline

1. Load + validate the hashed site file named by `<meta name="tessera-site">`; persist to `localStorage` under the absolute URL of that file (one cache per published site on a shared origin); fall back to cache on failure (see SPEC §3). While open, poll `rev.json` on a 5-minute TTL.
2. Resolve page from hash (unknown ids fall back to home — no error UI). Snapshot sites only.
3. Resolve the page’s **profile** (`resolvePageProfile`: section inheritance + page override), then merge `page.zones` then each included item’s zones (stable order).
4. Walk the chosen layout tree; zone nodes render their blocks; unknown component names become HTML comments.
5. Optional `onAfterRender` / `onStatusChange` for chrome outside the document (demo sidebar, stale banner).
6. While open, re-fetch on a 5-minute TTL when `documentUrl` is set.

## CSS

Default skin is **W3.CSS 5.01** (`packages/skin-w3/css/w3.css`). Layout regions use semantic `role`s; the skin maps them to classes. Swap skins without changing `SiteDocument`.

## Pages publisher

`publishPages(document, { origin })` in `@r-a-i-t-h/tessera-renderer` walks `publishedPageTree` and returns one HTML file per page plus `sitemap.xml`. It does not write to disk and it does not run micro-apps.

- Home is `index.html`. Any other page is `{path}/index.html`. The path is the chain of `slug` or `id` segments. The home page’s own segment is not part of that chain.
- `<title>`, optional meta description, and `<link rel="canonical">` come from the page and `origin`.
- Nav is that tree, with `showInNav: false` pages omitted and their visible children kept. Links are relative to the file so a site can live in a folder.
- Text and media are rendered into `<main>`. A binding or component becomes `<div data-tessera-microapp="…">` and an entry in `<script type="application/json" id="tessera-microapps">`.

## Static host

A published site is a folder. Nginx answers the browser. Node does not set cache headers and does not serve the folder.

`ETag` is nginx’s default for static files. `Cache-Control` is not. `/` does not match a `*.html` location, so the “ask every time” header goes on the location that serves pages.

```nginx
server {
    server_name willow.example.com;
    root /var/www/willow/publish;
    index index.html;

    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location ~* /data/site\.[a-f0-9]+\.json$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        add_header Cache-Control "public, max-age=0, must-revalidate";
        try_files $uri $uri/ =404;
    }
}
```

A site in a folder on a shared host uses the same two rules under a prefix:

```nginx
location = /willow {
    return 301 /willow/;
}

location ^~ /willow/assets/ {
    alias /var/www/willow/publish/assets/;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location ~* ^/willow/data/(site\.[a-f0-9]+\.json)$ {
    alias /var/www/willow/publish/data/$1;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location /willow/ {
    alias /var/www/willow/publish/;
    index index.html;
    add_header Cache-Control "public, max-age=0, must-revalidate";
}
```

`site.<hash>.json` can be cached like `/assets/` because the name changes when the bytes change. `rev.json` and HTML stay on the “ask every time” path. Pictures with a stable filename are checked every time unless they later move under a hashed name.

## Examples

```bash
npm install
npm run dev:site                         # willow (port 5173)
TESSERA_SITE=pure npm run dev:site       # engine lab: zones, font switch
TESSERA_DATA=sites/pure npm run dev:api  # edit that directory
```

Pure’s event pages omit `layoutId` and inherit layout/skin from `sections` (Open farm day / Evening talk). Willow, Ineffable, and Miller’s Ark are the same kind of directory: records in `data/`, chrome and micro-apps in `shell/`, static files in `publish/`.
