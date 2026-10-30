# Tessera architecture

As-built engine contract. Product ambition, design decisions, and acceptance criteria live in [SPEC.md](./SPEC.md). Upcoming work is sequenced in [ROADMAP.md](./ROADMAP.md).

Tessera is a small CMS runtime for sites whose full text/data payload is cheaper than a typical image. Content is authored as structured records. A **snapshot** site is flattened to one JSON document and rendered in the browser. A **pages** site publishes one HTML file per page. Micro-apps (event lists, galleries, and other interactive mounts) stay client-side in both flavours.

The name evokes mosaic tiles: layouts place the tiles (zones); content fills them — or leaves them empty.

The **editor** (see SPEC §9) edits one site directory and emits the flattened file. The **renderer** consumes that file. The site runtime registers the shared component catalogue. The renderer never depends on the editor. Preview is the snapshot in `preview/`; the editor API serves its real runtime at `/preview/`. The editing screen does not embed that runtime yet.

Tessera’s version is the engine: `apps/editor-api`, `apps/editor`, and the packages below. A site is data. Replacing `$TESSERA_DATA` (and restarting) changes which site the instance edits. The public site is the static `publish/` tree inside that directory. Nginx can keep serving `publish/` with the editor process stopped, or that tree can be copied to another host.

The editor **API** lives in `apps/editor-api` (`@r-a-i-t-h/tessera-editor-api`): a Hono + Node process with file-backed users, in-memory sessions, and an all-or-nothing `requireEditor` gate on every mutation. The editor **SPA** lives in `apps/editor` (`@r-a-i-t-h/tessera-editor`) and talks to that API on the **same origin** (Vite proxy in dev). Hono serves the built UI when it is present: `spa/` next to a release bundle, or `apps/editor/dist` in a checkout. `apps/site` (`@r-a-i-t-h/tessera-site`) is the dev/build host for the shared site runtime. It is not a site, and it does not version the site. A `v*` tag packs one tarball (`npm run pack`): `dist/server.js`, `spa/`, `runtime/` (`tessera.js` and `tessera-pages.js`), `skin/`, `seed/`, and `deploy/`. Instance data stays outside that tree.

## Packages

| Package | Role |
|---------|------|
| `@r-a-i-t-h/tessera-model` | `SiteDocument` types + Zod validation |
| `@r-a-i-t-h/tessera-renderer` | Zone merge, layout walk, component registry, hash SPA |
| `@r-a-i-t-h/tessera-skin-w3` | W3.CSS **5.01** + region→class skin |
| `@r-a-i-t-h/tessera-wc-base` | Cookie-cut custom element base (`a` / `b` / `c`) |
| `@r-a-i-t-h/tessera-demo-kit` | Chrome helpers the runtime uses (fonts, nav sidebar, w3 helpers) |
| `@r-a-i-t-h/tessera-extras` | Shared component catalogue. Every site may name these. A new component is a Tessera release |
| `@r-a-i-t-h/tessera-sections` | Compose palette. Parses section HTML in the editor; authoring stores widget `blocks` on disk (schema 4) |
| `@r-a-i-t-h/tessera-site` | One Vite host for the shared runtime. Dev serves `data/shell` and `data/preview` (a placeholder while `data/shell` is missing). |

The editing back-end is `apps/editor-api`; the login SPA is `apps/editor`.

## Editor API

Hono app (Node ≥22). JSON routes first; if `spa/index.html` (a release), `apps/editor/dist/index.html` (a checkout), or `TESSERA_SPA_DIR` is present, the same process serves the editor SPA so cookies stay first-party. Runtime data is file-backed with an in-memory cache; writes use atomic temp+rename.

| Concern | Contract |
|---------|----------|
| Users | `$TESSERA_DATA/users/<username>.json` (hash + salt, optional `disabled`). No `/auth/register`. A name is trimmed, starts with a letter, includes at least one visible character, and then uses letters, numbers, `.`, `_`, or `-` (up to 64). It cannot match another editor, ignoring case. `POST /auth/username` renames the signed-in editor. `/api/users` lists, adds, edits, deletes, and disables editors. A disabled user cannot sign in, and an existing session stops working. You cannot delete or disable yourself. The release seed (`seed/users`, `admin` / `admin`) is copied only when `users/` is empty. `npm run seed:user` rewrites that seed, not the open site. |
| Sessions | In-memory tokens; httpOnly `tessera_session` cookie (`Path=/`) or `Authorization: Bearer`. The editor is served at the hostname root. SIGTERM dumps hashed tokens to `$TESSERA_DATA/.sessions.json` once. |
| Permission | `requireEditor`: authenticated ⇒ full access; anonymous ⇒ 401. Every mutation must call it. |
| Records | YAML files in `$TESSERA_DATA/records`. Filename = Tessera `id`. `GET/PUT /api/records` accepts structured `data` or raw YAML. A changed content page appends the previous file to `$TESSERA_DATA/history/content/<id>.history`, then writes the SPA snapshot to `$TESSERA_DATA/preview/data/`. **Publish** writes the copyable `$TESSERA_DATA/publish/` dist. Templates live in `records/templates/` and are omitted from that document. |
| Library | `GET/POST/PATCH/DELETE` under `/api/library`, plus `POST /api/library/rescan` and `POST /api/library/assets/:id/replace` (overwrite blob, same id and extension). Blobs stay in `files/<id>.<ext>`. A folder move does not rename the blob. |
| Site actions | `POST /api/site/init` writes a starter site when `site.yaml` is absent. `POST /api/site/reseed` replaces the open site with that same starter after a safety backup, and keeps editors. `POST /api/render` refreshes `preview/`. `POST /api/publish` writes `publish/`. When `publishTo` is set, it then replaces the files in that directory. |
| Public | `GET /health`, `POST /auth/login`. Protected: `GET /auth/me`, `POST /auth/password`, `POST /auth/username`, `POST /api/ping`, `/api/users`, record CRUD, library, render, publish, backups. Logout is idempotent. |

Public HTML is the editor SPA when built. **Publish** writes a static dist under `publish/`: by default **pages** (one HTML file per page plus stamped runtimes) or **snapshot** (`publish/data/site.json` and the hashed file for the SPA). Preview and flatten always emit the snapshot shape into `preview/data/` for editing. Authoring is file-based YAML (not JSON) so HTML does not need escaping.

Same origin is deliberate: the session cookie is `httpOnly` + `SameSite=Lax` with `Path=/`. A SPA on another port/origin would need CORS credentials and cookie relaxation. Dev uses a Vite proxy on port 7355 so the browser still sees one origin. The editor is not mounted under a URL prefix.

The published site is `publish/` inside the same directory (or a copy of that tree). The editor process does not serve it. Stopping the editor leaves the static files working. There is one path, `TESSERA_DATA` (default `data/` in a checkout, empty apart from `meta.json` and the seed editor). On a VPS, node-vps-kit sets it to `/opt/tessera/<name>/data`, which is the site directory and is not replaced when the release in `current/` changes. Records, history, users, `meta.json`, and the export are derived from it.

Dated site archives live in the sibling `backup/` directory (`TESSERA_BACKUP` overrides it). They are not inside the release and not inside `publish/`. A restore replaces the site directory from a `YYYY-MM-DDTHHMMSSZ.tar.gz` after writing a safety archive. **Re-seed** replaces the open site with the bundled starter theme after a safety backup and keeps editors: a master layout (header, left sidebar with `navFlat`, footer zone that includes a `common-footer` item), a standard type and layout, a Hello world home page, a Search page, a first sidebar link, and a blog with one article dated 2026-10-09. The sidebar uses `w3-collapse` from 993px up and becomes a Menu button plus a flyout below that breakpoint.

## Content model

- **Layout** — tree of `region` | `zone` | `static` | `component` | `page`. **Only layouts declare zones** (and where they appear). `site.masterLayoutId` is the default outer page. `resolveMasterLayout` may name a different frame for a page subtree. Its `page` node is replaced by the resolved page layout.
- **Page** — `id`, `title`, optional `description`, optional `parentId` (published tree; ignored on the home page), optional `masterLayoutId` (frame for this page and its descendants), optional `type`, optional `fields`, optional subject `tags`, optional `includes` (shared items), and `zones` contributions. There is no draft flag: every content page is in the flattened document. `locked` and `templateId` may sit on the YAML file and are omitted when the page is assembled. History is not a field on the page. Sidebar and menu links come from the designed **nav** record, not from page fields.
- **Style** — optional `site.style` tokens (sidebar width, bar, colours, fonts, nav side). Missing fields use the defaults in `style.ts`. The editor’s Styles page writes this object. A pages build writes tokens that differ from those defaults into a style element after the stylesheet links. That element overrides those variables in `skin/tessera.css`. Defaults stay in the stylesheet, so editing them there changes the preview. The same page can edit the linked stylesheets. Saving W3, Tessera, micro-apps, or a theme file stores a copy in `shell/css/` for this site. `site.css` and durable `local.css` stay in the shell.
- **Type** — site-defined `{ id, layoutId?, fields[] }`. `resolvePageProfile` uses that layout, otherwise `site.defaultLayoutId`. A type does not invent zones. Subject tags do not select it.
- **Item** — reusable zone contributions (footer, promo, …), pulled in via `page.includes` or a layout's `includes`.
- **Blocks** inside a zone: `text` | `media` | `image` | `component`. Structured tabular data uses **datasets** and dataset bindings, not zone JSON rows.
- **Nav / media / site meta** — also in the flattened document.

**Rule:** if a layout does not declare zone `aside`, contributions to `aside` are not painted. They remain on the merge map for diagnostics; gallery slides can still read another zone’s **image blocks** via component props (`fromZone`), which is separate from the removed zone-JSON content model.

## Site directory

`$TESSERA_DATA` is the instance. Swapping the directory swaps the site, including who may edit it.

```
$TESSERA_DATA/                 # default `data/` in a checkout
  meta.json                 # schemaVersion
  users/                    # editors; created on first boot from the release seed
  history/                  # append-only page history, not published
  records/                  # YAML records, not on the web path
    site.yaml  nav.yaml
    content/ templates/ items/ layouts/ bindings/ types/ media/ folders/
  datasets/                 # JSON dataset files; snapshots embed into SiteDocument at flatten when bindings reference them
    <id>.json
  runtime-modules/          # site-owner ESM blobs (referenced modules copied into publish/)
    <id>.js | <id>.mjs
  files/                    # flat asset blobs and editor thumbnails, not on the web path
  shell/                    # document shell, no TypeScript and no frame
    index.html  site.css  local.css
    css/                  # optional copies of skin stylesheets for this site
  preview/                  # SPA snapshot for editing; the editor serves it at /preview/
    data/site.json  site.<hash>.json  rev.json
  publish/                  # copyable dist; nginx document root after you copy it
    index.html              # pages: the home page. snapshot: the shell
    tessera.js              # snapshot runtime, stamped by the Tessera build
    tessera-pages.js        # pages runtime, hydrates mounts only
    skin/                   # skin CSS, stamped by the Tessera build
    site.css
    data/                   # snapshot dist only
    media/  img/
    runtime-modules/        # pages/snapshot: referenced module blobs
```

`shell/` is the document shell: head, one mount (`#app`), and CSS. It does not contain the header, the nav, or TypeScript. That frame is the master layout. `publish/tessera.js` and `publish/skin/` are install bytes stamped by the site build. A new **catalogue** component lands in `@r-a-i-t-h/tessera-extras` and every site may name it from bindings; **runtime modules** are site-owner ESM (see Runtime modules). The editor API does not execute site code. The runtime loads the document, registers the catalogue, and mounts the render. It does not paint a sidebar or a top bar of its own.

The editor process serves the working snapshot at `/preview/` on the editor origin. The shell HTML is returned unchanged, so `./tessera.js`, `./data/`, `./skin/`, and `./media/` resolve inside that folder the same way they would in any directory on a static host. `tessera.js` and `skin/` come from the site build, `/data/*` comes from `preview/data` and not from `publish/`, and `media/` comes from `files/`. A signed-in editor session is required. `npm run dev:site` still serves the instance on port 5173 with live TypeScript: `data/shell` and `data/preview` (a short placeholder while `data/shell` is missing). `/data/*` is the SPA snapshot in `preview/`. `media/` and `img/` still come from `data/publish` on that dev server. Saving and **Render site** refresh the preview only. **Publish** rebuilds `publish/` in the site's `delivery` flavour (`pages` by default, or `snapshot`) and leaves that folder alone until the next publish. `npm run build -w @r-a-i-t-h/tessera-site` builds `tessera.js` and `tessera-pages.js` for preview/publish stamping. That build is not the preview. Copy `publish/` to the live host when `publishTo` is unset. When `site.yaml` sets `publishTo` to an existing directory this process can write, Publish copies `publish/` into that directory and then replaces the files there. It does not create a missing directory, rename the directory, or run as root. On Ubuntu, `/var/www` stays `root:root` mode `755`; `chown` the live folder to the app user once so the process can write inside it. Nginx, as `www-data`, can read the files when directories are `755` and files are `644`. That folder should hold only the published site: a file placed there by hand is removed on the next successful install. One publish runs at a time. A failed copy leaves the current live files in place.

## Datasets

Structured collections (events, products, meeting rows, branches, and similar) live in `$TESSERA_DATA/datasets/<id>.json`. Each file holds a field tree (`schema`), view prefs (`view.columns`, `view.displayName`), a `nextUid` counter, and `records` as nested JSON documents. Root records store `uid`, `added`, `modified`, and schema field values. `view.displayName` is a template such as `{make} {model} {year}` used in pickers and labels. Grid columns come from `view.columns` (optional `uid`, schema scalar fields, and optional `added` / `modified`). List items carry `uid` and timestamps only.

The editor **Datasets** section designs the schema and edits records (grid, inline grid edit, and record dialog). Saving a schema runs `adaptRecords` in `@r-a-i-t-h/tessera-model` so renames, removals, and defaults rewrite stored rows. Bindings that reference a dataset embed its payload at flatten/preview/publish time.

## Runtime modules

Site-owner ESM lives in `$TESSERA_DATA/runtime-modules/<id>.js` or `.mjs`, with catalog rows in `records/runtime-modules/*.yaml` (`id`, `ext`, optional `title`). Public URLs are `./runtime-modules/<id>.<ext>`. The editor **Runtime modules** screen uploads files and edits raw source in a textarea; Tessera never runs that code on the server. Flatten adds `document.runtimeModules[]` (`id`, `url`, `title?`) for modules referenced by bindings. **Publish** copies referenced blobs into `publish/runtime-modules/`; **preview** serves the working copies from `data/runtime-modules/`. Bindings use the `runtimeModule` component with `props.module` (record id). See `docs/runtime-modules.md`.

## Authoring files

Records live in `$TESSERA_DATA/records/`, off the web path. Each record is one YAML file named with the same **`id`** the flattened document already uses (`page.id`, `item.id`, `layout.id`, `binding.id`, `type.id`, `media.id`, `folder.id`). A **title** is a public value: the page, the site, a nav entry, and a media file. Templates, items, layouts, types, and folders have no title. Their id is the name.

| Folder / file | Holds |
|---------------|--------|
| `content/*.yaml` | Pages. `locked` and `templateId` are editor fields and are not published |
| `templates/*.yaml` | Page prototypes. Publish skips this folder. `isLocked` locks the arrangement of pages copied from it |
| `items/*.yaml` | Shared items (e.g. footer) |
| `layouts/*.yaml` | Layout trees (zone frames). Not page templates |
| `bindings/*.yaml` | Data → component bindings |
| `types/*.yaml` | Site-defined types: layout and field list |
| `media/*.yaml` | Library files (image or PDF). Flatten derives `./media/<id>.<ext>`. |
| `runtime-modules/*.yaml` | Runtime module catalog (`ext` is `js` or `mjs`). Blob beside records under `runtime-modules/`. |
| `folders/*.yaml` | Virtual folders. A folder id is still a gallery source. |
| `*/_order.yaml` | Record order |
| `site.yaml` | Site meta |
| `nav.yaml` | Designed nav tree |

HTML zones on **items** (and layout **static** nodes) use YAML `html:` scalars; items may also use a **`component`** mount per zone. **Compose-backed page zones** persist an ordered **widget list** under `zones.<id>.blocks` (objects with `kind`, not renderer `type`). Assemble compiles widgets to a single `text` block for publish. The **`title`** zone may stay a plain `html:` string on the Page tab. Component implementations live in the shared catalogue; only bindings are records.

The editor form for a page lists the type's fields, then zones declared by the resolved layout (the type's layout, otherwise the site default). Extra keys on the page that the layout does not declare stay editable under **Off layout**. A type is site configuration: it names fields and a layout. It is not a built-in class. Willow's person type lists `role`, `email`, `photo`, and `precis` on the entry. `schemaVersion` is how records are stored.

Compose (`@r-a-i-t-h/tessera-sections`) parses a zone’s HTML into sections and paints it back in the editor. On disk (authoring schema 4), compose-backed page zones store **widget `blocks`** under `zones.<id>.blocks`; assemble compiles them to renderer `text` HTML in the flattened document. Fields and Raw file still edit the same page (Raw shows YAML; Fields round-trip through the section model). A block that does not parse back stays raw HTML. A locked page keeps the section arrangement fixed and still edits the words and pictures inside it. A template is the same body, stored under `records/templates/`, and is not a layout.

`npm run flatten:site` (or an editor save) writes `$TESSERA_DATA/preview/data/site.json` and stamps `<meta name="tessera-site">` in `shell/index.html`. **Publish** writes `$TESSERA_DATA/publish/` for copying. `publishTo` on `site.yaml`, when set, is an existing directory whose contents that same publish replaces. On a node-vps-kit host the process user is `tessera`. `deploy/grant-publish.sh` gives that user the directory. A pages dist is one HTML file per page plus `sitemap.xml` and `search-index.json`. A snapshot dist is the SPA shell, `publish/data/site.json`, the hashed file, `rev.json`, and `search-index.json`. Preview emit also writes `preview/search-index.json`. `delivery` on `site.yaml` chooses that dist and defaults to `pages`. A pages dist needs `origin` (an absolute http(s) URL of the published folder; a path is that folder, and a query or hash is rejected). The preview is always the snapshot and ignores `delivery`.

There is **no** recursive `parentId` template chain and **no** inventing zones from inside page HTML. A type chooses the layout for every entry of that type. The one value that follows `parentId` is the frame: a page's `masterLayoutId`, otherwise the nearest ancestor's, otherwise the site master. The home page does not inherit.

An **aspect** is optional. A theme that lists looks in its manifest writes `site.aspects` and may set `site.defaultAspectId`. A page's `aspectId`, otherwise the nearest ancestor's, otherwise that default, becomes the class `aspect-{id}` on the document element. Layouts and the frame ignore it. The theme's `shell/site.css` styles those classes. A theme that omits the list clears the catalog on apply.

**Panel tones** are site-owned (`site.panelTones`: id, label, className). Compose adds them to the Panel and Quote Tone dropdown. Painted HTML uses the className on that block only. They are not inherited and do not change page chrome. Theme apply does not write or clear them. A kit may ship `panelTones.yaml` and `shell/local.css` (plus `shell/local/` assets) as a one-time seed when those are absent. `shell/site.css` is replaced with the theme; `shell/local.css` is not.

## Page history and authoring schema

Saving a content page writes the new YAML, then appends the **previous raw file** to `$TESSERA_DATA/history/content/<id>.history` (one append-only file per page, outside the web root). An unchanged file does not append. A publish failure restores the previous file and does not append. History is not a field on the published page and is not copied into `site.json`.

**Retention** is optional on `site.yaml`: `historyMaxEntries` and/or `historyMaxAgeDays`. There are no defaults — history is never pruned until a site manager sets at least one. When either is set, an entry is dropped if it is older than the age limit **or** outside the newest N entries (OR). Prune runs after a content history append, and a site save with a limit set sweeps every history file. Clearing both limits leaves existing files alone.

The editor History panel lists earlier copies; clicking a time views that raw YAML (no restore). The save response names the new `site.<hash>.json`. That filename is the browser cache key: `rev.json` changes with it, and an open snapshot tab picks the new file up on its next poll.

**Authoring schema** is `schemaVersion` in `$TESSERA_DATA/meta.json`. It is not `SiteDocument.version` (the number the renderer validates). **Schema 4** stores compose zones as widget `blocks` lists; the API migrates sites at **3** or below on boot (`html:` → widgets, drops page `json:` zones). The process reads `schemaVersion` and stamps it on each history entry. It does not bump the counter during normal saves. Missing or non-numeric means **0**. First boot copies `seed/meta.json` into `data/` only when `meta.json` is absent, so a later boot does not wipe the stamp.

Updates replace the release tree and leave `$TESSERA_DATA` unchanged. There is no post-update rewrite of records.

Three numbers stay distinct: the Tessera release (editor and libraries), `schemaVersion` (the stamp on `meta.json` and on history entries), and `SiteDocument.version` (the flattened document the renderer validates). An editor-only release does not require a new export. Already-exported `publish/` trees keep the shell they were built with until the next export.

## Relative assets

A published site is a folder of files. It stays portable to any directory, including a path on a shared domain, without a server mount setting:

- Vite `base: "./"` (not `/`) on the site build. The editor SPA uses `base: "/"` because it is served at the hostname root.
- The snapshot shell points at `./data/site.<hash>.json` via `<meta name="tessera-site">` (not `/data/...`, and not a timestamp query)
- Media URLs in the document should be relative (`./media/...`), not root-absolute (`/media/...`) or required CDN URLs
- `normalizeSiteAssetUrl` rewrites accidental `/foo` media paths to `./foo` at render time
- Hash routing (`#page`) keeps the browser path on that folder

`localStorage` is shared by every page on an origin. The cache key for the hashed site file is that file’s absolute URL (`documentCacheKey`), so two published sites on one host do not share a cache. The URL is only a cache identity. It is not a server base path.

Flatten (`writeSnapshotFiles`) writes three files next to each other: the stable `site.json` (tools and the editor), `site.<hash>.json` (the bytes the browser fetches), and `rev.json` (`{ hash, file }`). The open-tab poll reads `rev.json` and downloads a new hashed file only when the hash changes. A preview write stamps `shell/index.html` only. A snapshot dist write stamps `publish/index.html` only, so the authoring shell keeps pointing at `preview/`. `npm run stamp:snapshot` refreshes the reference sites' `publish/data` files and their shells from the `site.json` already on disk.

## Library

Images and PDFs are a **library**: a flat blob store plus virtual folders. The blobs live in `$TESSERA_DATA/files/<id>.<ext>` and are never renamed when a file moves. Folder records (`records/folders`) are directories (`id`, optional `parentId`). The id is the folder's name. Asset records (`records/media`) point at a folder and carry `name`, `kind` (`image` or `document`), and `ext`. An optional `title` is public: image alt text, or the label of a download. They do not store a URL.

Flatten derives `url: ./media/<id>.<ext>` onto each `media[]` entry. That string is relative to the site folder. A gallery folder is still a gallery source: flatten lists the image assets directly inside it, each with that stable `url` and `file` set to the display name. `slidesFromFolders` uses `url` when it is present. A virtual move changes `folderId` only.

A media record may skip the library and store `url` itself, with no `kind`. A folder may store `path` and an `images` list. Flatten copies those records into the document unchanged. They are a hand-edited escape hatch for a file the library does not own. The library listing leaves them alone.

A Library **Rescan** button compares `files/` with the library records: a missing blob drops its media record, and a new image or PDF is imported into a `scanned` folder.

The editor resizes each image to `files/<id>.thumb.webp` on upload. Thumbnails are not published. **Publish** copies each blob to `publish/media/<id>.<ext>`. Preview reads `./media/<id>.<ext>` from `files/` first. A pages dist rewrites those URLs with `assetHref` so a nested page reaches `media/` at the site root (`../../media/…`). The snapshot and the preview leave the URL as `./media/…`, which stays valid when the site folder is hosted under a subpath.

The global `media[]` catalog is every asset. Gallery components still reference folder ids.

## Zod

[`zod`](https://zod.dev) is used only in `@r-a-i-t-h/tessera-model` to **validate** the flattened `site.json` when it is loaded. TypeScript types are inferred from the same schemas, so the editor and the renderer share one contract. A malformed document fails at parse time with a structured error instead of half-rendering.

## How dynamic lists / custom behaviour are defined

**Component implementations** ship in `@r-a-i-t-h/tessera-extras` (and renderer builtins such as nav and gallery). The runtime registers them. **Bindings** (which data + which component, under a public id) live in `site.json`:

```json
"bindings": [
  {
    "id": "upcoming-events",
    "component": "datedList",
    "props": { "tag": "event", "limit": 3, "upcoming": true }
  }
]
```

Content inserts the populated view with mustache or a component block:

```html
{{upcoming-events}}
```

```json
{ "type": "component", "name": "upcoming-events" }
```

**What requires a Tessera release:** adding a new **catalogue** component implementation (then available to every site). **Runtime modules** are site-owner ESM copied at publish; they are not catalogue releases.  
**What does not:** changing text, JSON, layout trees, bindings, dataset rows, runtime module source, or which binding ids a page references.

Nav presentations (`navFlat`, `navTree`, `navCollapse`, `navTags`, …) are registered components; designed `document.nav` plus optional `source` supply data. Heading rows may omit heading text and still group links. `navCollapse` shows the first link in each group as the section entry and reveals siblings in sub-level markup when the current page is in that group. Page existence does not imply a nav entry.

Web components follow the same idea: implement with `WCBase`, `customElements.define`, then either emit the tag from a small registry function or `registry.defineElement(name, tagName)`.

## Rendering pipeline

1. Load + validate the hashed site file named by `<meta name="tessera-site">`; persist to `localStorage` under the absolute URL of that file (one cache per published site on a shared origin); fall back to cache on failure (see SPEC §3). While open, poll `rev.json` on a 5-minute TTL.
2. Resolve page from hash (unknown ids fall back to home — no error UI). Snapshot sites only.
3. Resolve the page’s **profile** (`resolvePageProfile`: the type's layout, otherwise the site default), then merge `page.zones`, the page's includes, the page layout's includes, and the master frame's includes when that layout is a different one. The same item id is merged once.
4. Walk the frame from `resolveMasterLayout` (this page's `masterLayoutId`, otherwise the nearest ancestor's, otherwise `site.masterLayoutId`). Its `page` node is the resolved page layout. Zone nodes render their blocks; unknown component names become HTML comments. Nav components in the frame read `document.nav`.
5. Optional `onAfterRender` / `onStatusChange` for chrome outside the document (demo sidebar, stale banner).
6. While open, re-fetch on a 5-minute TTL when `documentUrl` is set.

## CSS

Default skin is **W3.CSS 5.01** (`packages/skin-w3/css/w3.css`). Layout regions use semantic `role`s; the skin maps them to classes. Swap skins without changing `SiteDocument`.

## Pages publisher

`publishPages(document, { origin })` in `@r-a-i-t-h/tessera-renderer` walks `publishedPageTree` and returns one HTML file per page plus `sitemap.xml`. Registered HTML components (nav, lists, gallery, `searchBox`, `searchResults`) are written into the file. Custom elements and unknown names stay `data-tessera-microapp` mounts plus a JSON description. The pages runtime hydrates those mounts, boots blog and search, and does not boot the snapshot renderer. Nav and page-ref links use `hrefForPage` (page path in a pages dist, `#id` in the snapshot). Authored `<a data-tessera-page="…">` anchors are resolved in zone HTML at render time. **Publish** writes this tree into `publish/` when `delivery` is `pages` or omitted, and always writes `search-index.json` (MiniSearch JSON plus tag/type facets) beside the dist root.

- Home is `index.html`. Any other page is `{path}/index.html`. The path is the chain of page `id` segments. The home page’s own segment is not part of that chain.
- `<title>`, optional meta description, and `<link rel="canonical">` come from the page and `origin`.
- Nav menus are built from `document.nav` (sidebar, top bar, footer flags per entry), not from the page tree. Links are relative to the file so a site can live in a folder.
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

Runtime modules under `runtime-modules/` are owner ESM (typically `.mjs`). The site runtime loads them with `import()`, which requires a JavaScript `Content-Type`, not `application/octet-stream`. Current nginx `mime.types` maps `.mjs` to `text/javascript` alongside `.js`. Older nginx builds may omit `.mjs`; add a type next to `include mime.types;` without replacing the file:

```nginx
types {
    text/javascript mjs;
}
```

The editor preview host and site dev server set the same MIME for `.mjs` when they serve `./runtime-modules/` from the instance tree.

## Examples

```bash
npm install
npm run dev:site                         # instance preview (port 5173)
npm run dev:api                          # edit data/; Render site writes the preview, Publish writes publish/
```

Willow’s person type uses the `profile` layout. Its event and news types use `article`. The directory holds records in `records/`, a document shell in `shell/`, and static files in `publish/`. The frame is the master layout.
