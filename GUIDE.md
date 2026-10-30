# Authoring guide

How menus, styles, and YAML fit together. Willow is the worked example. The same notes are on the editor’s Guide page (`#/guide` in the editor; use `#/guide?section=…` to jump to a section).

Designers shipping a drop-in look should read [THEME-BUILDER.md](./THEME-BUILDER.md) (kit folders, manifest syntax, apply rules).

## On this page

- [YAML indentation](#yaml-indentation)
- [Menus](#menus)
- [Menu components](#menu-components)
- [Frame zones](#frame-zones)
- [Page links (wiki-style)](#page-links-wiki-style)
- [Articles](#articles)
- [Items](#items)
- [Datasets](#datasets)
- [Bindings](#bindings)
- [Stylesheets](#stylesheets)
- [What the Styles page changes](#what-the-styles-page-changes)
- [A standing side menu](#a-standing-side-menu)
- [A different frame for a section](#a-different-frame-for-a-section)
- [Maintenance](#maintenance)
- [Aspects](#aspects)
- [Runtime modules](#runtime-modules)
- [Panel tones](#panel-tones)

## YAML indentation

Indentation is the structure. A child sits further right than its parent, and every key at one level starts in the same column. Tabs are rejected. The editor writes two spaces per level. One space is legal, and four spaces are legal, when every sibling uses that same step. Mixing 2 and 4 in one block attaches a key to the wrong parent, or the file will not parse.

List items are the awkward case. The dash already occupies two columns, so the keys under a dash line up with the text after `- `:

```yaml
- id: events
  title: Events
  sidebar: true
  topbar: true
```

Save on the Page tab (Fields on other records) rewrites a file at two spaces. The Raw file tab keeps the spaces you typed. On a content page, title, type, parent, frame, tags, and id rename live on **Page**; **Compose** and **Frame** are for zone canvases only.

## Menus

Links live on the Nav record ([Navigation](#/navigation), file `records/nav.yaml`). Each row has three places: **Sidebar**, **Top bar**, and **Footer**. A place shows the row only when the master layout draws a menu component for that place.

Willow’s master layout ([Records → Layouts](#/records/layouts), then [`master`](#/layouts/master)) has two:

- `navFlat` with `scope: topbar` is the row of links under the logo.
- `navFlat` with `scope: sidebar` is the drawer. On a wide window the Menu button is hidden and the drawer stays closed. Narrow the window and Menu opens it.

A heading can fill itself. **Type** `meeting` lists every page whose type is `meeting`. The nav **Items** field (tag name) lists pages whose id matches a shared [item](#items) record carrying that tag — not the Records → Items list. Willow’s “This term” heading uses Type `meeting` and Sidebar only, which is why meetings appear in the drawer and stay off the top bar. Events have no such heading, so an event page stays out of both menus until you add one:

```yaml
- heading: What's on
  sidebar: true
  source:
    pageType: event
```

Leave Top bar unticked and those links stay in the sidebar component.

A **heading** row groups links. Heading text is optional: leave it blank to group without a visible title. The group still applies for every menu style below.

## Menu components

Put one of these in the master layout as a component. `scope` is `sidebar` (the default for `navFlat`), `topbar`, or `footer`.

| Name | What it draws |
|------|----------------|
| `navFlat` | **Top-level** — one column of links; optional group titles as large headings (`h4`). This is what Willow uses. |
| `navTree` | **Sub-level** — same groups; optional small group titles; child links in a nested list. |
| `navCollapse` | **Current group** — group titles are never shown. The first link under each heading is the section entry; when you are on that link or any sibling in the group, the rest appear in Sub-level list style. |
| `navTags` | Pages grouped by tag. Ignores the Nav record and article tags. Optional prop `tag` keeps one tag. |
| `breadcrumbs` | Home, then parent pages, then the current page. |
| `subpageList` | The current page’s children. Optional props `title` and `tone` (panel palette id, for use inside a toned panel). |
| `linkCluster` | A group of links in the page body. `source` is `children` (the default), `type` (also set `type` to a type id), or `nav` (also set `heading` to a Nav heading). `variant` is `list`, `pills`, or `cards`. |
| `pageNav` | Every page that has no type. Ignores the Nav record. |
| `searchBox` | Typeahead search in the frame. Put it on the master layout. The index loads only when someone focuses or types. Enter opens the [Search page](#/content/search) (`search/?q=…`, or `#search?q=…` on a snapshot). |
| `searchResults` | Full results on the [Search page](#/content/search): refine the query, filter by tag or type, sort by relevance or title. |

A blank site already places `searchBox` in the sidebar and ships a [Search page](#/content/search) on the [Nav record](#/navigation). Large wiki-style sites keep the menu sparse: a few entry pages plus Search; everything else is reached by cross-links and search.

## Frame zones

A master layout can declare content **zones** outside the page slot (for example a sidebar outlet). Those ids are not on the page layout, so they do not appear on **Compose**. Use the page’s **Frame** tab: **Add zone** offers every zone id declared on any frame layout, or type a custom id. Content is stored on the page under that name and paints only when some layout in the render walk declares the id. If the page inherits a different master, unused content stays on the page until a layout uses it again. Page title, type, parent, and rename stay on the **Page** tab.

## Page links (wiki-style)

Compose’s **link** control opens the page picker (all pages, not only the menu). That stores a durable id:

```html
<a data-tessera-page="hall" href="#">Great Hall</a>
```

You can also type `[[hall]]` or `[[hall|Great Hall]]` in Compose; saving expands those to the same anchors. Tessera resolves the real URL when the page is previewed or published. Renaming a page rewrites those ids in other pages’ prose and in binding panel links. A missing target paints as a red dotted link (`tessera-page-missing`). Preview diagnostics lists pages linked to and from the current page.

External URLs still use ordinary markdown/`href` links.

## Articles

Pages are ordinary pages. [Articles](#/articles) expands each blog in the sidebar so you can pick which stream’s articles to edit. A blog is one dated stream: path, frame, page size, hero, and lead. Blog records are managed under [Records → Blogs](#/records/blogs). Creating a blog also creates its index. Place each blog on the Nav record yourself. The menu can add the index when the blog asks for it. Articles are not menu items.

## Items

An **item** is reusable zone content with no URL of its own — typically shared HTML (a footer) or a **component** mount included on many pages. Records live under [Records → Items](#/records/items) (`records/items/<id>.yaml`). Open `#/items/<id>` to edit **tags** and each zone’s **HTML** or a named **component** plus props. HTML zones show **Image**, **Document**, and **Page** buttons above the textarea: pick a library asset or a site page (or external URL) and Tessera inserts the markup at the cursor. Structured tabular data belongs in a [dataset](#datasets) plus a binding, not in item zones.

**Includes** pull items into a page at render time. On a page, template, or layout, list item ids in **Includes** (comma-separated on the form). Tessera merges zones in order: the page’s own zones first, then the page’s includes, then the page layout’s includes, then the master frame’s includes when that layout differs. Each item id is merged once. Blocks in the same zone id are concatenated — page body, then shared footer.

Willow’s [`common-footer`](#/items/common-footer) fills the layout `footer` zone. Most pages and templates include it:

```yaml
includes:
  - common-footer
```

Put the footer on a **template** or **layout** when every page in that family should share it without repeating the list.

Tabular or structured data belongs in a [dataset](#datasets) plus a binding, not in item zones.

**Bindings** configure registered components (`{{id}}`). **Items** supply shared **HTML** or a **component** mount that merges into layout zones when included.

Maintenance **Unused items** lists item records nothing includes. Themes may ship kit items; apply copies the listed ids without touching your pages.

## Datasets

Structured tabular data (branch lists, product lines, reusable lookups) lives outside the page tree. **Records → Datasets** (`#/records/datasets`) lists every dataset. Create one, then open its setup to define the **schema**, **visible columns** for the editor grid, and an optional **display name** template such as `{make} {model} {year}` for record labels in pickers and list headings.

Each schema field has an id, label, and **kind**: **string**, **text** (multi-line), **number**, **boolean**, **date**, **enum** (fixed options), **asset** (library image or document; optional **many** for several ids), or **ref** (link to a row in another dataset). Fields are flat — there are no nested object or list columns. Use **text** for longer copy; it is stored and shown as plain text, not rendered as HTML on the site.

**Data** (`#/data`) appears in the sidebar once at least one dataset exists. Choose a dataset to add rows, edit in a dialog, filter columns, or switch to **Edit grid** for bulk changes. In view mode the grid shows asset thumbnails where an asset column is visible; use the record dialog to pick assets.

Visitors do not open dataset files directly. Put data on the site with a **Dataset list** binding ([Records → Bindings](#/records/bindings)): pick the dataset, then **Presentation** — **table**, **cards**, **plain list**, or **runtime module** (custom markup from a [runtime module](#runtime-modules) catalog entry). Set columns, default sort, limit, filters, and empty-state text in the wizard. Insert with **Compose → Insert** like any other binding (`{{id}}`).

On **publish**, Tessera embeds a snapshot of every dataset referenced by bindings, including datasets reached through **ref** fields.

## Bindings

A **binding** is a named configuration for a registry component. It lives once under [Records → Bindings](#/records/bindings) (`records/bindings/<id>.yaml`): the component name (for example `gallery`, `imageRevealGallery`) and its props. Pages do not store that configuration — they store a token **`{{id}}`** that Tessera expands when the page is rendered.

### Where bindings belong on a page

Edit the page (or template) in **Compose**, inside a layout **zone** such as `main`. Add an **Insert** section and choose the binding id. The insert is one block among Text, Image box, Side by side, and the rest. It is **not** the Layout editor **Component** tile (that attaches nav helpers to the layout tree shared by every page on that layout).

### Why use bindings

- **Portable** — Restructuring page Compose or retemplating does not discard a complex widget; the binding record stays under Records → Bindings until you delete it.
- **Reusable** — The same `{{hall-gallery}}` or `{{home-hero}}` on many pages; change the binding once and every insert updates.
- **Reviewable** — Bindings are first-class records with their own file, not buried in page HTML.

Use **Bindings + Insert** for any component Tessera offers through the binding wizard (below). Page **sections** store settings in that page’s zone HTML. That is fine for simple blocks; for invested micro-apps, prefer a binding so configuration is not lost when page content changes.

### Gallery: binding vs Compose section

| Approach | When to use |
|----------|-------------|
| **Gallery binding** | Primary — multiple folders, filename filter, slides, reuse across pages. |
| **Gallery Compose section** | Quick fix — one folder on **this page only**. Migrate to a binding when the gallery matters. |

Other binding kinds have **no** Compose section shortcut — configure them only as bindings.

### Binding kinds

- **Gallery** — Pictures from library folders, as a grid or slides.
- **Reveal banner** — Grid of image panels (Miller’s Ark–style homepage hero): set banner width, height, and panels per row (2–6); optional title size (1–2 em) and expanded gap (default 10px, the space left beside a grown panel); up to six panels with image, title, and link. Each panel shows its slice of full-size artwork; hover to grow on desktop; click or tap to reveal the full banner, then navigate. Insert only; no Compose palette section. Panel **image** is a site-relative library path (e.g. `./media/hero/img1.jpg`). Panel **link** is a **page id** (same id as Pages or Nav) or a full external URL (`https://…`, `mailto:…`); use **Choose page** in the binding editor. Do not use `./` or publish paths for panel links.
- **Dataset list** — Rows from a [dataset](#datasets): table, cards, or plain list; or the same data passed to a **runtime module** for a custom view. Sort, limit, column pick, and filters are binding props.
- **Embed** — Raw HTML from a ticket vendor, payment form, or similar (scripts and iframes kept on publish). Paste in the binding editor; insert with Compose → Insert. Not a layout Component.
- **Runtime module** — Client JavaScript from the catalog with binding props only (no dataset). See [Runtime modules](#runtime-modules).

Create these from [Records → Bindings](#/records/bindings) (wizard) or edit the YAML. Unsupported components are edited as the raw file.

### What is not a binding

Menus, breadcrumbs, and `linkCluster` belong on a **layout** (see [Menu components](#menu-components)). **Subpages** is a Compose section. Structured rows belong in a [dataset](#datasets), not in a zone.

## Stylesheets

A class on a layout region is an ordinary CSS class. These stylesheets supply them, and they do not stand in for each other.

- **[W3.CSS](#/styles?sheet=w3)** (`skin/w3.css`), linked by every shell. Examples: `w3-sidebar`, `w3-bar-block`, `w3-collapse`, `w3-hide-large`, `w3-row`, `w3-col`. `w3-collapse` on a `w3-sidebar` shows that sidebar from 993px up and hides it below that, where the Menu button opens it. `w3-hide-large` hides an element from 993px up.
- **[Tessera](#/styles?sheet=tessera)** (`skin/tessera.css`), linked by every shell. The default frame and shared widgets: `tessera-sidebar`, `tessera-bar`, `tessera-main`, `tessera-content`, `tessera-footer`, link clusters, video, pasted notes, and `tessera-imgbox`. Tokens changed on the [Styles](#/styles) page override `:root` in this file. Defaults stay here.
- **[Micro-apps](#/styles?sheet=microapps)** (`skin/microapps.css`). The gallery lives here.
- **[Site CSS](#/styles?sheet=site)** (`shell/site.css`). Theme / frame layout for this site. The starter theme keeps frame tweaks here. Theme apply may replace this file.
- **[Site local](#/styles?sheet=local)** (`shell/local.css`). Durable site-owned rules (panel tones, local tweaks). Theme apply does not overwrite it. Linked after `site.css`.

A shell that links a W3 theme, such as `skin/w3-theme-teal.css`, keeps [that theme file](#/styles?sheet=theme) between W3 and Tessera. The fonts link is a URL, not one of these files.

The [Styles](#/styles) page can open each of these files. Saving W3, Tessera, micro-apps, or the theme stores a copy for this site and leaves the shared file alone. Saving site layout writes `shell/site.css`; saving site local writes `shell/local.css`. The preview uses a save immediately. Publish updates the published copy.

## What the Styles page changes

[Styles](#/styles) saves `site.style`. A pages build writes tokens that differ from the Tessera defaults into a style element after the stylesheet links, and adds `leftnav` or `rightnav` on the body. That style element overrides those variables in [Tessera](#/styles?sheet=tessera). A token left at its default stays in the stylesheet, so editing it there shows in the preview. Editing a stylesheet does not change this form. The specimen on the [Styles](#/styles) page is the default frame, which is the frame a blank site starts with.

| Field | Effect on the default chrome |
|-------|-------------------------------|
| Sidebar width | Width of `tessera-sidebar`, and the gap `tessera-main` leaves for it. |
| Bar height | Height of the top bar, and how far the sidebar sits below it. |
| Content width | Maximum width of `tessera-content`. |
| Base font size | Body text size. |
| Font A–D | The four faces behind the A B C D buttons. Font A is the one visitors start on. |
| Fonts stylesheet | An https URL that loads those faces. A Google Fonts CSS link is the usual value. |
| Menu side | Left or right. Moves a `tessera-sidebar` standing column. |
| Bar, Bar text | Top bar and footer fill and type. |
| Sidebar, Sidebar text | Sidebar fill and type. The current link uses Accent for its fill and Bar text for its type. |
| Page background, Text | Page fill and body type. |
| Muted | Breadcrumb type, and the border of link cards. |
| Accent | Current sidebar link, and link pills. |
| Link | Links in the page body and in breadcrumbs. |
| Card frame | Framed Card and Image box fills and dataset Cards shells (unless a block or binding sets its own frame colour). Hex or `rgba`. Dataset table headers use **Sidebar** / **Sidebar text**. |

Lengths are values such as `300px` or `1.5rem`. Colours are hex, such as `#009688`, except **Card frame**, which also accepts `rgb`/`rgba`/`hsl`.

## A standing side menu

The drawer is already in the master layout, with id `mySidebar`. The bundled starter keeps it open on a wide window with `w3-collapse` on that region:

```yaml
className: w3-sidebar w3-bar-block w3-collapse tessera-sidebar
```

Margin rules for the main column live in [Tessera](#/styles?sheet=tessera) and [site layout](#/styles?sheet=site) for the starter theme.

Below 993px it stays a drawer opened by Menu. Keep the ids `mySidebar` and `myOverlay`. The runtime binds open and close to those two ids.

A new site from Initialise already has this column on the left. Its master uses `tessera-sidebar` and `w3-collapse`, its shell links [Tessera](#/styles?sheet=tessera), and the [site record](#/records/site) sets Menu side to left. The [Styles](#/styles) page can move the standing column. Below 993px the column hides. The Menu button sits on the right of the bar and opens a flyout from the right.

## A different frame for a section

The [site record](#/records/site) names the frame every page uses until a page names another. On that page, **Frame** is the layout. Leave it as **Inherit** on the children: they use the nearest parent that set one. A page further down can name its own, and that starts again. Naming the site's frame on a nested page steps that subtree back to the site frame.

The parent is the same parent that builds the URL. A winter fair whose parent is Events publishes at `/events/event-winter-fair` and wears the Events frame. A page that is not under Events keeps the site frame, even when it uses the same page layout. The home page does not inherit from a parent.

The page layout does not follow the frame. Style tokens stay on the site. Both frames' classes live in [site layout](#/styles?sheet=site). Each frame places its own menu components, and those components still read the one [Nav record](#/navigation).

## Maintenance

The editor’s **Maintenance** section (`#/maintenance`) lists site-health findings. Each row links to the record to fix. Sidebar items:

- **Orphan pages** — not home, not on the Nav record (after expansion), and not linked from another page via a wiki link. Articles under a reachable blog are omitted.
- **Unused assets** — library media nothing references.
- **Broken refs** — missing wiki targets, media, or gallery folders; the link opens the source record.
- **Unused items** — common items and layouts never referenced.
- **Unknown bindings** — mustache names with no binding, or components the registry does not know.
- **Unreachable nav** — designed nav rows whose page id is missing.
- **Rescan drift** — dangling media refs, plus assets sitting in the library’s `scanned` folder after a rescan.

These reports are separate from the per-page preview diagnostics panel.

## Aspects

A theme that offers more than one look lists those looks as aspects. On a page, **Aspect** picks one. Leave it as **Inherit** and the page uses the nearest parent that set one, or the site default. The home page does not inherit from a parent. Choosing an aspect only adds a class on the document root for that theme's CSS. It does not change the layout or the frame.

## Runtime modules

**Runtime modules** are small ES modules served from `./runtime-modules/` on the published site. Tessera stores the files under **Records → Runtime modules** (`#/records/runtimeModules`); it does not run module code on the server. The site runtime `import()`s each module and calls `export default function mount(root, ctx)`.

Upload or edit a module, then wire it through a binding: **Runtime module** (props only) or **Dataset list** with presentation **Runtime module**. Insert the binding in Compose, preview, and publish. Use `ctx.host` in the module for DOM helpers (`el`, `text`, `ui.card`, and the rest) — do not import Tessera internals in v1. Dataset bindings also set `ctx.dataset` with the embedded snapshot. Authoring detail lives in [docs/runtime-modules.md](./docs/runtime-modules.md).

## Panel tones

The [site record](#/records/site) lists extra tones for Compose **Panel** and **Quote** sections in **`panelTones`** on the Site form (same key in `records/site.yaml`). They appear in the Tone dropdown and style that block only; they are not aspects and do not change the page chrome. Put their CSS in [site local](#/styles?sheet=local) so a theme reinstall does not wipe it. Theme apply does not clear the catalog. Panel is a nested-block container (like Card): the tone styles the shell, and you drop other Compose sections inside it.

**Compose preview.** Built-in tones use W3 classes such as `w3-sand` on the panel shell; the editor loads W3.CSS, so those fills show while you edit. Custom tones paint your `className` on the same shell; rules live in [site local](#/styles?sheet=local). The editor loads that file in Compose as well, so shell background and colour on your tone class preview there too.

Keep typed divergence small. Put the callout **fill and default text colour on the panel shell** (your tone class on the `w3-panel` wrapper). Scope stronger typography to **direct children** of `.rt-panel-body` — standalone **Heading** blocks (`h1`–`h6` with `tessera-block`), **Text** widgets (`.tessera-text`), and optionally a title line inside Text — not cards, quotes, images, or blocks nested inside those. Example `panelTones` on the site record and matching CSS:

```yaml
id: demo-site
title: Demo site
homePageId: home
panelTones:
  - id: callout
    label: Callout
    className: tone-callout
```

```css
.tone-callout {
  background-color: #fff59d;
  color: #1a237e;
  padding: 0.5rem;
}

.tone-callout > .rt-panel-body > .tessera-text,
.tone-callout > .rt-panel-body > :is(h1, h2, h3, h4, h5, h6).tessera-block {
  font-family: "Source Sans 3", sans-serif;
  font-size: 1.15em;
  color: inherit;
}

.tone-callout > .rt-panel-body > .tessera-text :is(h1, h2, h3, h4, h5, h6) {
  font-family: inherit;
  color: inherit;
}

.tone-callout a,
.tone-callout a:visited {
  color: inherit;
  text-decoration: underline;
}
```

Headings and links need explicit rules when they would otherwise pick up site chrome: the font picker styles `body.fontA h1…h6`, and `.tessera-main a` sets link colour. The `> .rt-panel-body > …` chain limits typography to direct panel content; a **Card** or nested **Panel** inside the body keeps the normal site style.
