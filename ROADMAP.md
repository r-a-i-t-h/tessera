# Tessera roadmap

Sequenced upcoming work. Requirements and acceptance criteria live in [SPEC.md](./SPEC.md). As-built engine details live in [ARCHITECTURE.md](./ARCHITECTURE.md).

When a capability moves, update the SPEC acceptance criteria in the same change.

## Where we are

An author can start from an empty directory, or from Willow, and reach a copyable static site without writing markup. The editor creates pages and a sidebar, composes a page from sections, starts a page from a template (locked or not), keeps images and PDFs in a library whose published URL does not change when the file moves, tunes chrome on a Styles page, previews the snapshot, and writes `publish/` only when asked. Willow is the specimen. Its pages start from locked templates. Pure, Ineffable, and Miller’s Ark are no longer example archives.

That is a small-site CMS for prose pages, media, and a designed menu. It is one site per process, one role for every signed-in user, and one published tree for the whole site. A type of thing that is listed and then opened as its own page (people, events, news) is a site-defined type plus a binding that names that type. Compose does not show the rendered page: **Render site** writes `preview/`, and the author reloads the site runtime. The authoring loop is in the tree. A full pass through Willow, and a site built from empty, has not been recorded yet.

## Done

| Item | Notes |
|------|--------|
| Dynamic menus (baseline) | Document `nav` → chrome; evolved into nav components below. |
| Content fetch + cache + TTL + schema abandon | Content-hashed `site.<hash>.json` named from the shell, `rev.json` poll, `localStorage`, stale signal, 5‑minute TTL, schema abandon. The site runtime shows `renderStaleBanner`. Silent unknown-hash → home. |
| Site-data bindings + `{{id}}` | `document.bindings`; mustache + component-name insertion (Willow `upcoming-events`). |
| Nav: pages ≠ visibility; multi presentation | Designed nav + `source`; `navTags` / `navTree` / `navCollapse`; Willow’s master uses `navFlat`. Page existence does not imply a nav entry. |
| Types | `document.types` + `resolvePageProfile`. A site-defined type supplies the layout and the field list. Listings select types, not kind-tags. |
| Editor API (auth host) | `apps/editor-api`: Hono JSON API, file users, no signup, cookie/Bearer sessions, `requireEditor` all-or-nothing gate. |
| Editor SPA (login shell) | `apps/editor`: same-origin Vite SPA; login, session cookie, record editing. Hono serves `dist` when built. |
| File-based editor | YAML records in `$TESSERA_DATA/records/`. A save refreshes `preview/data/`. **Publish** writes `publish/` and leaves that folder alone until the next publish. |
| Pages publisher | `publishPages` writes one HTML file per page in the tree, with static nav, micro-app mounts, and `sitemap.xml`. `delivery` defaults to `pages`. The preview is always the snapshot and ignores `delivery`. |
| Page history (proof of concept) | Append-only `history/content/<id>.history`. History is an editor file, not a field on the published page. Saving does not write `publish/`. |
| Blank site | When `site.yaml` is absent, the editor writes a shell, a left sidebar master, a standard type and layout, a Hello world home page, a common-footer item, and a first sidebar link. Backups can re-seed an existing site to that starter and keeps editors. `delivery` is `pages`. |
| Styles | `site.style` tokens for dimensions, colours, fonts, and nav side. The Styles page edits them. |
| Compose | Palette: heading, text, panel, quote, image box, card, side by side, binding insert, subpages, YouTube, gallery, pasted note. Stored as zone HTML via `@r-a-i-t-h/tessera-sections`. Fields and Raw file stay; unsaved edits carry across tabs. A block that does not parse back stays raw HTML. |
| Page templates | `records/templates/<id>.yaml`, left out of the published document. A new page copies tags, includes, and every zone except the title. `isLocked` sets `locked` on that page so the arrangement stays fixed while words and pictures stay editable. Flatten omits `locked` and `templateId`. |
| Media library | Images and PDFs in `files/` plus virtual folders. The published URL is `./media/<id>.<ext>`. A move changes `folderId` only. |
| Gallery | `<tessera-gallery>` grid or slides, plus a dialog. A Compose gallery section names a library folder. Flatten lists that folder’s images. |

## Upcoming (ordered)

1. **Editor preview**  
   Compose, Fields, and Raw file edit the same page. The rendered page is another origin (the site runtime, port 5173 in dev). Next: host the renderer beside the canvas so a section change is visible without a separate reload.  
   → [SPEC §9](./SPEC.md#9-editor-boundary-phase-2)

2. **Items listing patterns**  
   First-class list-on-page / as-pages beyond ad-hoc bindings. Subpages already lists child pages. People, events, and news are a type plus a binding.  
   → [SPEC §2](./SPEC.md#pages-and-items), [acceptance](./SPEC.md#inclusion-and-items)

3. **Editor chrome**  
   The authoring model is ahead of the screens an author lives in. The next input is a snagging pass: Willow first, then a site started empty. Schedule UI work from that list.  
   → [SPEC §9](./SPEC.md#9-editor-boundary-phase-2)

4. **Fanciness / polish**  
   Motion and richer presentation beyond minimal W3 chrome — scope before large effort.  
   → [SPEC Needs refinement](./SPEC.md#12-needs-refinement)

## Notes

- Compose stores zone HTML on purpose, so Fields, Raw file, and the renderer stay on one page. Hardening that round-trip belongs with the snagging pass, not as a second content model.
- Access stays all-or-nothing until an ACL replaces `requireEditor`. History stays the append-only proof of concept until an authoring spec replaces it. There is no per-page draft flag: preview is the working copy, and Publish writes the dist.
- Cold-start offline (app shell from HTTP cache while already offline) is icing, not a roadmap gate — see SPEC Needs refinement.
- Hash routing stays for the snapshot flavour; Navigation API is a refinement, not a scheduled feature until justified.
