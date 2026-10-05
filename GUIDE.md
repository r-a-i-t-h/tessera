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

## Menu components

Put one of these in the master layout as a component. `scope` is `sidebar` (the default for `navFlat`), `topbar`, or `footer`.

| Name | What it draws |
|------|----------------|
| `navFlat` | A flat list. Headings become small titles. This is what Willow uses. |
| `navTree` | A nested list. |
| `navCollapse` | Disclosure sections. |
| `navTags` | Pages grouped by tag. Ignores the Nav record. Optional prop `tag` keeps one tag. |
| `breadcrumbs` | Home, then parent pages, then the current page. |
| `subpageList` | The current page’s children. Optional prop `title`. |
| `linkCluster` | A group of links in the page body. `source` is `children` (the default), `type` (also set `type` to a type id), or `nav` (also set `heading` to a Nav heading). `variant` is `list`, `pills`, or `cards`. |
| `pageNav` | Every page that has no type. Ignores the Nav record. |

## Three different styles

A class on a layout region is an ordinary CSS class. Three stylesheets supply them, and they do not stand in for each other.

- **W3.CSS** (`skin/w3.css`), linked by every shell. Examples: `w3-sidebar`, `w3-bar-block`, `w3-collapse`, `w3-hide-large`, `w3-row`, `w3-col`. `w3-collapse` on a `w3-sidebar` shows that sidebar from 993px up and hides it below that, where the Menu button opens it. `w3-hide-large` hides an element from 993px up.
- **Site CSS** (`shell/site.css`). Willow’s look is here: `wh-header`, `wh-topnav`, `wh-drawer`, `wh-main`, and the colours under `--wh-`. `.wh-drawer` is `display: none` until Menu runs.
- **Default chrome** (`skin/chrome.css`). A blank site links this. Classes: `tessera-sidebar`, `tessera-bar`, `tessera-main`, `tessera-content`, `tessera-footer`. The Styles page writes tokens that this file reads.

## What the Styles page changes

Styles saves `site.style`. The preview turns those tokens into CSS variables and adds `leftnav` or `rightnav` on the body. Willow’s shell does not link `chrome.css`, and its master layout uses `wh-` classes, so saving Styles leaves the hall looking the same. The specimen on the Styles page is the default chrome, which is the frame a blank site starts with.

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
className: w3-sidebar w3-bar-block w3-collapse w3-animate-left wh-drawer
```

Then give the page a left margin in `shell/site.css`:

```css
@media (min-width: 993px) {
  .wh-drawer { width: 16rem; }
  .wh-main { margin-left: 16rem; }
}
```

Below 993px it stays a drawer opened by Menu. Keep the ids `mySidebar` and `myOverlay`. The runtime binds open and close to those two ids.

A blank site already has this column. Its master uses `tessera-sidebar` and `w3-collapse`, its shell links `chrome.css`, and Menu side on the Styles page chooses the edge.
