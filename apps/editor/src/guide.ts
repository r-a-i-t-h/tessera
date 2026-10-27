import { guideSectionHref, stylesSheetHref } from "./router.js";

/** Authoring notes shown at #/guide. Keep this aligned with GUIDE.md. */
export function guideHtml(): string {
  const toc = (label: string, id: string) =>
    `<li><a href="${guideSectionHref(id)}">${label}</a></li>`;
  const stylesPage = `<a href="#/styles">Styles</a>`;
  const sheetLink = (id: string, label: string) =>
    `<a href="${stylesSheetHref(id)}">${label}</a>`;

  return `<article class="editor-guide">
    <h1 class="w3-large">Guide</h1>
    <p>How menus, styles, and YAML fit together. Willow is the worked example.</p>

    <nav class="editor-guide-toc" aria-label="On this page">
      <p class="w3-medium"><strong>On this page</strong></p>
      <ul>
        ${toc("YAML indentation", "yaml-indentation")}
        ${toc("Menus", "menus")}
        ${toc("Menu components", "menu-components")}
        ${toc("Frame zones", "frame-zones")}
        ${toc("Page links (wiki-style)", "page-links-wiki-style")}
        ${toc("Articles", "articles")}
        ${toc("Items", "items")}
        ${toc("Datasets", "datasets")}
        ${toc("Bindings", "bindings")}
        ${toc("Stylesheets", "stylesheets")}
        ${toc("What the Styles page changes", "what-the-styles-page-changes")}
        ${toc("A standing side menu on Willow", "a-standing-side-menu-on-willow")}
        ${toc("A different frame for a section", "a-different-frame-for-a-section")}
        ${toc("Maintenance", "maintenance")}
        ${toc("Aspects", "aspects")}
        ${toc("Runtime modules", "runtime-modules")}
        ${toc("Panel tones", "panel-tones")}
      </ul>
    </nav>

    <h2 id="yaml-indentation">YAML indentation</h2>
    <p>Indentation is the structure. A child sits further right than its parent, and every key at one level starts in the same column. Tabs are rejected. The editor writes two spaces per level. One space is legal, and four spaces are legal, when every sibling uses that same step. Mixing 2 and 4 in one block attaches a key to the wrong parent, or the file will not parse.</p>
    <p>List items are the awkward case. The dash already occupies two columns, so the keys under a dash line up with the text after <code>- </code>:</p>
    <pre>- id: events
  title: Events
  sidebar: true
  topbar: true</pre>
    <p>Save on the <strong>Page</strong> tab (labelled Fields on other records) rewrites a file at two spaces. The Raw file tab keeps the spaces you typed. On a content page, title, type, parent, frame, tags, and id rename live on Page; Compose and Frame are zone canvases only.</p>

    <h2 id="menus">Menus</h2>
    <p>Links live on the Nav record (<a href="#/navigation">Navigation</a>, file <code>records/nav.yaml</code>). Each row has three places: <strong>Sidebar</strong>, <strong>Top bar</strong>, and <strong>Footer</strong>. A place shows the row only when the master layout draws a menu component for that place.</p>
    <p>Willow’s master layout (<a href="#/records/layouts">Records → Layouts</a>, then <a href="#/layouts/master"><code>master</code></a>) has two:</p>
    <ul>
      <li><code>navFlat</code> with <code>scope: topbar</code> is the row of links under the logo.</li>
      <li><code>navFlat</code> with <code>scope: sidebar</code> is the drawer. On a wide window the Menu button is hidden and the drawer stays closed. Narrow the window and Menu opens it.</li>
    </ul>
    <p>A heading can fill itself. <strong>Type</strong> <code>meeting</code> lists every page whose type is <code>meeting</code>. The nav <strong>Items</strong> field (tag name) lists pages whose id matches a shared <a href="${guideSectionHref("items")}">item</a> record carrying that tag — not the Records → Items list. Willow’s “This term” heading uses Type <code>meeting</code> and Sidebar only, which is why meetings appear in the drawer and stay off the top bar. Events have no such heading, so an event page stays out of both menus until you add one:</p>
    <pre>- heading: What's on
  sidebar: true
  source:
    pageType: event</pre>
    <p>Leave Top bar unticked and those links stay in the sidebar component.</p>
    <p>A <strong>heading</strong> row groups links. Heading text is optional: leave it blank to group without a visible title.</p>

    <h2 id="menu-components">Menu components</h2>
    <p>Put one of these in the master layout as a component. <code>scope</code> is <code>sidebar</code> (the default for <code>navFlat</code>), <code>topbar</code>, or <code>footer</code>.</p>
    <ul>
      <li><code>navFlat</code> — <strong>Top-level</strong>: one column of links; optional group titles as large headings. This is what Willow uses.</li>
      <li><code>navTree</code> — <strong>Sub-level</strong>: optional small group titles; child links in a nested list.</li>
      <li><code>navCollapse</code> — <strong>Current group</strong>: no group titles; first link under each heading is the section entry; siblings show in Sub-level style when the current page is in that group.</li>
      <li><code>navTags</code> groups pages by their tags. It ignores the Nav record and article tags. Optional prop <code>tag</code> keeps one tag.</li>
      <li><code>breadcrumbs</code> prints Home, then parent pages, then the current page.</li>
      <li><code>subpageList</code> prints the current page’s children. Optional prop <code>title</code>.</li>
      <li><code>linkCluster</code> prints a group of links in the page body. <code>source</code> is <code>children</code> (the default), <code>type</code> (also set <code>type</code> to a type id), or <code>nav</code> (also set <code>heading</code> to a Nav heading). <code>variant</code> is <code>list</code>, <code>pills</code>, or <code>cards</code>.</li>
    <li><code>pageNav</code> lists every page that has no type. It ignores the Nav record.</li>
      <li><code>searchBox</code> is typeahead search for the frame. Place it on the master layout. The index loads only on first use. Enter opens the <a href="#/content/search">Search page</a>.</li>
      <li><code>searchResults</code> is the full results UI on the <a href="#/content/search">Search page</a> (refine, tag/type filter, relevance or title sort).</li>
  </ul>
    <p>A blank site already puts <code>searchBox</code> in the sidebar and a <a href="#/content/search">Search page</a> on the <a href="#/navigation">Nav record</a>. Keep the menu sparse for wiki-style sites; reach other pages by cross-links and search.</p>

    <h2 id="frame-zones">Frame zones</h2>
    <p>A master layout can declare content <strong>zones</strong> outside the page slot (for example a sidebar outlet). Those ids are not on the page layout, so they do not appear on <strong>Compose</strong>. Use the page’s <strong>Frame</strong> tab: <strong>Add zone</strong> lists every zone id from any frame layout, or type a custom id. Content is stored on the page under that name and paints only when a layout declares the id. If the page inherits a different master, unused content stays until a layout uses it again.</p>

    <h2 id="page-links-wiki-style">Page links (wiki-style)</h2>
    <p>Compose’s <strong>link</strong> control opens the page picker for every page. That stores <code>&lt;a data-tessera-page=&quot;hall&quot; href=&quot;#&quot;&gt;…&lt;/a&gt;</code>. You can also type <code>[[hall]]</code> or <code>[[hall|label]]</code>; saving expands those the same way. Preview and publish resolve the URL. Renaming a page rewrites those ids in prose and binding links. Missing targets use the class <code>tessera-page-missing</code>. Preview diagnostics lists pages linked to and from the current page.</p>

    <h2 id="articles">Articles</h2>
    <p><a href="#/pages">Pages</a> are ordinary pages. <a href="#/articles">Articles</a> expands each blog in the sidebar so you can pick which stream’s articles to edit. A blog is one dated stream: path, frame, page size, hero, and lead. Hero is full, banner, or side. Blog records are managed under <a href="#/records/blogs">Records → Blogs</a>. Creating a blog also creates its index. Place each blog on the Nav record yourself. The menu can add the index when the blog asks for it. Articles are not menu items.</p>

    <h2 id="items">Items</h2>
    <p>An <strong>item</strong> is reusable zone content with no URL of its own — a shared footer, JSON for a layout component, or a component mount reused on many pages. Records live under <a href="#/records/items">Records → Items</a> (<code>records/items/&lt;id&gt;.yaml</code>). Open <code>#/items/&lt;id&gt;</code> to edit <strong>tags</strong> and each zone’s <strong>HTML</strong>, <strong>JSON</strong>, <strong>blocks</strong> (a JSON array), or a named <strong>component</strong> plus props.</p>
    <p><strong>Includes</strong> pull items into a page at render time. On a page, template, or layout, list item ids in <strong>Includes</strong>. Tessera merges zones in order: the page’s zones first, then the page’s includes, then the page layout’s includes, then the master frame’s includes when that layout differs. Each item id is merged once. Blocks in the same zone id are concatenated.</p>
    <p>Willow’s <a href="#/items/common-footer"><code>common-footer</code></a> fills the layout <code>footer</code> zone. Most pages and templates include it:</p>
    <pre>includes:
  - common-footer</pre>
    <p>Put the footer on a <strong>template</strong> or <strong>layout</strong> when every page in that family should share it without repeating the list.</p>
    <p>A zone an item fills but the current layout does not declare stays off the painted page, yet its data remains on the merged zone map. A layout <strong>component</strong> can still read it (JSON in an <code>events</code> zone with <code>fromZone</code> on the component). Tabular catalogues with many rows are usually a <a href="${guideSectionHref("datasets")}">dataset</a> plus a binding instead.</p>
    <p><strong>Bindings</strong> configure registered components (<code>{{id}}</code>). <strong>Items</strong> supply zone payloads those components or plain zone HTML can read. A binding may set <code>itemId</code> and <code>fromZone</code> in YAML to take JSON from an item zone.</p>
    <p>Maintenance <strong>Unused items</strong> lists item records nothing includes. Themes may ship kit items.</p>

    <h2 id="datasets">Datasets</h2>
    <p>Structured tabular data (branch lists, product lines, reusable lookups) lives outside the page tree. <a href="#/records/datasets">Records → Datasets</a> lists every dataset. Create one, then open its setup to define the <strong>schema</strong>, <strong>visible columns</strong> for the editor grid, and an optional <strong>display name</strong> template such as <code>{make} {model} {year}</code> for record labels in pickers and list headings.</p>
    <p>Each schema field has an id, label, and <strong>kind</strong>: <strong>string</strong>, <strong>text</strong> (multi-line), <strong>url</strong> (plain text in the editor; a link icon on the site), <strong>number</strong>, <strong>boolean</strong>, <strong>date</strong>, <strong>enum</strong> (fixed options), <strong>asset</strong> (library image or document; optional <strong>many</strong> for several ids), or <strong>ref</strong> (link to a row in another dataset). Fields are flat — there are no nested object or list columns. Use <strong>text</strong> for longer copy; it is stored and shown as plain text, not rendered as HTML on the site.</p>
    <p><a href="#/data">Data</a> appears in the sidebar once at least one dataset exists. Choose a dataset to add rows, edit in a dialog, filter columns, or switch to <strong>Edit grid</strong> for bulk changes. In view mode the grid shows asset thumbnails where an asset column is visible; use the record dialog to pick assets.</p>
    <p>Visitors do not open dataset files directly. Put data on the site with a <strong>Dataset list</strong> binding (<a href="#/records/bindings">Records → Bindings</a>): pick the dataset, then <strong>Presentation</strong> — <strong>table</strong>, <strong>cards</strong>, <strong>plain list</strong>, or <strong>runtime module</strong> (custom markup from a <a href="${guideSectionHref("runtime-modules")}">runtime module</a> catalog entry). Set columns, default sort, limit, filters, and empty-state text in the wizard. Insert with <strong>Compose → Insert</strong> like any other binding (<code>{{id}}</code>).</p>
    <p>On <strong>publish</strong>, Tessera embeds a snapshot of every dataset referenced by bindings, including datasets reached through <strong>ref</strong> fields.</p>

    <h2 id="bindings">Bindings</h2>
    <p>A <strong>binding</strong> is a named configuration for a registry component. It lives once under <a href="#/records/bindings">Records → Bindings</a> (<code>records/bindings/&lt;id&gt;.yaml</code>): the component name and its props. Pages store a token <code>{{id}}</code> that Tessera expands when the page is rendered.</p>
    <h3 class="w3-medium">Where bindings belong on a page</h3>
    <p>Edit the page in <strong>Compose</strong>, inside a layout zone such as <code>main</code>. Add an <strong>Insert</strong> section and choose the binding id. That is one block among Text, Image box, and Side by side — not the Layout editor <strong>Component</strong> tile.</p>
    <h3 class="w3-medium">Why use bindings</h3>
    <ul>
      <li><strong>Portable</strong> — Page restructure does not discard the widget; the binding record stays until you delete it.</li>
      <li><strong>Reusable</strong> — Same <code>{{hall-gallery}}</code> on many pages; edit the binding once.</li>
      <li><strong>Reviewable</strong> — Bindings are their own record, not buried in page HTML.</li>
    </ul>
    <p>Prefer <strong>Bindings + Insert</strong> for wizard-supported components. Page sections store settings in zone HTML — fine for simple blocks; risky for complex micro-apps.</p>
    <h3 class="w3-medium">Gallery: binding vs Compose section</h3>
    <ul>
      <li><strong>Gallery binding</strong> — Primary: folders, filters, slides, reuse (Willow’s hall gallery).</li>
      <li><strong>Gallery Compose section</strong> — Quick fix: one folder on this page only. Move to a binding when it matters.</li>
    </ul>
    <p>Other binding kinds are <strong>binding only</strong> (no Compose section).</p>
    <h3 class="w3-medium">Binding kinds</h3>
    <ul>
      <li><strong>Gallery</strong> — Library folders as grid or slides.</li>
      <li><strong>Dated list</strong> — Dated pages by type. Willow’s upcoming events.</li>
      <li><strong>People grid</strong> — Pages of a type with photo and role.</li>
      <li><strong>Link group</strong> — Children, pages of a type, or a menu heading.</li>
      <li><strong>Reveal banner</strong> — Cropped panels, hover grow, click-to-reveal, then link (Miller’s Ark homepage hero). Panel image: site-relative path; panel link: page id or external URL (Choose page in the binding editor). Insert only.</li>
      <li><strong>Dataset list</strong> — Rows from a <a href="${guideSectionHref("datasets")}">dataset</a>: table, cards, or plain list; or the same data passed to a <strong>runtime module</strong> for a custom view. Sort, limit, column pick, and filters are binding props.</li>
      <li><strong>Embed</strong> — Raw HTML from a ticket vendor, payment provider, or similar (scripts and iframes kept on publish). Paste in the binding editor; insert with Compose → Insert. Not a layout Component.</li>
      <li><strong>Runtime module</strong> — Client JavaScript from the catalog with binding props only (no dataset). See <a href="${guideSectionHref("runtime-modules")}">Runtime modules</a>.</li>
    </ul>
    <p>Menus, breadcrumbs, profile lines, and <strong>Subpages</strong> are not bindings. Unsupported components use the raw binding file.</p>

  <h2 id="stylesheets">Stylesheets</h2>
    <p>A class on a layout region is an ordinary CSS class. These stylesheets supply them, and they do not stand in for each other.</p>
    <ul>
      <li><strong>${sheetLink("w3", "W3.CSS")}</strong> (<code>skin/w3.css</code>), linked by every shell. Examples: <code>w3-sidebar</code>, <code>w3-bar-block</code>, <code>w3-collapse</code>, <code>w3-hide-large</code>, <code>w3-row</code>, <code>w3-col</code>. <code>w3-collapse</code> on a <code>w3-sidebar</code> shows that sidebar from 993px up and hides it below that, where the Menu button opens it. <code>w3-hide-large</code> hides an element from 993px up.</li>
      <li><strong>${sheetLink("tessera", "Tessera")}</strong> (<code>skin/tessera.css</code>), linked by every shell. The default frame and shared widgets: <code>tessera-sidebar</code>, <code>tessera-bar</code>, <code>tessera-main</code>, <code>tessera-content</code>, <code>tessera-footer</code>, link clusters, video, pasted notes, and <code>tessera-imgbox</code>. Tokens changed on the ${stylesPage} page override <code>:root</code> in this file. Defaults stay here.</li>
      <li><strong>${sheetLink("microapps", "Micro-apps")}</strong> (<code>skin/microapps.css</code>). The gallery lives here.</li>
      <li><strong>${sheetLink("site", "Site CSS")}</strong> (<code>shell/site.css</code>). Theme / frame layout for this site. Willow’s look is here: <code>wh-header</code>, <code>wh-topnav</code>, <code>wh-drawer</code>, <code>wh-main</code>, and the colours under <code>--wh-</code>. <code>.wh-drawer</code> is <code>display: none</code> until Menu runs. Theme apply may replace this file.</li>
      <li><strong>${sheetLink("local", "Site local")}</strong> (<code>shell/local.css</code>). Durable site-owned rules (panel tones, local tweaks). Theme apply does not overwrite it. Linked after <code>site.css</code>.</li>
    </ul>
    <p>A shell that links a W3 theme, such as <code>skin/w3-theme-teal.css</code>, keeps ${sheetLink("theme", "that theme file")} between W3 and Tessera. Willow paints those colours in ${sheetLink("site", "site layout")} instead. The fonts link is a URL, not one of these files.</p>
    <p>The ${stylesPage} page can open each of these files. Saving W3, Tessera, micro-apps, or the theme stores a copy for this site and leaves the shared file alone. Saving site layout writes <code>shell/site.css</code>; saving site local writes <code>shell/local.css</code>. The preview uses a save immediately. Publish updates the published copy.</p>

    <h2 id="what-the-styles-page-changes">What the Styles page changes</h2>
    <p>${stylesPage} saves <code>site.style</code>. A pages build writes tokens that differ from the Tessera defaults into a style element after the stylesheet links, and adds <code>leftnav</code> or <code>rightnav</code> on the body. That style element overrides those variables in ${sheetLink("tessera", "Tessera")}. A token left at its default stays in the stylesheet, so editing it there shows in the preview. Editing a stylesheet does not change this form. Willow’s master layout uses <code>wh-</code> classes, so saving the tokens leaves the hall looking the same. The specimen on the ${stylesPage} page is the default frame, which is the frame a blank site starts with.</p>
    <table class="w3-table w3-bordered">
      <thead><tr><th>Field</th><th>Effect on the default chrome</th></tr></thead>
      <tbody>
        <tr><td>Sidebar width</td><td>Width of <code>tessera-sidebar</code>, and the gap <code>tessera-main</code> leaves for it.</td></tr>
        <tr><td>Bar height</td><td>Height of the top bar, and how far the sidebar sits below it.</td></tr>
        <tr><td>Content width</td><td>Maximum width of <code>tessera-content</code>.</td></tr>
        <tr><td>Base font size</td><td>Body text size.</td></tr>
        <tr><td>Font A–D</td><td>The four faces behind the A B C D buttons. Font A is the one visitors start on.</td></tr>
        <tr><td>Fonts stylesheet</td><td>An https URL that loads those faces. A Google Fonts CSS link is the usual value.</td></tr>
        <tr><td>Menu side</td><td>Left or right. Moves a <code>tessera-sidebar</code>. Willow’s drawer is a separate element and stays on the left.</td></tr>
        <tr><td>Bar, Bar text</td><td>Top bar and footer fill and type.</td></tr>
        <tr><td>Sidebar, Sidebar text</td><td>Sidebar fill and type. The current link uses Accent for its fill and Bar text for its type.</td></tr>
        <tr><td>Page background, Text</td><td>Page fill and body type.</td></tr>
        <tr><td>Muted</td><td>Breadcrumb type, and the border of link cards.</td></tr>
        <tr><td>Accent</td><td>Current sidebar link, and link pills.</td></tr>
        <tr><td>Link</td><td>Links in the page body and in breadcrumbs.</td></tr>
      </tbody>
    </table>
    <p>Lengths are values such as <code>300px</code> or <code>1.5rem</code>. Colours are hex, such as <code>#009688</code>.</p>

    <h2 id="a-standing-side-menu-on-willow">A standing side menu on Willow</h2>
    <p>The drawer is already in the master layout, with id <code>mySidebar</code>. To keep it open on a wide window, add <code>w3-collapse</code> to that region’s classes:</p>
    <pre>className: w3-sidebar w3-bar-block w3-collapse wh-drawer</pre>
    <p>Then give the page a left margin in ${sheetLink("site", "site layout")}:</p>
    <pre>@media (min-width: 993px) {
  .wh-drawer { width: 16rem; }
  .wh-main { margin-left: 16rem; }
}</pre>
    <p>Below 993px it stays a drawer opened by Menu, and that flyout may slide in. Leave <code>w3-animate-left</code> off the standing column: from 993px up the column is already on the page, and a slide on every new page is only noise. Keep the ids <code>mySidebar</code> and <code>myOverlay</code>. The runtime binds open and close to those two ids.</p>
    <p>A starter site already has this column, on the left. Its master uses <code>tessera-sidebar</code> and <code>w3-collapse</code>, its shell links ${sheetLink("tessera", "Tessera")}, and the <a href="#/records/site">site record</a> sets Menu side to left. The ${stylesPage} page can move the standing column. Below 993px the column hides. The Menu button sits on the right of the bar and opens a flyout from the right, so the site title stays put and the left of the page stays in view. The flyout position is in ${sheetLink("site", "site layout")}.</p>

    <h2 id="a-different-frame-for-a-section">A different frame for a section</h2>
    <p>The <a href="#/records/site">site record</a> names the frame every page uses until a page names another. On that page, <strong>Frame</strong> is the layout. Leave it as <strong>Inherit</strong> on the children: they use the nearest parent that set one. A page further down can name its own, and that starts again. Naming the site's frame on a nested page steps that subtree back to the site frame.</p>
    <p>The parent is the same parent that builds the URL. A winter fair whose parent is Events publishes at <code>/events/event-winter-fair</code> and wears the Events frame. A page that is not under Events keeps the site frame, even when it uses the same page layout. The home page does not inherit from a parent.</p>
    <p>The page layout does not follow the frame. Style tokens stay on the site. Both frames' classes live in ${sheetLink("site", "site layout")}. Each frame places its own menu components, and those components still read the one <a href="#/navigation">Nav record</a>.</p>

    <h2 id="maintenance">Maintenance</h2>
    <p>The editor’s <a href="#/maintenance">Maintenance</a> page lists reports on the left with finding counts; choose one to see the full list on the right. Each row links to the record to fix. Reports:</p>
    <ul>
      <li><strong>Orphan pages</strong> — not home, not on the Nav record (after expansion), and not linked from another page via a wiki link. Articles under a reachable blog are omitted.</li>
      <li><strong>Unused assets</strong> — library media nothing references.</li>
      <li><strong>Broken refs</strong> — missing wiki targets, media, or gallery folders; the link opens the source record.</li>
      <li><strong>Unused items</strong> — common items and layouts never referenced.</li>
      <li><strong>Unknown bindings</strong> — mustache names with no binding, or components the registry does not know.</li>
      <li><strong>Unreachable nav</strong> — designed nav rows whose page id is missing.</li>
      <li><strong>Rescan drift</strong> — dangling media refs, plus assets sitting in the library’s <code>scanned</code> folder after a rescan.</li>
    </ul>
    <p>These reports are separate from the per-page preview diagnostics panel.</p>

    <h2 id="aspects">Aspects</h2>
    <p>A theme that offers more than one look lists those looks as aspects. On a page, <strong>Aspect</strong> picks one. Leave it as <strong>Inherit</strong> and the page uses the nearest parent that set one, or the site default. The home page does not inherit from a parent. Choosing an aspect only adds a class on the document root for that theme's CSS. It does not change the layout or the frame.</p>

    <h2 id="runtime-modules">Runtime modules</h2>
    <p><strong>Runtime modules</strong> are small ES modules served from <code>./runtime-modules/</code> on the published site. Tessera stores the files under <a href="#/records/runtimeModules">Records → Runtime modules</a>; it does not run module code on the server. The site runtime <code>import()</code>s each module and calls <code>export default function mount(root, ctx)</code>.</p>
    <p>Upload or edit a module, then wire it through a binding: <strong>Runtime module</strong> (props only) or <strong>Dataset list</strong> with presentation <strong>Runtime module</strong>. Insert the binding in Compose, preview, and publish. Use <code>ctx.host</code> in the module for DOM helpers (<code>el</code>, <code>text</code>, <code>ui.card</code>, and the rest) — do not import Tessera internals in v1. Dataset bindings also set <code>ctx.dataset</code> with the embedded snapshot.</p>

    <h2 id="panel-tones">Panel tones</h2>
    <p>The <a href="#/records/site">site record</a> lists extra tones for Compose <strong>Panel</strong> and <strong>Quote</strong> sections in <code>panelTones</code> on the Site form (same key in <code>records/site.yaml</code>). They appear in the Tone dropdown and style that block only; they are not aspects and do not change the page chrome. Put their CSS in ${sheetLink("local", "site local")} so a theme reinstall does not wipe it. Theme apply does not clear the catalog. Panel is a nested-block container (like Card): the tone styles the shell, and you drop other Compose sections inside it.</p>
    <p><strong>Compose preview.</strong> Built-in tones use W3 classes such as <code>w3-sand</code> on the panel shell; the editor loads W3.CSS, so those fills show while you edit. Custom tones paint your <code>className</code> on the same shell; rules live in ${sheetLink("local", "site local")}. The editor loads that file in Compose as well, so shell background and colour on your tone class preview there too.</p>
    <p>Keep typed divergence small. Put the callout <strong>fill and default text colour on the panel shell</strong> (your tone class on the <code>w3-panel</code> wrapper). Scope stronger typography to <strong>direct children</strong> of <code>.rt-panel-body</code> — standalone <strong>Heading</strong> blocks (<code>h1</code>–<code>h6</code> with <code>tessera-block</code>), <strong>Text</strong> widgets (<code>.tessera-text</code>), and optionally a title line inside Text — not cards, quotes, images, or blocks nested inside those. Example <code>panelTones</code> on the site record and matching CSS:</p>
    <pre>id: willow-hall
title: Willow Hall
homePageId: home
panelTones:
  - id: callout
    label: Callout
    className: tone-callout</pre>
    <pre>.tone-callout {
  background-color: #fff59d;
  color: #1a237e;
  padding: 0.5rem;
}

.tone-callout &gt; .rt-panel-body &gt; .tessera-text,
.tone-callout &gt; .rt-panel-body &gt; :is(h1, h2, h3, h4, h5, h6).tessera-block {
  font-family: "Source Sans 3", sans-serif;
  font-size: 1.15em;
  color: inherit;
}

.tone-callout &gt; .rt-panel-body &gt; .tessera-text :is(h1, h2, h3, h4, h5, h6) {
  font-family: inherit;
  color: inherit;
}

.tone-callout a,
.tone-callout a:visited {
  color: inherit;
  text-decoration: underline;
}</pre>
    <p>Headings and links need explicit rules when they would otherwise pick up site chrome: the font picker styles <code>body.fontA h1…h6</code>, and <code>.tessera-main a</code> sets link colour. The <code>&gt; .rt-panel-body &gt; …</code> chain limits typography to direct panel content; a <strong>Card</strong> or nested <strong>Panel</strong> inside the body keeps the normal site style.</p>
  </article>`;
}

/** Scroll to `#/guide?section=…` target after the guide view is mounted. */
export function scrollGuideSection(root: HTMLElement, sectionId: string): void {
  const id = sectionId.trim();
  if (!id) return;
  const target = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  target?.scrollIntoView({ block: "start" });
}
