# Authoring guide

How menus, styles, and YAML fit together. Willow is the worked example. The same notes are on the editor’s Guide page.

## YAML indentation

Indentation is the structure. A child sits further right than its parent, and every key at one level starts in the same column. Tabs are rejected. The editor writes two spaces per level. One space is legal, and four spaces are legal, when every sibling uses that same step. Mixing 2 and 4 in one block attaches a key to the wrong parent, or the file will not parse.

List items are the awkward case. The dash already occupies two columns, so the keys under a dash line up with the text after `- `:

```yaml
- id: events
  title: Events
  sidebar: true
  topbar: true
```

Save on the Fields tab rewrites a file at two spaces. The Raw file tab keeps the spaces you typed.

## Menus

Links live on the Nav record (Records → Nav, file `records/nav.yaml`). Each row has three places: **Sidebar**, **Top bar**, and **Footer**. A place shows the row only when the master layout draws a menu component for that place.

Willow’s master layout (Records → Layouts, then `master`) has two:

- `navFlat` with `scope: topbar` is the row of links under the logo.
- `navFlat` with `scope: sidebar` is the drawer. On a wide window the Menu button is hidden and the drawer stays closed. Narrow the window and Menu opens it.

**Show in nav** on a page stores a flag. Clearing it writes `showInNav: false`. The menu components do not read that flag, so ticking it does not add a link. Add the page on the Nav record, or add a heading that pulls a whole type.

A heading can fill itself. **Type** `meeting` lists every page whose type is `meeting`. **Items** lists pages whose id matches an item carrying that tag. Willow’s “This term” heading uses Type `meeting` and Sidebar only, which is why meetings appear in the drawer and stay off the top bar. Events have no such heading, so an event page stays out of both menus until you add one:

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
| `subpageList` | The current page’s children. Optional prop `title`. |
| `linkCluster` | A group of links in the page body. `source` is `children` (the default), `type` (also set `type` to a type id), or `nav` (also set `heading` to a Nav heading). `variant` is `list`, `pills`, or `cards`. |
| `pageNav` | Every page that has no type. Ignores the Nav record. |

## Articles

Pages are ordinary pages. Articles opens on the blog list, then that blog’s articles. A blog is one dated stream: path, frame, page size, hero, and lead. Blogs are edited under Records → Blogs. Creating a blog also creates its index. Place each blog on the Nav record yourself. The menu can add the index when the blog asks for it. Articles are not menu items.

## Bindings

A **binding** is a named configuration for a registry component. It lives once under Records → Bindings (`records/bindings/<id>.yaml`): the component name (for example `gallery`, `imageRevealGallery`) and its props. Pages do not store that configuration — they store a token **`{{id}}`** that Tessera expands when the page is rendered.

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
| **Gallery binding** | Primary — multiple folders, filename filter, slides, reuse across pages (Willow’s hall gallery). |
| **Gallery Compose section** | Quick fix — one folder on **this page only**. Migrate to a binding when the gallery matters. |

Other binding kinds have **no** Compose section shortcut — configure them only as bindings.

### Binding kinds

- **Gallery** — Pictures from library folders, as a grid or slides.
- **Dated list** — Pages of a type with a date field. Upcoming, past, or all. Willow’s upcoming events list is one of these.
- **People grid** — Pages of a type, using photo and role fields.
- **Link group** — Titled links: this page’s children, every page of a type, or one menu heading.
- **Reveal banner** — Grid of image panels (Miller’s Ark–style homepage hero): set banner width, height, and panels per row (2–6); optional title size (1–2 em) and expanded gap (default 10px, the space left beside a grown panel); up to six panels with image, title, and link. Each panel shows its slice of full-size artwork; hover to grow on desktop; click or tap to reveal the full banner, then navigate. Insert only; no Compose palette section. Panel **image** is a site-relative library path (e.g. `./media/hero/img1.jpg`). Panel **link** is a **page id** (same id as Pages or Nav) or a full external URL (`https://…`, `mailto:…`); use **Choose page** in the binding editor. Do not use `./` or publish paths for panel links.

Create these from Records → Bindings (wizard) or edit the YAML. Unsupported components are edited as the raw file.

### What is not a binding

Menus, breadcrumbs, and profile lines (`articleByline`, `profileKicker`, `profilePhoto`, `profileFacts`) belong on a **layout**. **Subpages** is a Compose section. A list stored as JSON in a zone is page content, not a binding.

## Four stylesheets

A class on a layout region is an ordinary CSS class. Four stylesheets supply them, and they do not stand in for each other.

- **W3.CSS** (`skin/w3.css`), linked by every shell. Examples: `w3-sidebar`, `w3-bar-block`, `w3-collapse`, `w3-hide-large`, `w3-row`, `w3-col`. `w3-collapse` on a `w3-sidebar` shows that sidebar from 993px up and hides it below that, where the Menu button opens it. `w3-hide-large` hides an element from 993px up.
- **Tessera** (`skin/tessera.css`), linked by every shell. The default frame and shared widgets: `tessera-sidebar`, `tessera-bar`, `tessera-main`, `tessera-content`, `tessera-footer`, link clusters, video, pasted notes, and `tessera-imgbox`. Tokens changed on the Styles page override `:root` in this file. Defaults stay here.
- **Micro-apps** (`skin/microapps.css`). The gallery lives here.
- **Site CSS** (`shell/site.css`). This site’s layout. Willow’s look is here: `wh-header`, `wh-topnav`, `wh-drawer`, `wh-main`, and the colours under `--wh-`. `.wh-drawer` is `display: none` until Menu runs.

A shell that links a W3 theme, such as `skin/w3-theme-teal.css`, keeps that file between W3 and Tessera. Willow paints those colours in `site.css` instead. The fonts link is a URL, not one of these files.

The Styles page can open each of these files. Saving W3, Tessera, micro-apps, or the theme stores a copy for this site and leaves the shared file alone. Saving site layout writes `shell/site.css`. The preview uses a save immediately. Publish updates the published copy.

## What the Styles page changes

Styles saves `site.style`. A pages build writes tokens that differ from the Tessera defaults into a style element after the stylesheet links, and adds `leftnav` or `rightnav` on the body. That style element overrides those variables in `tessera.css`. A token left at its default stays in the stylesheet, so editing it there shows in the preview. Editing a stylesheet does not change this form. Willow’s master layout uses `wh-` classes, so saving the tokens leaves the hall looking the same. The specimen on the Styles page is the default frame, which is the frame a blank site starts with.

| Field | Effect on the default chrome |
|-------|-------------------------------|
| Sidebar width | Width of `tessera-sidebar`, and the gap `tessera-main` leaves for it. |
| Bar height | Height of the top bar, and how far the sidebar sits below it. |
| Content width | Maximum width of `tessera-content`. |
| Base font size | Body text size. |
| Font A–D | The four faces behind the A B C D buttons. Font A is the one visitors start on. |
| Fonts stylesheet | An https URL that loads those faces. A Google Fonts CSS link is the usual value. |
| Menu side | Left or right. Moves a `tessera-sidebar`. Willow’s drawer is a separate element and stays on the left. |
| Bar, Bar text | Top bar and footer fill and type. |
| Sidebar, Sidebar text | Sidebar fill and type. The current link uses Accent for its fill and Bar text for its type. |
| Page background, Text | Page fill and body type. |
| Muted | Breadcrumb type, and the border of link cards. |
| Accent | Current sidebar link, and link pills. |
| Link | Links in the page body and in breadcrumbs. |

Lengths are values such as `300px` or `1.5rem`. Colours are hex, such as `#009688`.

## A standing side menu on Willow

The drawer is already in the master layout, with id `mySidebar`. To keep it open on a wide window, add `w3-collapse` to that region’s classes:

```yaml
className: w3-sidebar w3-bar-block w3-collapse wh-drawer
```

Then give the page a left margin in `shell/site.css`:

```css
@media (min-width: 993px) {
  .wh-drawer { width: 16rem; }
  .wh-main { margin-left: 16rem; }
}
```

Below 993px it stays a drawer opened by Menu, and that flyout may slide in. Leave `w3-animate-left` off the standing column: from 993px up the column is already on the page, and a slide on every new page is only noise. Keep the ids `mySidebar` and `myOverlay`. The runtime binds open and close to those two ids.

A starter site already has this column, on the left. Its master uses `tessera-sidebar` and `w3-collapse`, its shell links `tessera.css`, and the site record sets Menu side to left. The Styles page can move the standing column. Below 993px the column hides. The Menu button sits on the right of the bar and opens a flyout from the right, so the site title stays put and the left of the page stays in view. The flyout position is in `shell/site.css`.

## A different frame for a section

The site record names the frame every page uses until a page names another. On that page, **Frame** is the layout. Leave it as **Inherit** on the children: they use the nearest parent that set one. A page further down can name its own, and that starts again. Naming the site's frame on a nested page steps that subtree back to the site frame.

The parent is the same parent that builds the URL. A winter fair whose parent is Events publishes at `/events/event-winter-fair` and wears the Events frame. A page that is not under Events keeps the site frame, even when it uses the same page layout. The home page does not inherit from a parent.

The page layout does not follow the frame. Style tokens stay on the site. Both frames' classes live in `shell/site.css`. Each frame places its own menu components, and those components still read the one Nav record.
