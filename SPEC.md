# Tessera specification

Tessera publishes a small website from structured records and a shared catalogue of micro-apps. A site is one of two flavours: a **snapshot** (one JSON document, rendered in the browser) or **pages** (one static HTML file per page). Neither flavour renders on request, and neither uses a runtime datastore. Content cannot invent recursive zones.

It is the successor to Rec-Tem (“recursive templates”). The mosaic metaphor remains: layouts place the tiles (zones); content fills them — or leaves them empty. Tessera drops the recursive element so content can no longer invent zones that themselves contain further content. Boundaries between **modelling data**, **rendering HTML**, and **exposing W3.CSS styling** are deliberate packages rather than a ball of mud.

| Doc | Role |
|-----|------|
| **This SPEC** | Product + architecture ambition: concepts, requirements, design decisions, acceptance criteria, and open refinements |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-built engine contract (packages, pipeline, Zod shapes as implemented) |
| [ROADMAP.md](./ROADMAP.md) | Sequenced upcoming work; links here for the “why/what” |

---

## 1. Goals and non-goals

### Goals

- Deliver a full small site either as a **snapshot** (one flattened payload loaded once and reused for in-browser navigation) or as **pages** (one HTML file per page in a tree, with nav written into each file).
- Support static page content and structured **items** (lists / collections of record-like data) shown on-a-page or as-pages via registered components.
- Keep sites **mobile layout friendly** (adaptive layout; default skin is W3.CSS).
- Ship enough shared components to build a complete site (listings, blog, gallery, document browser, layout primitives) without blocking site-specific components.
- Provide a clear inclusion story without recursive zones (see [Inclusion](#6-inclusion-without-recursive-zones)).
- Survive fetch failures after a successful load via `localStorage`, with a signal for stale/offline chrome.
- Keep a clean editor boundary: authoring flattens many records into the same document shape consumed by the renderer.

### Non-goals

- Request-time rendering, and a generic server that loads site micro-app code.
- Publishing static stand-ins so micro-apps work with JavaScript disabled.
- Mixing both dist flavours in one `publish/` tree. The preview snapshot lives in `preview/` and is not a second public site.
- Runtime lookups from a datastore. A snapshot site’s published payload is one JSON file. A pages site’s published payload is the HTML files.
- Recursive zone invention from inside page content.
- Edit-in-place on the rendered site.
- Multi-version / draft content on the client (one published snapshot only).
- Coupling the editor or its server to the public runtime.
- Full installable offline (Service Worker / app manifest) as a current requirement — see [Needs refinement](#12-needs-refinement).

---

## 2. Concepts

### Site document

The whole text/data payload for a site is one **`SiteDocument`**: site meta, layouts, pages, **items**, media, and nav. It is validated on load (schema version + structure). Exact Zod shapes live in [ARCHITECTURE.md](./ARCHITECTURE.md) until implementation catches up to this SPEC.

### Layout and zones

- A **layout** is a tree of regions, zones, static HTML, components, and at most one **page** slot.
- **Only layouts declare zones** and where they appear on the page.
- `site.masterLayoutId` names the outer page (the frame: header, nav, drawer). Its `page` node is replaced by the page's own layout. A page may set `masterLayoutId`. Descendants use the nearest ancestor's frame until one of them sets its own. The home page's `parentId` is ignored, so it does not inherit a frame. Content cannot fill that node. Nav is a component placed in the frame. The shell is the document head, one mount, and CSS.
- A **page** uses the layout of its site-defined **type**, or `site.defaultLayoutId` when it has no type.
- A page may pull in shared **items** and contribute blocks into zones.
- Contributions to zones the layout does not declare are not painted, but may remain available as data for components (e.g. JSON for a list).

### Types

A **type** is site configuration, not a built-in class. `{ id, layoutId?, fields[] }`. An entry points at one type. The type's layout is the page layout. A page with no type uses `site.defaultLayoutId` and is reached through the page tree.

Fields are scalar values on the entry (`date`, `precis`, and whatever else the type names). `title` and the body zone are always available. A layout zone with no authored HTML shows the field of the same id. Subject `tags` filter. They do not choose the type or the layout.

A listing behavior names the types it reads and, for dates, a window (`past`, `upcoming`, or all). It shows `title`, `date`, and `precis`. There is no built-in blog or event type. Willow's `event` and `news` types are examples that satisfy that behavior.

### Pages and items

- **Page** — a declared document: id, title, optional description, place in the published tree, body (zones), and whether it appears in nav. Resolved layout + zone contributions (+ optional includes).
- **Title** is what a visitor reads: the page, the site, a nav entry, and a media file. Templates, items, layouts, types, and folders have no title. The id is their name.
- **Published page** — a page present in the document the publisher reads. An in-progress page is absent from that document. The publisher does not see a draft flag. History is a stack of earlier copies kept by the editor, and publish means “this copy is now the published page.”
- **Item** — reusable content contribution (the collection formerly thought of as “lists” / “collections”). Lists and collections are the same idea; the vocabulary is **`items`**. An item is named by its id.
- Items may be shown **on a page** by a micro-app. A record that should have its own URL is its own page in the tree, not a child invented by a micro-app.

### Blocks

Zone content is composed of blocks such as:

- **text** — trusted authored HTML (no embedded JavaScript).
- **json** — structured data for components (often not painted directly).
- **media** — references into the media catalog.
- **component** — a named registry entry (see inclusion).

### Micro-app

A **micro-app** is an interactive client-side mount on a page: an event list, a gallery, a filterable directory. It runs in the browser after the page has loaded. It does not create pages and it does not add nav entries.

“Component” remains the implementation word (a registry function, a web component). The product term for the visitor-facing mount is micro-app.

Micro-apps are client-only in both flavours. The pages publisher writes an empty mount and a JSON description of the data that mount needs. It does not run the micro-app.

### Component registry

Micro-app implementations live in the shared catalogue and the renderer builtins, **registered by name**. Content never embeds scripts. A site has no build step and does not ship component source. Adding a new micro-app is a Tessera release, and that name is then available to every site. Changing text, JSON, layout trees, or which registered names a page calls does not require a release.

### Skin

Default presentation is **W3.CSS** (adaptive layout). Layout regions use semantic roles; the skin maps roles to classes. Skins can be swapped without changing the document model.

### Web components

Where authoring syntax benefits, prefer custom elements (e.g. `<imgbox>`, `<quote>`) over verbose classed divs. Shared and site-specific pieces should use the same **`WCBase`** boilerplate so plumbing is common and only content treatment / attributes differ.

---

## 3. Runtime: load, cache, TTL, versioning

### Delivery flavours

A site’s copyable dist is either **pages** (one HTML file per page) or **snapshot** (one JSON document). `delivery` on the site record chooses it and defaults to `pages`. **Publish** writes that dist into `publish/` and replaces the previous flavour’s generated files, so the folder is never a mix. Editing does not write `publish/`. The preview is always the snapshot, in `preview/`, and ignores `delivery`. Copy `publish/` to the live host, or set `publishTo` to an existing directory the app user can write. Publish then replaces the files in that directory. It does not create a missing path and does not run as root.

“Static” means the published files are prepared ahead of time. The browser talks to a static file host (nginx or equivalent). Node is the build, not the request path.

Folder-relative URLs (`./…`) and Vite `base: "./"` keep a published site portable to any directory, including a path on a shared domain. The editor and its API are a separate install and are served at the root of their own hostname.

#### Snapshot

- One JSON document, rendered in the browser. Hash routing stays. Indexing expectation: the homepage only, after JavaScript runs. Link previews see the shell.
- The shell names a **content-hashed** file in `<meta name="tessera-site" content="./data/site.<hash>.json">`. The first load fetches that file and does not fetch anything else first. There is no timestamp query on the document URL.
- A content edit rewrites the meta tag, writes `site.<hash>.json`, and writes `data/rev.json` (`{ "hash", "file" }`). Unchanged bytes keep the same name, so HTTP caches can hold them.
- On success: validate, render, write to **`localStorage`**. The cache key is the absolute URL of that hashed file. Storage is shared by the whole origin, so that URL is what gives each published site its own cache when several sites sit on one domain. It is not a server base path.
- On failure: if a prior compatible document exists in storage, use it and mark **using cached / stale data** so chrome can show a banner.
- A full **page refresh** loads the file the current shell names.

#### Pages

- A **tree of pages**. `parentId` is the parent. The home page is the site root (`index.html`). Every other page is `{path}/index.html`, where the path is the chain of `slug` (or `id`) segments under the home page.
- Each file contains that page’s prose, `<title>`, optional meta description, canonical URL, and that page’s frame: the site master, or the frame set on the page or its nearest ancestor. `showInNav: false` keeps the URL and the file. A menu link appears only when that frame's nav component includes that page.
- Micro-app regions are empty `data-tessera-microapp` mounts plus a JSON description. They run in the browser.
- `sitemap.xml` lists every published page URL.
- Visitors move between pages by loading the next HTML file.

### Seeing a new homepage

The homepage address stays the site root. CSS, JS, and the snapshot JSON use filenames that include a content hash, and the host may cache those names for a long time. The new HTML is what points at the new names, so HTML itself is checked on every load.

Nginx (or the static host) sends two separate headers for HTML, including `/`, which does not end in `.html`:

- `ETag` — nginx sends this for static files by default.
- `Cache-Control: public, max-age=0, must-revalidate` — added in the site config. The browser may keep a copy and must ask before showing it. Unchanged is a small 304. After the file on disk is replaced, the next load receives the new HTML.

Hashed files under `/assets/`, and `site.<hash>.json`, use `Cache-Control: public, max-age=31536000, immutable`.

The open-tab poll is separate: every five minutes the snapshot client fetches `rev.json` with revalidation (`cache: "no-cache"`). When the hash matches, it does not download the document. A tab that is already open keeps its HTML until reload. The pages flavour has no poll; the next request for the HTML file is the update.

A host that ignores `Cache-Control` and stores HTML for hours will keep serving the old homepage until its own timer ends. Page URLs never carry a timestamp query. Copy-paste nginx for a vhost and for a folder on a shared host lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

### In-session TTL

While a snapshot stays open, re-check `rev.json` on a fixed interval of **5 minutes** (not driven by visibility, focus, or other events). When the hash changes, fetch the new file, replace the in-memory document and `localStorage`. When the hash matches, do nothing. When the check fails, keep the current document and retain the stale signal as appropriate.

### Offline behaviour

| Level | Expectation |
|-------|-------------|
| **Required** | After a successful load, browsing continues if a later fetch fails (including going offline mid-session), using in-memory / `localStorage` data and a stale/offline signal. |
| **Icing** | Cold-starting the SPA while already offline (browser HTTP cache delivers the app shell; app then reads `localStorage`). Research and optional hardening; not a release gate. |

### Schema and app versioning

- The hashed site file and the `localStorage` cache identify a **schema version**. The stable `site.json` beside it is the same bytes, for tools. The browser loads the hashed name.
- The running Tessera **app version and expected schema must stay in sync**. If cached schema ≠ what the app expects, **abandon the cache** and require a fresh download (no silent half-upgrade).
- Deployments serve matching app + data together. If the client can load the latest app, it may assume compatible latest data is fetchable when online.
- **Content revision history** is an editor concern. The client shows a single published snapshot.
- **`lastModified`** should be available on content entities so readers can see whether material was updated recently.

### Routing and missing pages

- The snapshot flavour keeps **hash routing** (back/forward already work). The pages flavour uses the path of each HTML file. A move to the Navigation API for the snapshot flavour is optional later ([Needs refinement](#12-needs-refinement)).
- **Missing page ids must not surface a raw error UI.** The site handles the case (e.g. silent fallback to the home page). Exact policy may become site-configurable later.

---

## 4. Authoring model

- Content is trusted authored material: `text` blocks may contain HTML. Dynamics are never authored as inline scripts inside the document.
- Pages and items reference layouts, zones, media, **bindings**, and registered component names.
- **Bindings** are part of site data: pair a registered component with a public id such as Willow’s `upcoming-events`. Insert with `{{upcoming-events}}` in text HTML or a component block named `upcoming-events`.
- Relative asset URLs (`./…`) are required for subdirectory hosting; the renderer may normalize accidental root-absolute media paths at paint time.

---

## 5. Navigation as content

Nav is first-class document content, not merely demo chrome — and it is **distinct from page existence**.

- **Pages** may exist without appearing in any nav (reachability ≠ visibility).
- **Designed nav** (`document.nav`) is authored structure for the snapshot flavour (hand-chosen pages, headings, nested children).
- **Pages-flavour nav** is the published page tree, written into each HTML file at publish. It is not rebuilt in the browser, and a micro-app does not extend it. `source` expansion that grows a hierarchy from a collection is a snapshot-era blur; the pages flavour does not use it.
- **Content-implied nav** on a snapshot uses `source` on a nav node (`pageType` / `itemsTag`) so entries of that type become link data. That does not create pages.
- **Presentation is a component choice**, not a system mandate. Shipped options include tag grouping (`navTags`), full tree (`navTree`), and collapsible regions (`navCollapse`). Further presentations are added to the shared catalogue, so every site can name them. A component might render the same resolved tree as tags, a tree, or an accordion.
- Physical shell chrome (drawer markup, overlay) remains a thin site/skin concern that *consumes* nav components or resolved nav data.

---

## 6. Inclusion without recursive zones

Rec-Tem’s strength was content that could add zones without knowing what would fill them. Tessera forbids inventing zones from content. The replacement:

1. **Bindings live in the site document** — not only in TypeScript. Example: Willow lists upcoming events with `datedList` registered as binding id `upcoming-events`.
2. Other content inserts the populated view with `{{upcoming-events}}` (or a component block with that name). Authors do not re-wire data to the component at each call site.
3. Component implementations live in the Tessera catalogue (a release to add a new Y). Binding rows (Z → X + Y) are data and can change with `site.json`.

```text
bindings[]: { id: "upcoming-events", component: "datedList", props: { tag: "event", limit: 3, upcoming: true } }
content: "{{upcoming-events}}"
```

**Note:** Iteration over items that themselves invented nested zones (old Rec-Tem) is **out**. Iteration via bindings + components is **in**.

Inserting a binding onto a page is **separate** from inserting a page into nav — symbiotic, not coupled.
---

## 7. Layout, mobile, and web components

- Mobile-friendly adaptive layout is a key product requirement; W3.CSS is the default means, not the requirement itself.
- Common layout combinations (side-by-side columns, image treatment, quotes) should be **chainable end-to-end** and trivially specified in content.
- Prefer web components for sweet syntax (`<imgbox>…</imgbox>`, `<quote>…</quote>`) and encourage the same pattern for catalogue elements.
- **`WCBase`** should make new elements trivial: shared lifecycle/plumbing; specific treatment of light DOM contents and attributes (title, tooltip, etc.).

---

## 8. Shipped capabilities (ambition)

Without being limiting, Tessera should ship enough shared pieces to build a full site with useful features:

| Area | Intent |
|------|--------|
| Listings / items | First-class story for iterating structured items (not only one-off site `ComponentFn`s) |
| Blog | Items expanded as pages + list-on-page views |
| Gallery | `<tessera-gallery>` grid, slides, and dialog. A library folder is the image set |
| Document browser | Browse structured document-like content |
| Layout primitives | imgbox, quote, row/column helpers — preferably as WCs and/or skin helpers |
| Nav | Document-owned designed tree + optional `source`; presentations via components (tags / tree / collapse / custom) |
| Bindings | Site-data `bindings[]` + `{{id}}` / component name insertion |
| Chrome hooks | Stale/offline signal for banners |

Components ship in the shared catalogue. A site names them from its records. A site does not ship its own scripts.

Gallery, layout primitives, nav, and bindings are in the product. Listings, a blog, and a document browser are the open rows. Sequencing is in [ROADMAP.md](./ROADMAP.md).

---

## 9. Editor boundary

- The public site stays free of request-time rendering, a live datastore, and edit-in-place. Drafts and history belong to the editor and are not fields on the published page. Once exported, visitors are served from static files. Those files may stay beside the editable site (`publish/`) or be copied elsewhere. The editor can be stopped while that static tree keeps working.
- Tessera’s version is the engine (editor API, editor SPA, model, renderer, and the shared component catalogue). A site is one directory, `$TESSERA_DATA`. Replacing that directory and restarting changes the site being edited. Nav, styling, and content travel with the directory. Micro-app implementations do not: they ship with Tessera, and the static export stamps that runtime into `publish/`. The editor API does not load site code.
- The **editor API** (`apps/editor-api`) is a same-origin JSON host the SPA calls. Cookie + Bearer sessions. The editor and its API are served at the hostname root (`tessera_session` cookie, `Path=/`). A published site has no server and may be placed in a folder.
- **No self-signup.** Users are files under `$TESSERA_DATA/users/` (copied from the release seed when that folder is empty). The Users page adds, edits, deletes, and disables them. `seed:user` still rewrites the release seed. A disabled user cannot sign in.
- Access is **all-or-nothing**: any authenticated user may perform every editor mutation. `requireEditor` is the choke point so later ACL can replace that helper without rewriting routes.
- The **editor SPA** (`apps/editor`) is a same-origin Vite app (not shipped with the renderer). Dev proxies `/auth`, `/api`, `/health` to the API; production can serve `dist` from the Hono process so the `httpOnly` session cookie never crosses origins.
- Authoring is **file-based YAML** (one file per Tessera `id`) in `$TESSERA_DATA/records`, outside the web root. An edit writes the SPA snapshot to `preview/data/site.json`. **Publish** writes `publish/` in the site's `delivery` flavour. No database.
- A starter site can be created from the editor when `site.yaml` is absent: shell, master layout (header, left sidebar, footer zone), a standard type and layout, a Hello world home page that includes a `common-footer` item, and a first sidebar link. The sidebar stays open on the left from 993px up and becomes a Menu button on the right of the bar plus a flyout from the right below that. `POST /api/site/reseed` replaces an existing site with that starter after a safety backup, and keeps editors. `delivery` defaults to `pages`.
- **Compose** edits a page as sections and stores zone HTML. Fields and Raw file edit that same HTML. The section catalogue is `@r-a-i-t-h/tessera-sections`.
- A **template** is `records/templates/<id>.yaml`. Publish skips that folder. A new page copied from one keeps tags, includes, and every zone except the title. A locked template sets `locked` on the page so the arrangement stays fixed while words and pictures stay editable. `locked` and `templateId` are editor fields; the published page omits them.
- The **library** holds images and PDFs. A virtual move does not change the published URL. The **Styles** page edits chrome tokens on the site record.
- A page is a page. A site-defined type names its fields and its layout. Subject tags filter and do not choose the type. Editor forms are drawn from a field schema for the record kind (string, number, date, Checkbox, SingleSelect), including fields that have no value yet. Keys the schema does not name stay on the form. `schemaVersion` is the authoring-file format, not a Person field list. There is no per-page draft flag.
- A content-page save appends the previous raw file to `$TESSERA_DATA/history/content/<id>.history`. That history is an editor file, not a field on the published page. The framing is a proof of concept; the authoring spec will replace it.
- **Authoring schema** (`schemaVersion` in `$TESSERA_DATA/meta.json`) is separate from `SiteDocument.version`. `deploy/post-update.sh` is the [node-vps-kit](https://github.com/r-a-i-t-h/node-vps-kit) hook that applies `deploy/migrations/NNN-*.sh`. The app reads the counter and does not bump it. Records live inside `$TESSERA_DATA`, so a migration can rewrite them.
- The renderer never depends on the editor. The editor API serves the real snapshot runtime from `/preview/`; the editing screen does not embed it yet. Hosting that render beside Compose is the next editor step.
- Flatten output **is** the renderer contract.

---

## 10. Acceptance criteria

Criteria define “done enough,” not a build order (see [ROADMAP.md](./ROADMAP.md) for sequencing).

### Content fetch, cache, and TTL

- [x] The snapshot shell points at a content-hashed site file. The first load fetches that file and does not request `rev.json` first.
- [x] Successful load validates, renders, and persists to `localStorage` with schema version.
- [x] Fetch failure falls back to a schema-compatible cached document and sets a stale/offline signal.
- [x] Incompatible cached schema is abandoned; fresh data must be downloaded.
- [x] While a snapshot remains open, a **5-minute** poll reads `rev.json` and downloads a new site file only when the hash changes.
- [x] Full page refresh attempts latest data (when online).
- [x] The site runtime can surface an offline / stale-content banner from the signal.

### Inclusion and items

- [x] Bindings are site data (`document.bindings`) pairing content with a registered component under a public id.
- [x] Content can insert a binding via `{{id}}` in text HTML and via a component block named with that id.
- [x] A site-defined type resolves layout for its entries (type layout, otherwise site default) without recursive templates.
- [ ] Items support list-on-page and as-pages presentation patterns in shipped components. Subpages lists child pages; a collection of records is still a binding.

### Navigation

- [x] Page existence does not imply nav visibility (designed nav is authored separately).
- [x] Nav nodes may declare `source` for content-implied links (e.g. by page/item tag).
- [x] Multiple nav presentations ship as components (`navTags`, `navTree`, `navCollapse`); none is mandatory.
- [x] Shell chrome may consume a nav component (Willow’s master layout uses `navFlat`).

### Gallery and presentation

- [x] Gallery component renders image sets from a library folder (grid or slides, plus a dialog). A Compose section names that folder.
- [x] Layout primitives (imgbox, quote, side-by-side) are available in a form content authors can use trivially.
- [x] Mobile adaptive layout remains the default path (W3 skin; a new site’s sidebar collapses below the large breakpoint).

### Pages flavour

- [x] A published page record is `id`, `title`, optional `description`, optional `parentId`, optional `slug`, optional `masterLayoutId`, optional `showInNav`, and the existing body zones. `locked`, `templateId`, and history are not on that record.
- [x] `publishPages` writes one HTML file per page, with prose, title, canonical URL, and that page’s frame.
- [x] Micro-apps are `data-tessera-microapp` mounts plus JSON. The publisher does not run them.
- [x] `sitemap.xml` lists every published page URL, including pages omitted from nav.

### Routing and errors

- [x] Hash routing supports back/forward for in-app page changes on the snapshot flavour.
- [x] Unknown page ids do not show a raw error page; site policy handles them (silent home fallback).

### Carry-forward (already demonstrated)

- Dynamic menus from document nav into sidebar chrome; in-page headings menu; catalogue components such as `pageNav` (refine as nav-as-content lands).

### Explicitly later / soft

- **Fanciness** — polish, motion, richer presentation beyond minimal W3 chrome; keep scoped as an open product goal until specified further.
- **Cold-start offline** — icing only.
- **Editor preview** — host the renderer inside the editor. Compose already edits the page; the rendered result is still a separate snapshot.

---

## 11. Related documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — packages, merge/walk pipeline, relative assets, current Zod contract.
- [ROADMAP.md](./ROADMAP.md) — ordered upcoming features implementing this SPEC.

---

## 12. Needs refinement

Parking lot for design that is sound enough to proceed in spirit but not yet nailed. Organic “good enough” solutions are welcome; this is not a blocker list.

1. **Binding content sources** — beyond `itemId` + `fromZone` (e.g. page zone, inline JSON, query over items).
2. **Cold-start offline** — behaviour when the browser requests the site while already offline (HTTP cache vs Service Worker vs legacy appcache/manifest). Required mid-session offline is specified; cold-start is icing.
3. **Hash vs Navigation API** — snapshot sites keep hash routing. Pages sites already have a path per page. Whether a snapshot site should leave hash routing is still open.
4. **`localStorage` size** — strategy when documents are large (HTML-heavy converted sites); quotas, compression, or alternate cache.
5. **Missing-page policy** — global silent home fallback vs site setting.
6. **Nav source vs list-as-pages** — how much machinery is shared between content-implied nav links and generating pages from items.
7. **HTML trust / sanitization** — the current model trusts authors; add sanitization if untrusted authors become a requirement.
8. **Topbar vs sidebar** — how shell chrome consumes document nav flags/roles.
9. **Fanciness scope** — motion and polish criteria when ready to schedule.
10. **`lastModified` placement** — which entities require it and how it is surfaced in UI.
11. **Mustache in nested binding output** — whether binding results that contain `{{…}}` should expand recursively (currently one pass on authored text/static nodes).