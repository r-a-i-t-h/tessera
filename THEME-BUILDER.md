# Theme builder guide

How to design and ship a **theme kit**: a drop-in look for a Tessera site that can be applied from the editor’s Backups page without wiping the author’s pages.

This guide is for people who build kits. Authors who only *apply* a theme can stick to the Backups page and [GUIDE.md](./GUIDE.md). The three kits that ship with the release (`tessera-w3-starter`, `tessera-w3-alt`, and `millers-ark`) are the worked examples here.

---

## What a theme kit is

A Tessera site is a directory of YAML records, a shell (`index.html`, CSS, images), and a published copy. Authors fill **content**. Designers decide how that content sits in the page — the chrome, the frame, the stylesheet, the default layouts.

A **theme kit** packages that design so another site can take it on. Applying a kit copies kit-owned files into the open site, merges a few keys into `site.yaml`, and leaves page bodies alone. The author’s `records/content/` and media library stay as they are. That is the contract that makes themes safe to switch.

Three operations look similar on the Backups page and must stay distinct in your head:

| Action | What it does to content |
|--------|-------------------------|
| **Apply theme** | Leaves pages and media alone. Replaces or merges kit-owned design files. |
| **Re-seed** | Replaces the site with the blank starter. Destructive to content. |
| **Restore Willow** | Loads the full example site. Destructive. |

If you ever find yourself wanting the kit to rewrite home pages or gallery folders, stop and use demo import (optional sample records) or tell the author to restore an archive. Themes do not own content.

---

## The three facets

On apply, Tessera keeps three facets separate:

1. **Content** — `records/content/`, templates, the media library. Never touched by theme apply (except optional demo paths you list explicitly).
2. **Design** — layouts, shell HTML/CSS/images, optional types and items, optional nav. Patched according to the manifest’s `patch` block.
3. **Site keys** — a controlled merge into `records/site.yaml` (frame ids, style tokens, aspects). Never a wholesale replace of the site record.

That split is why two W3 kits can share zone names such as `main` and `title`: after you switch kits, the same page YAML still paints into the new frame. Custom zone ids are fine, but anything the new layout does not declare sits under **Off layout** in the editor until a layout paints it again.

---

## Where kits live

Kits ship under the release seed:

```text
apps/editor-api/seed/themes/<kit-id>/
```

Each kit is one folder. The folder name **is** the kit id. The manifest’s `id` field must match that folder name exactly, or the kit is rejected.

The editor lists every valid kit folder when you open Backups. Invalid kits (missing manifest, bad id, broken aspects) are skipped silently in the list.

A kit is not a site package and does not contain component source. Components come from Tessera itself. The kit only ships site data and shell assets that the apply step can copy.

---

## Kit folder layout

A typical kit looks like this:

```text
seed/themes/my-theme/
  manifest.yaml          required
  panelTones.yaml        optional one-time seed (not part of the manifest)
  shell/
    index.html           required when patch.shell is replace
    site.css             required when patch.shell is replace
    local.css            optional first-time seed; never overwritten later
    local/               optional first-time seed (e.g. panel tone images)
    img/                 optional; replaces shell/img on the site when shell is replaced
  records/
    layouts/
      master.yaml
      standard.yaml
    items/
      common-footer.yaml
    types/               optional
    nav.yaml             only if patch.nav is replace
  demo/                  optional sample records
    content/
      demo-home.yaml
```

Paths inside the kit are relative and must not contain `..` or start with `/`. Demo paths are copied into `records/` on the site (so `demo/content/demo-home.yaml` becomes `records/content/demo-home.yaml`).

You do not need every folder. Skip what your `patch` block does not use. A minimal visual kit often ships only `manifest.yaml`, `shell/`, and the layouts it lists.

---

## Concepts before the YAML

### Frame and page layout

Tessera draws a page in two layers:

- The **frame** (master layout) is the outer chrome: header, sidebar, footer, menus. The site names it with `masterLayoutId`. A page can override the frame for itself and its descendants.
- The **page layout** (often `standard`) is the inner arrangement of zones: where `title` and `main` sit. Types can pick a layout; otherwise the site’s `defaultLayoutId` applies.

A theme usually ships both: a `master` frame that looks like the brand, and a `standard` page layout that declares the zones content authors fill in Compose.

### Zones

Only layouts declare zones. A page contributes HTML (or other blocks) keyed by zone id. If the resolved layout does not declare `aside`, contributions to `aside` are kept on the page but not painted. The editor shows those under **Off layout**.

For kits that authors will switch between, agree on zone ids. Guidance from the product spec:

| Tier | Ids | Role |
|------|-----|------|
| Core | `main` | Primary Compose body. Interchange kits should declare it on the default page layout. |
| Common | `title`, `hero`, `lead`, `primary`, `aside`, `footer` | Optional marketing splits. Declare only what you use. |
| Custom | any `kebab-case` id | Site-specific. Fine inside one kit; fragile when switching kits. |

Outlet id must equal the content zone key. There are no aliases. Articles use the page title field and Compose `main` only; a `title` zone on other types is separate.

The manifest’s `zonesDeclared` field documents this contract for humans and for the kit list API. It is **not** runtime validation — the layouts themselves are the source of truth when the site renders.

### Shell vs local CSS

Two stylesheets matter for theme ownership:

- **`shell/site.css`** — theme-owned frame and look. Replaced whenever `patch.shell` is `replace`. Put brand colours, frame layout, aspect artwork rules, and chrome here.
- **`shell/local.css`** — site-owned durable tweaks. Theme apply **never overwrites** an existing non-placeholder `local.css`. Linked after `site.css`. Put panel-tone rules and local customisations here so a theme reinstall does not wipe them.

On first apply (or when the site still has the empty placeholder comment), the kit may seed `local.css` and an optional `shell/local/` tree. After that, those files are the site’s.

`shell/img/` is replaced wholesale with the kit’s `shell/img/` when the shell is replaced. Keep theme artwork there. Keep site-owned panel images under `shell/local/` so they survive a later theme switch that only seeds `local/` once.

### Aspects

An **aspect** is an alternate look *within* the same theme — summer / Christmas / night in Miller’s Ark. It does not change layouts or the frame. Publish and preview put `aspect-{id}` on `<html>`, and the theme’s `site.css` styles those classes.

Aspects are listed in the **manifest**. On apply, the kit replaces the site’s aspect catalog. A kit that omits `aspects` **clears** the catalog. Page-level `aspectId` values are left alone on the content files; they simply stop matching until the author picks something from the new catalog (or you ship the same ids again).

### Panel tones

Panel tones are **not** aspects. They are site-owned entries (`id`, `label`, `className`) for Compose Panel and Quote sections. They style that block only.

Do **not** put `panelTones` in the manifest — the loader rejects the kit. Ship an optional top-level `panelTones.yaml` instead. Apply copies those tones into `site.yaml` only when the site has no tones yet. After that, theme apply leaves the catalog alone, including when you switch to a different kit.

---

## Manifest syntax

The manifest is YAML. Indentation follows the same rules as everywhere else in Tessera: spaces only, consistent step, list keys lined up under the text after `- `.

Here is a full annotated example, close to the shipped starter kit, with comments for this guide (YAML comments with `#` are fine in a real file too):

```yaml
# Must equal the folder name under seed/themes/
id: tessera-w3-starter

# Shown on the Backups page
name: Tessera W3 starter

# Integer. Bump when you change kit-owned files in a release-worthy way.
version: 1

# "w3" = built on the W3 / Tessera chrome stack.
# "custom" = freer frame (Miller's Ark). Informational for listing; both apply the same way.
stack: w3

# Written onto site.yaml when patch.site is merge-keys
masterLayoutId: master
defaultLayoutId: standard

# Optional alternate looks. Omit the whole list to clear aspects on apply.
# aspects:
#   - id: summer
#     label: Summer
# defaultAspectId: summer

patch:
  layouts: replace-listed
  layoutIds:
    - master
    - standard
  shell: replace
  site: merge-keys
  types: skip
  items: merge-listed
  itemIds:
    - common-footer
  nav: skip

# Documentation of zone ids per layout. Not enforced at apply time.
zonesDeclared:
  standard:
    - title
    - main
  master: []

# Extra keys merged into site.yaml when patch.site is merge-keys
site:
  style:
    navSide: left

demo:
  optional: true
  paths:
    - content/demo-home.yaml
```

Miller’s Ark adds aspects and marks itself `custom`:

```yaml
id: millers-ark
name: Miller's Ark
version: 1
stack: custom
masterLayoutId: master
defaultLayoutId: standard
aspects:
  - id: summer
    label: Summer
  - id: xmas
    label: Christmas
  - id: night
    label: Night
defaultAspectId: summer
patch:
  layouts: replace-listed
  layoutIds:
    - master
    - standard
  shell: replace
  site: merge-keys
  types: skip
  items: merge-listed
  itemIds:
    - common-footer
  nav: skip
zonesDeclared:
  standard:
    - title
    - main
  master:
    - footer
site:
  style:
    navSide: left
    footerStyle: floating
demo:
  optional: false
  paths: []
```

The rest of this section walks every field.

### `id` (required)

String. Must match the kit folder name. `seed/themes/millers-ark/` needs `id: millers-ark`. Use lowercase letters, digits, and hyphens in practice so paths and API URLs stay simple.

### `name` (required)

Human label on the Backups page (“Tessera W3 starter”, “Miller's Ark”).

### `version` (required)

Positive number. Tessera does not auto-migrate old applies from this field today; treat it as the kit author’s version stamp so you and operators can see what shipped.

### `stack` (required)

Either `w3` or `custom`.

- **`w3`** — kits that lean on W3.CSS, `tessera.css`, and the usual sidebar / bar classes (`tessera-w3-starter`, `tessera-w3-alt`).
- **`custom`** — kits that bring their own frame structure and class names (`millers-ark`).

Apply does not branch on this value. It is metadata for listing and for your own documentation. Prefer honesty: if the shell barely uses W3 chrome, say `custom`.

### `masterLayoutId` / `defaultLayoutId` (optional)

When `patch.site` is `merge-keys`, these are written onto `site.yaml` if present. They should name layout files you actually ship under `records/layouts/`. Typical pairing: `master` + `standard`.

### `aspects` / `defaultAspectId` (optional)

`aspects` is a list of `{ id, label }`:

- `id` must match `^[a-z][a-z0-9-]*$` (start with a letter; then letters, digits, hyphens).
- `label` is non-empty display text.
- Ids must be unique within the list.

`defaultAspectId`, if set, must be one of those ids. You cannot set a default without listing aspects.

Behaviour on apply:

- Non-empty `aspects` → replace `site.aspects` with that list.
- Absent or empty `aspects` → remove `site.aspects` from the site record.
- `defaultAspectId` set → write it; otherwise remove `site.defaultAspectId`.

In CSS, style the document root class the runtime adds:

```css
/* Base look (often the default aspect, no extra rules needed) */
body.nature2 { ... }

html.aspect-xmas body.nature2 { ... }
html.aspect-night #ma-top-band { ... }
```

Put those rules in `shell/site.css`, not `local.css`, so they travel with the theme.

### `patch` (required)

This is the heart of the manifest. Every key below is a mode that tells apply what to do with that facet. Missing behaviour is “do nothing for that facet,” but you should set each key explicitly so the kit is readable.

#### Layouts — `layouts` / `layoutIds`

| Value | Effect |
|-------|--------|
| `replace-listed` | Copy each `records/layouts/<id>.yaml` named in `layoutIds` onto the site. |
| `skip` | Leave all site layouts alone. |

If `layoutIds` includes `_order`, the kit’s `records/layouts/_order.yaml` is copied as well.

There is no “replace every layout in the folder” mode. List the ids you mean to own. That keeps an author’s extra frames (for example an Events frame) from being deleted when they only wanted a new default chrome.

#### Shell — `shell`

| Value | Effect |
|-------|--------|
| `replace` | Copy `shell/index.html` and `shell/site.css`. Replace `shell/img/` with the kit’s `shell/img/` if present. Seed `local.css` / `shell/local/` only when missing or still the placeholder. Ensure `index.html` links `./local.css` after `./site.css`. |
| `skip` | Leave the shell alone. |

Almost every visual kit uses `replace`. Use `skip` for fixtures that only merge site keys or aspects (see the aspect tests).

Remember: `site.css` is always overwritten on replace; `local.css` is not.

#### Site record — `site`

| Value | Effect |
|-------|--------|
| `merge-keys` | Merge allowed keys into `records/site.yaml` (see below). |
| `skip` | Do not touch `site.yaml` for layout ids / `site:` / aspects — except panel-tone seeding from `panelTones.yaml`, which still runs when applicable. |

When `merge-keys` is on, apply:

1. Sets `masterLayoutId` / `defaultLayoutId` from the manifest when those fields are present.
2. Merges each key under the manifest’s top-level `site:` object into the site record.
3. Deep-merges `site.style` (existing tokens kept unless the kit overrides a key).
4. Replaces or clears aspects as described above.
5. **Preserves** any existing `panelTones` on the site. The merge never writes tones from the manifest (and must not declare them there).

Do not put `panelTones` under `site:` in the manifest. Use `panelTones.yaml` for the one-time seed.

#### Types — `types` / `typeIds`

| Value | Effect |
|-------|--------|
| `replace-listed` | Copy each listed `records/types/<id>.yaml`. |
| `merge-listed` | Same file copy today (listed ids only). Prefer this name when you intend “add or refresh these type defs without claiming the whole types folder.” |
| `skip` | Leave types alone. |

Both listed modes currently copy whole files for the ids you name. They do not deep-merge fields inside a type file. If the site already had that type id, the kit file replaces it.

#### Items — `items` / `itemIds`

Same modes as types. Kits often ship `common-footer` with `merge-listed` so the master layout’s `includes` keep working after apply.

#### Nav — `nav`

| Value | Effect |
|-------|--------|
| `replace` | Copy `records/nav.yaml` from the kit over the site’s nav. |
| `skip` | Leave the author’s menus alone. |

Prefer `skip` for public kits. Nav is editorial. Replacing it surprises authors who already built a menu. If your kit needs sample links, put them in optional demo content or document that apply will replace nav.

### `zonesDeclared` (optional)

A map from layout id to the list of zone ids that layout paints:

```yaml
zonesDeclared:
  standard:
    - title
    - main
  master:
    - footer
```

Use `master: []` when the frame has no content zones (menus and static chrome only). Keep this in sync with the layout YAML you ship — it is how other builders and the kit list understand interchange. Tessera does not fail apply if the lists drift; broken interchange shows up as empty zones or **Off layout** content.

### `site` (optional object)

Sibling of `patch`, not inside it. Only used when `patch.site` is `merge-keys`.

Common keys:

```yaml
site:
  style:
    navSide: left
    footerStyle: floating   # example used by Miller's Ark
```

`style` is merged key-by-key into the existing `site.style`. Other keys under `site:` overwrite the same key on the site record. Skip anything the author should keep (title, home page id, publish settings, and so on). Theme kits should be narrow here.

### `demo` (optional)

```yaml
demo:
  optional: true
  paths:
    - content/demo-home.yaml
```

- **`paths`** — files under the kit’s `demo/` folder, relative to that folder. Each path is copied to `records/<path>` on the site when the author chooses **Apply with demo**.
- **`optional`** — advisory for the UI and docs. When `paths` is non-empty, the Backups page offers apply-with-demo and remove-demo. An empty `paths` list means no demo buttons.

**Remove demo** deletes only those paths from `records/`. It does not roll back layouts or CSS. Demo files should be additive sample pages, not replacements for `home.yaml`.

The starter kit’s demo page lives at `demo/content/demo-home.yaml` and becomes `records/content/demo-home.yaml` — a separate page id, so home stays untouched.

---

## What apply does, in order

When someone clicks Apply (implementation detail useful while debugging a kit):

1. Load and validate `manifest.yaml`.
2. Write a safety backup of the site.
3. If `shell: replace` — copy `index.html` and `site.css`, replace `shell/img/`, seed durable local shell files if needed.
4. If `panelTones.yaml` exists and the site has no tones — seed them into `site.yaml`.
5. Apply listed layouts / types / items according to `patch`.
6. Replace nav if asked.
7. Merge site keys and aspects if `site: merge-keys`.
8. Optionally import demo paths.

Any failure rolls back from the safety backup.

Content under `records/content/` is never in that list unless it appears under `demo.paths` and the author opted in.

---

## Building a kit: a practical path

### 1. Start from a shipped kit

Copy `tessera-w3-starter` if you want Tessera chrome and Styles-page tokens. Copy `millers-ark` if you want a bespoke frame and aspects. Rename the folder and set `id` / `name` to match.

### 2. Design the layouts first

Edit `records/layouts/master.yaml` and `standard.yaml` until the frame and zones feel right in a throwaway site. Confirm zone ids with `zonesDeclared`. Keep `main` if you care about switching with other W3 kits.

Put menu components on the master (`navFlat`, `navCollapse`, …) with the right `scope`. Remember: nav *data* stays on the site’s `nav.yaml` unless you set `nav: replace`.

### 3. Own the shell

- Link the shared skins you need (`w3.css`, optional `w3-theme-*.css`, `tessera.css`, `microapps.css`), then `./site.css`, then `./local.css`.
- Put the theme look in `site.css`.
- Put first-time panel-tone CSS in `local.css` and assets under `shell/local/` when needed.
- Keep Menu / overlay ids the runtime expects if you reuse W3 helpers (`mySidebar`, `myOverlay`, and the usual open/close calls).

### 4. Fill the manifest deliberately

Decide for each facet: replace listed files, merge site keys, or skip. Default instinct for a friendly kit:

- layouts: `replace-listed` for master + standard  
- shell: `replace`  
- site: `merge-keys` with frame ids and a small `style` nudge  
- types: `skip` unless you ship types the layouts need  
- items: `merge-listed` for `common-footer` if the master includes it  
- nav: `skip`  
- demo: optional sample page, never overwrite home  

### 5. Aspects (only if you need alternate looks)

List them in the manifest, pick a default, and write `html.aspect-*` rules in `site.css`. Test inherit on child pages: aspect follows the nearest ancestor, like the frame, and the home page does not inherit from a parent.

### 6. Panel tones (optional, once)

Add `panelTones.yaml` and matching rules in `local.css`. Apply once on a blank site and confirm a second apply (or a switch to another kit) leaves the tones and `local.css` edits alone.

### 7. Try apply on a real site

From a checkout:

```bash
npm run dev
```

Open the editor, Backups, and apply your kit to a starter site. Check:

- Page bodies still there  
- `main` (and other shared zones) still paint  
- `site.css` updated, `local.css` preserved after the first seed  
- Aspects appear on the page Aspect control when you shipped them  
- Apply with demo / remove demo only touch listed demo paths  
- A safety backup appeared for each apply  

There is also coverage in `apps/editor-api/tests/themes.test.ts` if you are changing kit behaviour in code.

---

## Interchange between kits

`tessera-w3-starter` and `tessera-w3-alt` both declare `title` and `main` on `standard`. Switching between them keeps home content painting. That is the bar for “interchangeable” W3 kits.

If your kit introduces a `hero` zone, authors who switch *away* will see hero HTML under **Off layout** until they delete it or you declare `hero` again. That is expected, not data loss.

Custom kits like Miller’s Ark may still keep `title` / `main` on the page layout so ordinary pages survive a switch, while the frame and CSS are entirely different.

---

## Pitfalls

- **Manifest `id` ≠ folder name** — kit will not load.
- **`panelTones` in the manifest** — rejected. Use `panelTones.yaml`.
- **Putting durable tweaks in `site.css`** — the next theme apply wipes them. Use `local.css`.
- **Replacing nav by accident** — authors lose their menu. Prefer `nav: skip`.
- **Demo that overwrites `home`** — breaks the “content stays” promise. Use a new page id under `demo/content/`.
- **Aspect ids that change between releases** — page `aspectId` values linger on content and stop matching. Prefer stable ids.
- **Omitting `aspects` on a kit that follows one with aspects** — clears the catalog on apply. Do that only when intentional.
- **Zone rename without migration** — content remains, but nothing paints until layouts catch up.
- **Forgetting `common-footer` while the master `includes` it** — footer goes empty. Ship the item or drop the include.
- **Unsafe paths** (`..`, absolute paths) in demo or copy steps — rejected.

---

## Quick field reference

| Field | Required | Role |
|-------|----------|------|
| `id` | yes | Kit id; must match folder name |
| `name` | yes | Label in the editor |
| `version` | yes | Kit version number |
| `stack` | yes | `w3` or `custom` |
| `masterLayoutId` | no | Written on site when merging |
| `defaultLayoutId` | no | Written on site when merging |
| `aspects` | no | Catalog of looks; absent clears on merge |
| `defaultAspectId` | no | Must be in `aspects` |
| `patch` | yes | Modes for layouts, shell, site, types, items, nav |
| `patch.layoutIds` / `typeIds` / `itemIds` | with listed modes | Which record files to copy |
| `zonesDeclared` | no | Documented zone contract per layout |
| `site` | no | Extra keys merged into `site.yaml` |
| `demo.optional` | no | Advisory |
| `demo.paths` | no | Demo files under kit `demo/` |

Companion files (not manifest keys): `panelTones.yaml`, `shell/*`, `records/**`, `demo/**`.

---

## Related reading

- [GUIDE.md](./GUIDE.md) — authoring: menus, styles, aspects, panel tones from the editor’s point of view  
- [SPEC.md](./SPEC.md) — theme overlay acceptance criteria and zone naming tiers  
- [ARCHITECTURE.md](./ARCHITECTURE.md) — frames, aspects, and `local.css` ownership in the engine  

Shipped kits to read beside this guide: `apps/editor-api/seed/themes/tessera-w3-starter/`, `tessera-w3-alt/`, and `millers-ark/`.
