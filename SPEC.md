# Tessera specification (v0.1)

Tessera is a **client-side site runtime** that renders an entire small website from one validated JSON document plus a site-owned component registry — no SSR, no runtime datastore, and no recursive content zones.

It is the successor to Rec-Tem (“recursive templates”). The mosaic metaphor remains: layouts place the tiles (zones); content fills them — or leaves them empty. Tessera drops the recursive element so content can no longer invent zones that themselves contain further content. Boundaries between **modelling data**, **rendering HTML**, and **exposing W3.CSS styling** are deliberate packages rather than a ball of mud.

| Doc | Role |
|-----|------|
| **This SPEC** | Product + architecture ambition: concepts, requirements, Phase-1 design decisions, acceptance criteria, and open refinements |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-built engine contract (packages, pipeline, Zod shapes as implemented) |
| [ROADMAP.md](./ROADMAP.md) | Sequenced upcoming work; links here for the “why/what” |

---

## 1. Goals and non-goals

### Goals

- Deliver a full small site from a single flattened payload (`site.json`) loaded once up-front and reused for SPA navigation.
- Support static page content and structured **items** (lists / collections of record-like data) shown on-a-page or as-pages via registered components.
- Keep sites **mobile layout friendly** (adaptive layout; default skin is W3.CSS).
- Ship enough shared components to build a complete site (listings, blog, gallery, document browser, layout primitives) without blocking site-specific components.
- Provide a clear inclusion story without recursive zones (see [Inclusion](#6-inclusion-without-recursive-zones)).
- Survive fetch failures after a successful load via `localStorage`, with a signal for stale/offline chrome.
- Leave a clean contract for a later **editor** that flattens many records into the same document shape.

### Non-goals (Phase 1)

- SSR or SEO-first multi-page HTML.
- Runtime lookups from a datastore (the published site is one JSON file).
- Recursive zone invention from inside page content.
- Edit-in-place on the rendered site.
- Multi-version / draft content on the client (one published snapshot only).
- Shipping the editor as part of the renderer phase.
- Full installable offline (Service Worker / app manifest) as a Phase-1 requirement — see [Needs refinement](#12-needs-refinement).

---

## 2. Concepts

### Site document

The whole text/data payload for a site is one **`SiteDocument`**: site meta, layouts, pages, **items**, media, and nav. It is validated on load (schema version + structure). Exact Zod shapes live in [ARCHITECTURE.md](./ARCHITECTURE.md) until implementation catches up to this SPEC.

### Layout and zones

- A **layout** is a tree of regions, zones, static HTML, and components.
- **Only layouts declare zones** and where they appear on the page.
- A **page** may set `layoutId` explicitly, or omit it and inherit from **section profiles** / `site.defaultLayoutId`.
- A page may pull in shared **items** and contribute blocks into zones.
- Contributions to zones the layout does not declare are not painted, but may remain available as data for components (e.g. JSON for a list).

### Section profiles

Hierarchical **sections** switch layout/skin for slices of the site **without** recursive content templates:

- `document.sections[]` is a shallow tree: `{ id, match, layoutId?, skinId?, children? }`.
- `match` uses tags and/or `pageIdPrefix` (present fields are ANDed; empty match matches all).
- Resolution order: `site.defaultLayoutId` (+ `site.theme` as default skin) → matching sections (deeper / later wins) → `page.layoutId` override.
- Layouts remain first-class; sections never invent zones. Within-page variety stays regions, bindings, and layout WCs.

### Pages and items

- **Page** — a navigable unit: resolved layout + zone contributions (+ optional includes).
- **Item** — reusable content contribution (the collection formerly thought of as “lists” / “collections”). Lists and collections are the same idea; the vocabulary is **`items`**.
- Items may be shown **on a page** (component loops over data) or **as pages** (each record becomes a navigable page / nav link), depending on registered bindings.

### Blocks

Zone content is composed of blocks such as:

- **text** — trusted authored HTML (no embedded JavaScript).
- **json** — structured data for components (often not painted directly).
- **media** — references into the media catalog.
- **component** — a named registry entry (see inclusion).

### Component registry

Dynamics are TypeScript owned by the site (or shared Tessera packages), **imported and registered by name**. Content never embeds scripts. Adding a *new* component implementation requires a rebuild; changing text, JSON, layout trees, or which registered names a page calls does not.

### Skin

Default presentation is **W3.CSS** (adaptive layout). Layout regions use semantic roles; the skin maps roles to classes. Skins can be swapped without changing the document model.

### Web components

Where authoring syntax benefits, prefer custom elements (e.g. `<imgbox>`, `<quote>`) over verbose classed divs. Shared and site-specific pieces should use the same **`WCBase`** boilerplate so plumbing is common and only content treatment / attributes differ.

---

## 3. Runtime: load, cache, TTL, versioning

### Delivery model

- Sites are **SPA-rendered in the browser** from a pre-published JSON file. “Static” here means *no live datastore* and *payload prepared ahead of time* — not plain multi-page HTML and not SSR.
- Load the document from a subdirectory-relative URL (e.g. `./data/site.json`). Vite `base: "./"` and relative media URLs keep sites subdirectory-safe.
- After a successful load, navigation uses the in-memory document.

### Fetch and cache-busting

1. Fetch `site.json` with a **cache-busting query** (e.g. timestamp) so HTTP caches do not serve stale content. (Hashed JS bundles handle *code* cache-busting separately.)
2. On success: validate, render, write to **`localStorage`**.
3. On failure: if a prior compatible document exists in storage, use it and mark **using cached / stale data** so chrome can show a banner.
4. A full **page refresh** always attempts a fresh fetch (latest data when online).

### In-session TTL

While the SPA stays open, re-check for updated data on a fixed interval of **5 minutes** (not driven by visibility, focus, or other events). On success, replace in-memory document and `localStorage`. On failure, keep the current document and retain the stale signal as appropriate.

### Offline behaviour

| Level | Expectation |
|-------|-------------|
| **Required** | After a successful load, browsing continues if a later fetch fails (including going offline mid-session), using in-memory / `localStorage` data and a stale/offline signal. |
| **Icing** | Cold-starting the SPA while already offline (browser HTTP cache delivers the app shell; app then reads `localStorage`). Research and optional hardening; not a Phase-1 gate. |

### Schema and app versioning

- On-disk `site.json` and the `localStorage` cache identify a **schema version**.
- The running Tessera **app version and expected schema must stay in sync**. If cached schema ≠ what the app expects, **abandon the cache** and require a fresh download (no silent half-upgrade).
- Deployments serve matching app + data together. If the client can load the latest app, it may assume compatible latest data is fetchable when online.
- **Content revision history** is an editor concern. The client shows a single published snapshot.
- **`lastModified`** should be available on content entities so readers can see whether material was updated recently.

### Routing and missing pages

- Phase 1 keeps **hash routing** (back/forward already work). A move to the Navigation API is optional later ([Needs refinement](#12-needs-refinement)).
- **Missing page ids must not surface a raw error UI.** The site handles the case (e.g. silent fallback to the home page). Exact policy may become site-configurable later.

---

## 4. Authoring model

- Content is trusted authored material: `text` blocks may contain HTML. Dynamics are never authored as inline scripts inside the document.
- Pages and items reference layouts, zones, media, **bindings**, and registered component names.
- **Bindings** are part of site data: pair content (e.g. an item’s JSON zone) with a registered component under a public id such as `farm-open-days`. Insert with `{{farm-open-days}}` in text HTML or a component block named `farm-open-days`.
- Relative asset URLs (`./…`) are required for subdirectory hosting; the renderer may normalize accidental root-absolute media paths at paint time.

---

## 5. Navigation as content

Nav is first-class document content, not merely demo chrome — and it is **distinct from page existence**.

- **Pages** may exist without appearing in any nav (reachability ≠ visibility).
- **Designed nav** (`document.nav`) is authored structure for “perma” entries (hand-chosen pages, headings, nested children).
- **Content-implied nav** uses `source` on a nav node (e.g. `pagesTag` / `itemsTag`) so dynamic items or tagged pages become link *data* in the tree. That is different from nav-by-design.
- **Presentation is a component choice**, not a system mandate. Shipped options include tag grouping (`navTags`), full tree (`navTree`), and collapsible regions (`navCollapse`). Sites may register others. A component might render the same resolved tree as tags, a tree, or an accordion.
- Physical shell chrome (drawer markup, overlay) remains a thin site/skin concern that *consumes* nav components or resolved nav data.

---

## 6. Inclusion without recursive zones

Rec-Tem’s strength was content that could add zones without knowing what would fill them. Tessera forbids inventing zones from content. The replacement:

1. **Bindings live in the site document** — not only in TypeScript. Example: list of dated events + `eventList` (or `DatedEventList`) registered as binding id `farm-open-days`.
2. Other content inserts the populated view with `{{farm-open-days}}` (or a component block with that name). Authors do not re-wire data to the component at each call site.
3. Component *implementations* remain TypeScript in the site/registry (rebuild to add a new Y). Binding rows (Z → X + Y) are data and can change with `site.json`.

```text
bindings[]: { id: "farm-open-days", component: "eventList", itemId: "…", fromZone: "events" }
content: "{{farm-open-days}}"
```

**Note:** Iteration over items that themselves invented nested zones (old Rec-Tem) is **out**. Iteration via bindings + components is **in**.

Inserting a binding onto a page is **separate** from inserting a page into nav — symbiotic, not coupled.
---

## 7. Layout, mobile, and web components

- Mobile-friendly adaptive layout is a key product requirement; W3.CSS is the default means, not the requirement itself.
- Common layout combinations (side-by-side columns, image treatment, quotes) should be **chainable end-to-end** and trivially specified in content.
- Prefer web components for sweet syntax (`<imgbox>…</imgbox>`, `<quote>…</quote>`) and encourage the same pattern for site-custom elements.
- **`WCBase`** should make new elements trivial: shared lifecycle/plumbing; specific treatment of light DOM contents and attributes (title, tooltip, etc.).

---

## 8. Shipped capabilities (ambition)

Without being limiting, Tessera should ship enough shared pieces to build a full site with useful features:

| Area | Intent |
|------|--------|
| Listings / items | First-class story for iterating structured items (not only one-off site `ComponentFn`s) |
| Blog | Items expanded as pages + list-on-page views |
| Gallery | Real gallery component and media story (not convert stubs) |
| Document browser | Browse structured document-like content |
| Layout primitives | imgbox, quote, row/column helpers — preferably as WCs and/or skin helpers |
| Nav | Document-owned designed tree + optional `source`; presentations via components (tags / tree / collapse / custom) |
| Bindings | Site-data `bindings[]` + `{{id}}` / component name insertion |
| Chrome hooks | Stale/offline signal for banners |

Site-specific registry components remain first-class.

---

## 9. Editor boundary (Phase 2)

- The public renderer stays Phase 1: no SSR, no live datastore, no edit-in-place.
- The **editor API** (`apps/editor-api`) is a same-origin JSON host the future SPA will call. Cookie + Bearer sessions; subdirectory-safe via `TESSERA_BASE_PATH`.
- **No self-signup.** Users are files under `data/users/` (seeded from `seed/users/`); add them with `seed:user`.
- Access is **all-or-nothing**: any authenticated user may perform every editor mutation. `requireEditor` is the choke point so later ACL can replace that helper without rewriting routes.
- The **editor SPA** (`apps/editor`) is a same-origin Vite app (not shipped with the renderer). Dev proxies `/auth`, `/api`, `/health` to the API; production can serve `dist` from the Hono process so the `httpOnly` session cookie never crosses origins.
- Authoring model: many records → flatten → published `SiteDocument` / `site.json`.
- The renderer never depends on the editor; the editor may host the renderer for preview.
- Flatten output **is** the renderer contract.

---

## 10. Acceptance criteria

Criteria define “done enough,” not a build order (see [ROADMAP.md](./ROADMAP.md) for sequencing).

### Content fetch, cache, and TTL

- [ ] Fetch uses a cache-busting query.
- [ ] Successful load validates, renders, and persists to `localStorage` with schema version.
- [ ] Fetch failure falls back to a schema-compatible cached document and sets a stale/offline signal.
- [ ] Incompatible cached schema is abandoned; fresh data must be downloaded.
- [ ] While the SPA remains open, a **5-minute** TTL re-fetches and updates on success.
- [ ] Full page refresh attempts latest data (when online).
- [ ] Demos can surface an offline / stale-content banner from the signal.

### Inclusion and items

- [x] Bindings are site data (`document.bindings`) pairing content with a registered component under a public id.
- [x] Content can insert a binding via `{{id}}` in text HTML and via a component block named with that id.
- [x] Section profiles resolve layout/skin for matching pages (page override > section > site default) without recursive templates.
- [ ] Items support list-on-page and as-pages presentation patterns used by demos / shipped components.

### Navigation

- [x] Page existence does not imply nav visibility (designed nav is authored separately).
- [x] Nav nodes may declare `source` for content-implied links (e.g. by page/item tag).
- [x] Multiple nav presentations ship as components (`navTags`, `navTree`, `navCollapse`); none is mandatory.
- [x] Shell chrome may consume a nav component (demo-pure uses `navCollapse`).

### Gallery and presentation

- [ ] Gallery component renders image sets from the model/media story (converted stubs replaced).
- [ ] Layout primitives (imgbox, quote, side-by-side) are available in a form content authors can use trivially.
- [ ] Mobile adaptive layout remains the default path (W3 skin or equivalent).

### Routing and errors

- [ ] Hash routing supports back/forward for in-app page changes.
- [ ] Unknown page ids do not show a raw error page; site policy handles them (e.g. home fallback).

### Carry-forward (already demonstrated)

- Dynamic menus from document nav into sidebar chrome; in-page headings menu; site components such as `pageNav` (refine as nav-as-content lands).

### Explicitly later / soft

- **Fanciness** — polish, motion, richer presentation beyond minimal W3 chrome; keep scoped as an open product goal until specified further.
- **Cold-start offline** — icing only.
- **Editor SPA** — login shell exists; content editing and flatten still later.

---

## 11. Related documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — packages, merge/walk pipeline, relative assets, current Zod contract.
- [ROADMAP.md](./ROADMAP.md) — ordered upcoming features implementing this SPEC.

---

## 12. Needs refinement

Parking lot for design that is sound enough to proceed in spirit but not yet nailed. Organic “good enough” solutions are welcome; this is not a blocker list.

1. **Binding content sources** — beyond `itemId` + `fromZone` (e.g. page zone, inline JSON, query over items).
2. **Cold-start offline** — behaviour when the browser requests the site while already offline (HTTP cache vs Service Worker vs legacy appcache/manifest). Required mid-session offline is specified; cold-start is icing.
3. **Hash vs Navigation API** — whether deep-link UX or hosting constraints ever justify leaving hash routing.
4. **`localStorage` size** — strategy when documents are large (HTML-heavy converted sites); quotas, compression, or alternate cache.
5. **Missing-page policy** — global silent home fallback vs site setting.
6. **Nav source vs list-as-pages** — how much machinery is shared between content-implied nav links and generating pages from items.
7. **HTML trust / sanitization** — trusted-author model is Phase 1; multi-author sanitization later if needed.
8. **Topbar vs sidebar** — how shell chrome consumes document nav flags/roles.
9. **Fanciness scope** — motion and polish criteria when ready to schedule.
10. **`lastModified` placement** — which entities require it and how it is surfaced in UI.
11. **Mustache in nested binding output** — whether binding results that contain `{{…}}` should expand recursively (currently one pass on authored text/static nodes).