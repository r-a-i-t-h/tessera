/** Authoring notes shown at #/guide. Keep this aligned with GUIDE.md. */
export function guideHtml(): string {
  return `<article class="editor-guide">
    <h1 class="w3-large">Guide</h1>
    <p>How menus, styles, and YAML fit together. Willow is the worked example.</p>

    <h2>YAML indentation</h2>
    <p>Indentation is the structure. A child sits further right than its parent, and every key at one level starts in the same column. Tabs are rejected. The editor writes two spaces per level. One space is legal, and four spaces are legal, when every sibling uses that same step. Mixing 2 and 4 in one block attaches a key to the wrong parent, or the file will not parse.</p>
    <p>List items are the awkward case. The dash already occupies two columns, so the keys under a dash line up with the text after <code>- </code>:</p>
    <pre>- id: events
  title: Events
  sidebar: true
  topbar: true</pre>
    <p>Save on the Fields tab rewrites a file at two spaces. The Raw file tab keeps the spaces you typed.</p>

    <h2>Menus</h2>
    <p>Links live on the Nav record (<a href="#/records/nav">Records → Nav</a>, file <code>records/nav.yaml</code>). Each row has three places: <strong>Sidebar</strong>, <strong>Top bar</strong>, and <strong>Footer</strong>. A place shows the row only when the master layout draws a menu component for that place.</p>
    <p>Willow’s master layout (<a href="#/records/layouts">Records → Layouts</a>, then <code>master</code>) has two:</p>
    <ul>
      <li><code>navFlat</code> with <code>scope: topbar</code> is the row of links under the logo.</li>
      <li><code>navFlat</code> with <code>scope: sidebar</code> is the drawer. On a wide window the Menu button is hidden and the drawer stays closed. Narrow the window and Menu opens it.</li>
    </ul>
    <p><strong>Show in nav</strong> on a page stores a flag. Clearing it writes <code>showInNav: false</code>. The menu components do not read that flag, so ticking it does not add a link. Add the page on the Nav record, or add a heading that pulls a whole type.</p>
    <p>A heading can fill itself. <strong>Type</strong> <code>meeting</code> lists every page whose type is <code>meeting</code>. <strong>Items</strong> lists pages whose id matches an item carrying that tag. Willow’s “This term” heading uses Type <code>meeting</code> and Sidebar only, which is why meetings appear in the drawer and stay off the top bar. Events have no such heading, so an event page stays out of both menus until you add one:</p>
    <pre>- heading: What's on
  sidebar: true
  source:
    pageType: event</pre>
    <p>Leave Top bar unticked and those links stay in the sidebar component.</p>
    <p>A <strong>heading</strong> row groups links. Heading text is optional: leave it blank to group without a visible title.</p>

    <h2>Menu components</h2>
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
      <li><code>searchBox</code> is typeahead search for the frame. Place it on the master layout. The index loads only on first use. Enter opens the Search page.</li>
      <li><code>searchResults</code> is the full results UI on a Search page (refine, tag/type filter, relevance or title sort).</li>
  </ul>
    <p>A blank site already puts <code>searchBox</code> in the sidebar and a Search page on the Nav record. Keep the menu sparse for wiki-style sites; reach other pages by cross-links and search.</p>

    <h2>Page links (wiki-style)</h2>
    <p>Compose’s <strong>link</strong> control opens the page picker for every page. That stores <code>&lt;a data-tessera-page=&quot;hall&quot; href=&quot;#&quot;&gt;…&lt;/a&gt;</code>. You can also type <code>[[hall]]</code> or <code>[[hall|label]]</code>; saving expands those the same way. Preview and publish resolve the URL. Renaming a page rewrites those ids in prose and binding links. Missing targets use the class <code>tessera-page-missing</code>. Preview diagnostics lists pages linked to and from the current page.</p>

    <h2>Articles</h2>
    <p><a href="#/pages">Pages</a> are ordinary pages. <a href="#/articles">Articles</a> expands each blog in the sidebar so you can pick which stream’s articles to edit. A blog is one dated stream: path, frame, page size, hero, and lead. Hero is full, banner, or side. Blog records are managed under <a href="#/records/blogs">Records → Blogs</a>. Creating a blog also creates its index. Place each blog on the Nav record yourself. The menu can add the index when the blog asks for it. Articles are not menu items.</p>

    <h2>Bindings</h2>
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
      <li><strong>Embed</strong> — Raw HTML from a ticket vendor, payment provider, or similar (scripts and iframes kept on publish). Paste in the binding editor; insert with Compose → Insert. Not a layout Component.</li>
    </ul>
    <p>Menus, breadcrumbs, profile lines, and <strong>Subpages</strong> are not bindings. Unsupported components use the raw binding file.</p>

  <h2>Stylesheets</h2>
    <p>A class on a layout region is an ordinary CSS class. These stylesheets supply them, and they do not stand in for each other.</p>
    <ul>
      <li><strong>W3.CSS</strong> (<code>skin/w3.css</code>), linked by every shell. Examples: <code>w3-sidebar</code>, <code>w3-bar-block</code>, <code>w3-collapse</code>, <code>w3-hide-large</code>, <code>w3-row</code>, <code>w3-col</code>. <code>w3-collapse</code> on a <code>w3-sidebar</code> shows that sidebar from 993px up and hides it below that, where the Menu button opens it. <code>w3-hide-large</code> hides an element from 993px up.</li>
      <li><strong>Tessera</strong> (<code>skin/tessera.css</code>), linked by every shell. The default frame and shared widgets: <code>tessera-sidebar</code>, <code>tessera-bar</code>, <code>tessera-main</code>, <code>tessera-content</code>, <code>tessera-footer</code>, link clusters, video, pasted notes, and <code>tessera-imgbox</code>. Tokens changed on the <a href="#/styles">Styles</a> page override <code>:root</code> in this file. Defaults stay here.</li>
      <li><strong>Micro-apps</strong> (<code>skin/microapps.css</code>). The gallery lives here.</li>
      <li><strong>Site CSS</strong> (<code>shell/site.css</code>). Theme / frame layout for this site. Willow’s look is here: <code>wh-header</code>, <code>wh-topnav</code>, <code>wh-drawer</code>, <code>wh-main</code>, and the colours under <code>--wh-</code>. <code>.wh-drawer</code> is <code>display: none</code> until Menu runs. Theme apply may replace this file.</li>
      <li><strong>Site local</strong> (<code>shell/local.css</code>). Durable site-owned rules (panel tones, local tweaks). Theme apply does not overwrite it. Linked after <code>site.css</code>.</li>
    </ul>
    <p>A shell that links a W3 theme, such as <code>skin/w3-theme-teal.css</code>, keeps that file between W3 and Tessera. Willow paints those colours in <code>site.css</code> instead. The fonts link is a URL, not one of these files.</p>
    <p>The Styles page can open each of these files. Saving W3, Tessera, micro-apps, or the theme stores a copy for this site and leaves the shared file alone. Saving site layout writes <code>shell/site.css</code>; saving site local writes <code>shell/local.css</code>. The preview uses a save immediately. Publish updates the published copy.</p>

    <h2>What the Styles page changes</h2>
    <p>Styles saves <code>site.style</code>. A pages build writes tokens that differ from the Tessera defaults into a style element after the stylesheet links, and adds <code>leftnav</code> or <code>rightnav</code> on the body. That style element overrides those variables in <code>tessera.css</code>. A token left at its default stays in the stylesheet, so editing it there shows in the preview. Editing a stylesheet does not change this form. Willow’s master layout uses <code>wh-</code> classes, so saving the tokens leaves the hall looking the same. The specimen on the Styles page is the default frame, which is the frame a blank site starts with.</p>
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

    <h2>A standing side menu on Willow</h2>
    <p>The drawer is already in the master layout, with id <code>mySidebar</code>. To keep it open on a wide window, add <code>w3-collapse</code> to that region’s classes:</p>
    <pre>className: w3-sidebar w3-bar-block w3-collapse wh-drawer</pre>
    <p>Then give the page a left margin in <code>shell/site.css</code>:</p>
    <pre>@media (min-width: 993px) {
  .wh-drawer { width: 16rem; }
  .wh-main { margin-left: 16rem; }
}</pre>
    <p>Below 993px it stays a drawer opened by Menu, and that flyout may slide in. Leave <code>w3-animate-left</code> off the standing column: from 993px up the column is already on the page, and a slide on every new page is only noise. Keep the ids <code>mySidebar</code> and <code>myOverlay</code>. The runtime binds open and close to those two ids.</p>
    <p>A starter site already has this column, on the left. Its master uses <code>tessera-sidebar</code> and <code>w3-collapse</code>, its shell links <code>tessera.css</code>, and the site record sets Menu side to left. The Styles page can move the standing column. Below 993px the column hides. The Menu button sits on the right of the bar and opens a flyout from the right, so the site title stays put and the left of the page stays in view. The flyout position is in <code>shell/site.css</code>.</p>

    <h2>A different frame for a section</h2>
    <p>The site record names the frame every page uses until a page names another. On that page, <strong>Frame</strong> is the layout. Leave it as <strong>Inherit</strong> on the children: they use the nearest parent that set one. A page further down can name its own, and that starts again. Naming the site's frame on a nested page steps that subtree back to the site frame.</p>
    <p>The parent is the same parent that builds the URL. A winter fair whose parent is Events publishes at <code>/events/event-winter-fair</code> and wears the Events frame. A page that is not under Events keeps the site frame, even when it uses the same page layout. The home page does not inherit from a parent.</p>
    <p>The page layout does not follow the frame. Style tokens stay on the site. Both frames' classes live in <code>shell/site.css</code>. Each frame places its own menu components, and those components still read the one Nav record.</p>

    <h2>Maintenance</h2>
    <p>The editor’s <a href="#/maintenance">Maintenance</a> overview shows how many findings each report has; open a report for the full list. Each row links to the record to fix. Sidebar items:</p>
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

    <h2>Aspects</h2>
    <p>A theme that offers more than one look lists those looks as aspects. On a page, <strong>Aspect</strong> picks one. Leave it as <strong>Inherit</strong> and the page uses the nearest parent that set one, or the site default. The home page does not inherit from a parent. Choosing an aspect only adds a class on the document root for that theme's CSS. It does not change the layout or the frame.</p>

    <h2>Panel tones</h2>
    <p>The site record may list extra tones for Compose <strong>Panel</strong> and <strong>Quote</strong> sections (<code>panelTones</code> on the Site form). They appear in the Tone dropdown and style that block only; they are not aspects and do not change the page chrome. Put their CSS in <code>shell/local.css</code> so a theme reinstall does not wipe it. Theme apply does not clear the catalog. Panel is a nested-block container (like Card): the tone styles the shell, and you drop other Compose sections inside it.</p>
  </article>`;
}
