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

## Bindings

A binding is a named piece you can drop on any page. The choices live once, under Records → Bindings (`records/bindings/<id>.yaml`). Compose → Insert writes `{{id}}` into the page.

A Gallery section in Compose is a different thing. That paints one folder into that page only. A gallery binding can combine folders, keep filenames that match a pattern, and play as slides.

- **Gallery** shows pictures from library folders, as a grid or as slides.
- **Dated list** shows pages of a type that have a date field. Upcoming, past, or all. Precis is the line under the date. Willow’s upcoming events list is one of these.
- **People grid** shows pages of a type, using the photo and role fields.
- **Link group** shows a titled set of links: this page’s children, every page of a type, or one menu heading. Children follow the page the insert sits on.

A list stored as JSON, and any other component, is edited as the raw file. Menus, breadcrumbs, and the profile lines (`articleByline`, `profileKicker`, `profilePhoto`, `profileFacts`) belong on a layout. Subpages is a Compose section.

## Four stylesheets

A class on a layout region is an ordinary CSS class. Four stylesheets supply them, and they do not stand in for each other.

- **W3.CSS** (`skin/w3.css`), linked by every shell. Examples: `w3-sidebar`, `w3-bar-block`, `w3-collapse`, `w3-hide-large`, `w3-row`, `w3-col`. `w3-collapse` on a `w3-sidebar` shows that sidebar from 993px up and hides it below that, where the Menu button opens it. `w3-hide-large` hides an element from 993px up.
- **Tessera** (`skin/tessera.css`), linked by every shell. The default frame and shared widgets: `tessera-sidebar`, `tessera-bar`, `tessera-main`, `tessera-content`, `tessera-footer`, link clusters, video, pasted notes, and `tessera-imgbox`. The Styles page tokens override `:root` in this file.
- **Micro-apps** (`skin/microapps.css`). The gallery lives here.
- **Site CSS** (`shell/site.css`). This site’s layout. Willow’s look is here: `wh-header`, `wh-topnav`, `wh-drawer`, `wh-main`, and the colours under `--wh-`. `.wh-drawer` is `display: none` until Menu runs.

A shell that links a W3 theme, such as `skin/w3-theme-teal.css`, keeps that file between W3 and Tessera. Willow paints those colours in `site.css` instead. The fonts link is a URL, not one of these files.

The Styles page can open each of these files. Saving W3, Tessera, micro-apps, or the theme stores a copy for this site and leaves the shared file alone. Saving site layout writes `shell/site.css`. The preview uses a save immediately. Publish updates the published copy.

## What the Styles page changes

Styles saves `site.style`. A pages build writes those tokens into a style element after the stylesheet links, and adds `leftnav` or `rightnav` on the body. That style element overrides `:root` in `tessera.css`. Editing the same variables in a stylesheet does not change this form. Willow’s master layout uses `wh-` classes, so saving the tokens leaves the hall looking the same. The specimen on the Styles page is the default frame, which is the frame a blank site starts with.

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
