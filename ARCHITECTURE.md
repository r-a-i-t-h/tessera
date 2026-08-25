# Tessera architecture (v0.1)

As-built engine contract. Product ambition, Phase-1 design decisions, and acceptance criteria live in [SPEC.md](./SPEC.md). Upcoming work is sequenced in [ROADMAP.md](./ROADMAP.md).

Tessera is a small CMS runtime for sites whose full text/data payload is cheaper than a typical image. Content is authored as structured records, **flattened to one file**, and rendered entirely in the browser. Dynamics (menus, event lists, clocks) are client-side functions owned by the site codebase.

The name evokes mosaic tiles: layouts place the tiles (zones); content fills them — or leaves them empty.

The **editor** (out of scope for the renderer phase; see SPEC) will edit many records and emit the flattened file. The **renderer** only consumes that file plus a site-owned component registry. The editor may host the renderer for preview; the renderer never depends on the editor.

## Packages

| Package | Role |
|---------|------|
| `@r-a-i-t-h/tessera-model` | `SiteDocument` types + Zod validation |
| `@r-a-i-t-h/tessera-renderer` | Zone merge, layout walk, component registry, hash SPA |
| `@r-a-i-t-h/tessera-skin-w3` | W3.CSS **5.01** + region→class skin |
| `@r-a-i-t-h/tessera-wc-base` | Cookie-cut custom element base (`a` / `b` / `c`) |
| `@r-a-i-t-h/tessera-demo-pure` | Vite demo proving the model |

Sample sites live under `apps/demo-*` (pure / ineffable / millersark). Shared chrome helpers are in `@r-a-i-t-h/tessera-demo-kit`.

`ps/` keeps PurpleCMS migration scripts (to be rewritten for Tessera’s document shape).

## Content model

- **Layout** — tree of `region` | `zone` | `static` | `component`. **Only layouts declare zones** (and where they appear).
- **Page** — chooses `layoutId`, optional `includes` (shared items), and `zones` contributions.
- **Item** — reusable zone contributions (footer, promo, …), pulled in via `page.includes`.
- **Blocks** inside a zone: `text` | `json` | `media` | `component`.
- **Nav / media / site meta** — also in the flattened document.

**Rule:** if a layout does not declare zone `aside`, contributions to `aside` are not painted. They remain on the merge map so components can still read “data zones” (e.g. JSON for a list) via `ctx.zoneJson("events")`.

There is **no** recursive `parentId` template chain and **no** inventing zones from inside page HTML.

## Relative assets

Static sites must stay subdirectory-safe:

- Vite `base: "./"` (not `/`)
- Load data with `./data/site.json` (not `/data/...`)
- Media URLs in the document should be relative (`./media/...`), not root-absolute (`/media/...`) or required CDN URLs
- `normalizeSiteAssetUrl` rewrites accidental `/foo` media paths to `./foo` at render time

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

1. Load + validate `site.json` (Zod) with cache-busting query; persist to `localStorage`; fall back to cache on failure (see SPEC §3).
2. Resolve page from hash (unknown ids fall back to home — no error UI).
3. Merge `page.zones` then each included item’s zones (stable order).
4. Walk the layout tree; zone nodes render their blocks; unknown component names become HTML comments.
5. Optional `onAfterRender` / `onStatusChange` for chrome outside the document (demo sidebar, stale banner).
6. While open, re-fetch on a 5-minute TTL when `documentUrl` is set.

## CSS

Default skin is **W3.CSS 5.01** (`packages/skin-w3/css/w3.css`). Layout regions use semantic `role`s; the skin maps them to classes. Swap skins without changing `SiteDocument`.

## Demo

```bash
npm install
npm run dev
```

Open the app, switch between **Home** (aside visible) and **Simple layout** (same aside content hidden).
