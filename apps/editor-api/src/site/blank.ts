import { join } from "node:path";
import { readText, writeTextAtomic } from "../store/fs.js";

const SHELL_HTML = `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta name="tessera-site" content="./data/site.json" />
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New site</title>
    <link rel="stylesheet" href="./skin/w3.css" />
    <link rel="stylesheet" href="./skin/w3-theme-teal.css" />
    <link rel="stylesheet" href="./skin/tessera.css" />
    <link rel="stylesheet" href="./skin/microapps.css" />
    <link rel="stylesheet" href="./site.css" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lekton|Roboto|Orbitron|Thasadith" />
  </head>
  <body class="leftnav fontA">
    <div id="app"></div>
    <script type="module" src="./tessera.js"></script>
  </body>
</html>
`;

const SITE_CSS = `/* Site-specific rules. Shared frame tokens live in skin/tessera.css. */

/* The column stays on the left from 993px up. Below that it is a flyout
   from the right, so the title and the left of the page stay in view. */
@media (max-width: 992px) {
  body.leftnav .tessera-sidebar {
    left: auto;
    right: 0;
    animation: animateright 0.4s;
  }
}
`;

const SITE_YAML = `version: 2
id: site
title: New site
homePageId: home
defaultLayoutId: standard
masterLayoutId: master
delivery: pages
style:
  navSide: left
`;

const MASTER_YAML = `id: master
includes:
  - common-footer
root:
  type: region
  children:
    - type: region
      className: w3-top tessera-top
      children:
        - type: region
          tag: header
          className: w3-bar tessera-bar
          children:
            - type: static
              html: '<a class="w3-bar-item w3-button w3-right tessera-menu-btn w3-hide-large" href="javascript:void(0)" onclick="w3_open()" aria-label="Open menu">Menu</a><div class="w3-bar-item tessera-brand">New site</div><span class="tessera-fonts" role="group" aria-label="Font"><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 0)">A</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 1)">B</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 2)">C</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 3)">D</button></span>'
    - type: region
      tag: nav
      id: mySidebar
      className: w3-sidebar w3-bar-block w3-collapse tessera-sidebar
      children:
        - type: static
          html: '<a href="javascript:void(0)" onclick="w3_close()" class="w3-button w3-right w3-hide-large" aria-label="Close menu">Close</a>'
        - type: component
          name: navFlat
          props:
            scope: sidebar
    - type: static
      html: '<div class="w3-overlay w3-hide-large" onclick="w3_close()" id="myOverlay"></div>'
    - type: region
      tag: main
      className: w3-main tessera-main
      children:
        - type: region
          className: tessera-content
          children:
            - type: component
              name: breadcrumbs
            - type: page
        - type: region
          tag: footer
          className: tessera-footer
          children:
            - type: zone
              id: footer
`;

const STANDARD_YAML = `id: standard
root:
  type: region
  children:
    - type: region
      tag: h1
      children:
        - type: zone
          id: title
    - type: zone
      id: main
`;

const TYPE_YAML = `id: standard
layoutId: standard
`;

const HOME_YAML = `id: home
title: Hello world
type: standard
zones:
  title:
    html: Hello world
  main:
    html: '<p>Hello world.</p>'
`;

const BLOG_YAML = `id: blog
title: Blog
slug: blog
type: blog
fields:
  tenant: blogger
  pageSize: "10"
zones:
  title:
    html: Blog
  lead:
    html: '<p>Notes from this site.</p>'
`;

const BLOG_INDEX_YAML = `id: blog-index
title: Index
slug: index
parentId: blog
type: blog-index
zones:
  title:
    html: Index
`;

const ARTICLE_YAML = `id: birthday
title: The blog begins
parentId: blog
type: article
fields:
  tenant: blogger
  date: 2026-10-09
  author: Blogger
  precis: Dated on the day the blog arrived.
zones:
  title:
    html: The blog begins
  main:
    html: '<p>This is the first article, dated 9 October 2026, the day the blog arrived.</p>'
`;

const TENANT_YAML = `id: blogger
`;

const FOOTER_YAML = `id: common-footer
zones:
  footer:
    html: '<p>New site</p>'
`;

const NAV_YAML = `- id: home
  title: Home
  sidebar: true
- id: blog
  title: Blog
  sidebar: true
  source:
    blog: true
`;

const LAYOUT_ORDER = `- standard
- master
`;

const CONTENT_ORDER = `- home
- blog
- blog-index
- birthday
`;

const TENANT_ORDER = `- blogger
`;

const TYPE_ORDER = `- standard
`;

const ITEM_ORDER = `- common-footer
`;

/**
 * Shell, master layout (includes the common-footer item), standard type and
 * layout, Hello world home page, and a blog for tenant blogger with one article.
 * Overwrites those files when they already exist.
 */
export async function writeSeedFiles(siteRoot: string): Promise<void> {
  const records = join(siteRoot, "records");
  await writeTextAtomic(join(siteRoot, "shell", "index.html"), SHELL_HTML);
  await writeTextAtomic(join(siteRoot, "shell", "site.css"), SITE_CSS);
  await writeTextAtomic(join(records, "site.yaml"), SITE_YAML);
  await writeTextAtomic(join(records, "layouts", "master.yaml"), MASTER_YAML);
  await writeTextAtomic(join(records, "layouts", "standard.yaml"), STANDARD_YAML);
  await writeTextAtomic(join(records, "layouts", "_order.yaml"), LAYOUT_ORDER);
  await writeTextAtomic(join(records, "types", "standard.yaml"), TYPE_YAML);
  await writeTextAtomic(join(records, "types", "_order.yaml"), TYPE_ORDER);
  await writeTextAtomic(join(records, "items", "common-footer.yaml"), FOOTER_YAML);
  await writeTextAtomic(join(records, "items", "_order.yaml"), ITEM_ORDER);
  await writeTextAtomic(join(records, "content", "home.yaml"), HOME_YAML);
  await writeTextAtomic(join(records, "content", "blog.yaml"), BLOG_YAML);
  await writeTextAtomic(join(records, "content", "blog-index.yaml"), BLOG_INDEX_YAML);
  await writeTextAtomic(join(records, "content", "birthday.yaml"), ARTICLE_YAML);
  await writeTextAtomic(join(records, "content", "_order.yaml"), CONTENT_ORDER);
  await writeTextAtomic(join(records, "tenants", "blogger.yaml"), TENANT_YAML);
  await writeTextAtomic(join(records, "tenants", "_order.yaml"), TENANT_ORDER);
  await writeTextAtomic(join(records, "nav.yaml"), NAV_YAML);
}

/** Write the starter site. Refuses when site.yaml exists. */
export async function writeBlankSite(siteRoot: string): Promise<void> {
  const siteFile = join(siteRoot, "records", "site.yaml");
  try {
    await readText(siteFile);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await writeSeedFiles(siteRoot);
      return;
    }
    throw err;
  }
  throw new Error("This site already has records.");
}
