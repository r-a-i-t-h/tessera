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

    <h2>Menu components</h2>
    <p>Put one of these in the master layout as a component. <code>scope</code> is <code>sidebar</code> (the default for <code>navFlat</code>), <code>topbar</code>, or <code>footer</code>.</p>
    <ul>
      <li><code>navFlat</code> prints a flat list. Headings become small titles. This is what Willow uses.</li>
      <li><code>navTree</code> prints a nested list.</li>
      <li><code>navCollapse</code> prints disclosure sections.</li>
      <li><code>navTags</code> groups pages by their tags. It ignores the Nav record. Optional prop <code>tag</code> keeps one tag.</li>
      <li><code>breadcrumbs</code> prints Home, then parent pages, then the current page.</li>
      <li><code>subpageList</code> prints the current page’s children. Optional prop <code>title</code>.</li>
      <li><code>linkCluster</code> prints a group of links in the page body. <code>source</code> is <code>children</code> (the default), <code>type</code> (also set <code>type</code> to a type id), or <code>nav</code> (also set <code>heading</code> to a Nav heading). <code>variant</code> is <code>list</code>, <code>pills</code>, or <code>cards</code>.</li>
    <li><code>pageNav</code> lists every page that has no type. It ignores the Nav record.</li>
  </ul>

  <h2>Bindings</h2>
  <p>A binding is a named piece you can drop on any page. The choices live once, under <a href="#/records/bindings">Records → Bindings</a> (<code>records/bindings/&lt;id&gt;.yaml</code>). Compose → Insert writes <code>{{id}}</code> into the page.</p>
  <p>A Gallery section in Compose is a different thing. That paints one folder into that page only. A gallery binding can combine folders, keep filenames that match a pattern, and play as slides.</p>
  <ul>
    <li><strong>Gallery</strong> shows pictures from library folders, as a grid or as slides.</li>
    <li><strong>Dated list</strong> shows pages of a type that have a date field. Upcoming, past, or all. Precis is the line under the date. Willow’s upcoming events list is one of these.</li>
    <li><strong>People grid</strong> shows pages of a type, using the photo and role fields.</li>
    <li><strong>Link group</strong> shows a titled set of links: this page’s children, every page of a type, or one menu heading. Children follow the page the insert sits on.</li>
  </ul>
  <p>A list stored as JSON, and any other component, is edited as the raw file. Menus, breadcrumbs, and the profile lines (<code>articleByline</code>, <code>profileKicker</code>, <code>profilePhoto</code>, <code>profileFacts</code>) belong on a layout. Subpages is a Compose section.</p>

  <h2>Four stylesheets</h2>
    <p>A class on a layout region is an ordinary CSS class. Four stylesheets supply them, and they do not stand in for each other.</p>
    <ul>
      <li><strong>W3.CSS</strong> (<code>skin/w3.css</code>), linked by every shell. Examples: <code>w3-sidebar</code>, <code>w3-bar-block</code>, <code>w3-collapse</code>, <code>w3-hide-large</code>, <code>w3-row</code>, <code>w3-col</code>. <code>w3-collapse</code> on a <code>w3-sidebar</code> shows that sidebar from 993px up and hides it below that, where the Menu button opens it. <code>w3-hide-large</code> hides an element from 993px up.</li>
      <li><strong>Tessera</strong> (<code>skin/tessera.css</code>), linked by every shell. The default frame and shared widgets: <code>tessera-sidebar</code>, <code>tessera-bar</code>, <code>tessera-main</code>, <code>tessera-content</code>, <code>tessera-footer</code>, link clusters, video, pasted notes, and <code>tessera-imgbox</code>. The <a href="#/styles">Styles</a> page tokens override <code>:root</code> in this file.</li>
      <li><strong>Micro-apps</strong> (<code>skin/microapps.css</code>). The gallery lives here.</li>
      <li><strong>Site CSS</strong> (<code>shell/site.css</code>). This site’s layout. Willow’s look is here: <code>wh-header</code>, <code>wh-topnav</code>, <code>wh-drawer</code>, <code>wh-main</code>, and the colours under <code>--wh-</code>. <code>.wh-drawer</code> is <code>display: none</code> until Menu runs.</li>
    </ul>
    <p>A shell that links a W3 theme, such as <code>skin/w3-theme-teal.css</code>, keeps that file between W3 and Tessera. Willow paints those colours in <code>site.css</code> instead. The fonts link is a URL, not one of these files.</p>
    <p>The Styles page can open each of these files. Saving W3, Tessera, micro-apps, or the theme stores a copy for this site and leaves the shared file alone. Saving site layout writes <code>shell/site.css</code>. The preview uses a save immediately. Publish updates the published copy.</p>

    <h2>What the Styles page changes</h2>
    <p>Styles saves <code>site.style</code>. A pages build writes those tokens into a style element after the stylesheet links, and adds <code>leftnav</code> or <code>rightnav</code> on the body. That style element overrides <code>:root</code> in <code>tessera.css</code>. Editing the same variables in a stylesheet does not change this form. Willow’s master layout uses <code>wh-</code> classes, so saving the tokens leaves the hall looking the same. The specimen on the Styles page is the default frame, which is the frame a blank site starts with.</p>
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
  </article>`;
}
