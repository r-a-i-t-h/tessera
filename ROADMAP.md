# Tessera roadmap

Sequenced upcoming work. Requirements and acceptance criteria live in [SPEC.md](./SPEC.md). As-built engine details live in [ARCHITECTURE.md](./ARCHITECTURE.md).

Update this file when priorities or status change; keep demo scoreboard copy aligned where it still claims DONE/TO DO.

## Done

| Item | Notes |
|------|--------|
| Dynamic menus (baseline) | Document `nav` → chrome; evolved into nav components below. |
| Content fetch + cache + TTL + schema abandon | Cache-bust fetch, `localStorage`, stale signal, 5‑minute TTL, schema abandon. Demos show `renderStaleBanner`. Silent unknown-hash → home. |
| Site-data bindings + `{{id}}` | `document.bindings`; mustache + component-name insertion (demo-pure `farm-open-days`). |
| Nav: pages ≠ visibility; multi presentation | Designed nav + `source`; `navTags` / `navTree` / `navCollapse`; demo-pure sidebar uses collapse. Orphan page proves reachability ≠ nav. |

## Upcoming (ordered)

1. **Gallery component** — *spike in demo-pure*  
   Greenfield `<tessera-gallery>` (grid / slides + dialog) + folder flatten (`npm run flatten:gallery`). Assess before millersark bulk.  
   → [SPEC §8](./SPEC.md#8-shipped-capabilities-ambition), [acceptance](./SPEC.md#gallery-and-presentation)

2. **Shared layout web components**  
   imgbox, quote, side-by-side / chainable layout primitives via `WCBase`.  
   → [SPEC §7](./SPEC.md#7-layout-mobile-and-web-components)

3. **Items listing patterns**  
   First-class list-on-page / as-pages beyond ad-hoc site `ComponentFn`s, using document bindings.  
   → [SPEC §2](./SPEC.md#pages-and-items), [acceptance](./SPEC.md#inclusion-and-items)

4. **Fanciness / polish**  
   Motion and richer presentation beyond minimal W3 chrome — scope before large effort.  
   → [SPEC Needs refinement](./SPEC.md#12-needs-refinement)

5. **Editor app (later)**  
   Separate same-origin app; API-driven flatten to `SiteDocument`. Folder-scan gallery flatten is an early precursor.  
   → [SPEC §9](./SPEC.md#9-editor-boundary-phase-2)

## Notes

- Cold-start offline (app shell from HTTP cache while already offline) is icing, not a roadmap gate — see SPEC Needs refinement.
- Hash routing stays for now; Navigation API is a refinement, not a scheduled feature until justified.
