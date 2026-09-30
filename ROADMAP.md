# Tessera roadmap

Sequenced upcoming work. Requirements and acceptance criteria live in [SPEC.md](./SPEC.md). As-built engine details live in [ARCHITECTURE.md](./ARCHITECTURE.md).

Update this file when priorities or status change; keep demo scoreboard copy aligned where it still claims DONE/TO DO.

## Done

| Item | Notes |
|------|--------|
| Dynamic menus (baseline) | Document `nav` → chrome; evolved into nav components below. |
| Content fetch + cache + TTL + schema abandon | Content-hashed `site.<hash>.json` named from the shell, `rev.json` poll, `localStorage`, stale signal, 5‑minute TTL, schema abandon. Demos show `renderStaleBanner`. Silent unknown-hash → home. |
| Site-data bindings + `{{id}}` | `document.bindings`; mustache + component-name insertion (Willow `upcoming-events`). |
| Nav: pages ≠ visibility; multi presentation | Designed nav + `source`; `navTags` / `navTree` / `navCollapse`; Willow’s master uses `navFlat`. Page existence does not imply a nav entry. |
| Section profiles | `document.sections` + `resolvePageProfile`; page override > section > site default. Willow’s people inherit `profile`; events inherit `article`. |
| Editor API (auth host) | `apps/editor-api`: Hono JSON API, file users, no signup, cookie/Bearer sessions, `requireEditor` all-or-nothing gate. |
| Editor SPA (login shell) | `apps/editor`: same-origin Vite SPA; login, session cookie, `POST /api/ping`. Hono serves `dist` when built. |
| File-based editor + flatten | YAML records in `sites/<name>/records/`; editor forms; save flattens to `publish/data/site.json` plus the hashed snapshot and `rev.json`. |
| Pages publisher | `publishPages` writes one HTML file per page in the tree, with static nav, micro-app mounts, and `sitemap.xml`. Willow stays a snapshot. |
| Page edit lifecycle (proof of concept) | Raw YAML save, append-only `history/content/<id>.history`, republish of `site.<hash>.json`. Authoring `schemaVersion` in `data/meta.json` via `deploy/post-update.sh` (node-vps-kit). |
| Layout sections in the editor | Compose tab: palette of heading, text, panel, quote, image box, card, side by side, and binding insert. Stored as the zone HTML the renderer already paints. Fields and Raw file stay; unsaved edits carry across tabs. Revert restores the saved file. |

## Upcoming (ordered)

1. **Gallery component** — *folder sources in Willow (`hall-gallery`)*  
   First-class `folders[]` + inline `image` blocks; `<tessera-gallery>` grid/slides + dialog. Flatten emits folder records (`npm run flatten:gallery`).  
   → [SPEC §8](./SPEC.md#8-shipped-capabilities-ambition), [acceptance](./SPEC.md#gallery-and-presentation)

2. **Items listing patterns**  
   First-class list-on-page / as-pages beyond ad-hoc site `ComponentFn`s, using document bindings.  
   → [SPEC §2](./SPEC.md#pages-and-items), [acceptance](./SPEC.md#inclusion-and-items)

3. **Fanciness / polish**  
   Motion and richer presentation beyond minimal W3 chrome — scope before large effort.  
   → [SPEC Needs refinement](./SPEC.md#12-needs-refinement)

4. **Editor preview**  
   Compose, Fields, and Raw file edit the same page. Next: host the renderer for preview inside the editor.  
   → [SPEC §9](./SPEC.md#9-editor-boundary-phase-2)

## Notes

- Cold-start offline (app shell from HTTP cache while already offline) is icing, not a roadmap gate — see SPEC Needs refinement.
- Hash routing stays for now; Navigation API is a refinement, not a scheduled feature until justified.
