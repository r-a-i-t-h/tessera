# Tessera roadmap

Tracked from the ineffable demo’s self-documented RecTem scoreboard (DONE / TO DO on the Tessera page). That copy is **acceptance criteria**, not nostalgia — update this file when status changes, and keep the demo page aligned.

## Done (carry forward)

| Item | Tessera status |
|------|----------------|
| **Dynamic menus** | `document.nav` → sidebar chrome (`renderNavSidebar`); in-page headings menu; site components such as `pageNav`. |

## Not done / incomplete

### Content cache-busting + offline fallback

Old RecTem loaded content with a **timestamp query** so HTTP caches did not serve stale payloads, stored a successful fetch in **localStorage**, and on fetch failure **fell back** to that cache (including offline). Templates could surface an offline banner via `env.offline_mode` / `spa.using_cached_data`.

Today `SiteRenderer` only does a plain `fetch(documentUrl)` — no bust query, no persistence, no fallback, no offline signal.

**Target behaviour**

1. Fetch `site.json` with a cache-busting query (e.g. timestamp).
2. On success: validate, render, write to `localStorage`.
3. On failure: if a prior document exists in storage, use it and mark “using cached data”.
4. Optional: registry/layout hook so demos can show an offline / stale-content banner.

### Iterators

List rendering works today as **site components** that loop (`eventList`, `openDaysTable`, `randomCells`). That covers the old “map a list to HTML” pattern.

Still open (from the musings page and RecTem gaps):

- A clearer first-class story for iterating structured content (not only ad-hoc `ComponentFn`s).
- Iteration over items that **themselves contain zones** / deferred render of nested zone-bearing content (dependency and re-parse questions called out in demo copy).

### Gallery

Still on the old TO DO list. PurpleCMS gallery blobs convert to stub panels (`Gallery: path`). Need a real gallery component (and model/media story) so millersark and similar sites show image sets instead of placeholders.

### Fanciness

Placeholder goal from the demo scoreboard — polish, motion, and richer presentation beyond the minimal W3 chrome. Keep as an explicit open item until scoped.

## Notes

- Vite hashed bundles handle **code** cache-busting; that is separate from **content** cache-busting above.
- Editor / flatten pipeline remains out of scope for the renderer phase (see [ARCHITECTURE.md](./ARCHITECTURE.md)).
