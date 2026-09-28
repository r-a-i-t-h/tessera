# Tessera roadmap

Sequenced upcoming work. Requirements and acceptance criteria live in [SPEC.md](./SPEC.md). As-built engine details live in [ARCHITECTURE.md](./ARCHITECTURE.md).

Update this file when priorities or status change; keep demo scoreboard copy aligned where it still claims DONE/TO DO.

## Done

| Item | Notes |
|------|--------|
| Dynamic menus (baseline) | Document `nav` → chrome; evolved into nav components below. |
| Content fetch + cache + TTL + schema abandon | Content-hashed `site.<hash>.json` named from the shell, `rev.json` poll, `localStorage`, stale signal, 5‑minute TTL, schema abandon. Demos show `renderStaleBanner`. Silent unknown-hash → home. |
| Site-data bindings + `{{id}}` | `document.bindings`; mustache + component-name insertion (pure site `farm-open-days`). |
| Nav: pages ≠ visibility; multi presentation | Designed nav + `source`; `navTags` / `navTree` / `navCollapse`; the pure shell sidebar uses collapse. Orphan page proves reachability ≠ nav. |
| Section profiles | `document.sections` + `resolvePageProfile`; page override > section > site default. Pure’s events inherit `simple` / `amber` (featured → `gold`). |
| Editor API (auth host) | `apps/editor-api`: Hono JSON API, file users, no signup, cookie/Bearer sessions, `requireEditor` all-or-nothing gate. |
| Editor SPA (login shell) | `apps/editor`: same-origin Vite SPA; login, session cookie, `POST /api/ping`. Hono serves `dist` when built. |
| File-based editor + flatten | YAML records in `sites/<name>/data/`; editor forms; save flattens to `publish/data/site.json` plus the hashed snapshot and `rev.json`. |
| Pages publisher | `publishPages` writes one HTML file per page in the tree, with static nav, micro-app mounts, and `sitemap.xml`. Demo sites stay snapshots. |
| Page edit lifecycle (proof of concept) | Raw YAML save, append-only `history/content/<id>.history`, republish of `site.<hash>.json`. Authoring `schemaVersion` in `data/meta.json` via `deploy/post-update.sh` (node-vps-kit). |

## Upcoming (ordered)

1. **Gallery component** — *folder sources in the pure site*  
   First-class `folders[]` + inline `image` blocks; `<tessera-gallery>` grid/slides + dialog. Flatten emits folder records (`npm run flatten:gallery`).  
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

5. **Editor preview / richer authoring**  
   File editor + flatten exist. Next: host the renderer for preview, and richer field widgets.  
   → [SPEC §9](./SPEC.md#9-editor-boundary-phase-2)

## Notes

- Cold-start offline (app shell from HTTP cache while already offline) is icing, not a roadmap gate — see SPEC Needs refinement.
- Hash routing stays for now; Navigation API is a refinement, not a scheduled feature until justified.
