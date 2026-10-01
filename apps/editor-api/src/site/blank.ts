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
    <link rel="stylesheet" href="./skin/chrome.css" />
    <link rel="stylesheet" href="./site.css" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lekton|Roboto|Orbitron|Thasadith" />
  </head>
  <body class="rightnav fontA">
    <div id="app"></div>
    <script type="module" src="./tessera.js"></script>
  </body>
</html>
`;

const SITE_CSS = `/* Site-specific rules. Shared chrome tokens live in skin/chrome.css. */
`;

const SITE_YAML = `version: 2
id: site
title: New site
homePageId: home
defaultLayoutId: standard
masterLayoutId: master
delivery: pages
`;

const MASTER_YAML = `id: master
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
              html: '<a class="w3-bar-item w3-button tessera-menu-btn w3-hide-large" href="javascript:void(0)" onclick="w3_open()" aria-label="Open menu">Menu</a><div class="w3-bar-item tessera-brand">New site</div><span class="tessera-fonts" role="group" aria-label="Font"><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 0)">A</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 1)">B</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 2)">C</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 3)">D</button></span>'
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
            - type: static
              html: '<p>New site</p>'
`;

const STANDARD_YAML = `id: standard
root:
  type: region
  children:
    - type: zone
      id: title
    - type: zone
      id: main
`;

const HOME_YAML = `id: home
title: Home
tags:
  - page
zones:
  title:
    html: Home
  main:
    html: '<p>This site started empty. Edit this page, or replace the master layout.</p>'
`;

const NAV_YAML = `- id: home
  title: Home
  sidebar: true
`;

const LAYOUT_ORDER = `- standard
- master
`;

const CONTENT_ORDER = `- home
`;

/** Write a shell, a master layout, and a first page. Refuses when site.yaml exists. */
export async function writeBlankSite(siteRoot: string): Promise<void> {
  const records = join(siteRoot, "records");
  const siteFile = join(records, "site.yaml");
  try {
    await readText(siteFile);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await writeTextAtomic(join(siteRoot, "shell", "index.html"), SHELL_HTML);
      await writeTextAtomic(join(siteRoot, "shell", "site.css"), SITE_CSS);
      await writeTextAtomic(siteFile, SITE_YAML);
      await writeTextAtomic(join(records, "layouts", "master.yaml"), MASTER_YAML);
      await writeTextAtomic(join(records, "layouts", "standard.yaml"), STANDARD_YAML);
      await writeTextAtomic(join(records, "layouts", "_order.yaml"), LAYOUT_ORDER);
      await writeTextAtomic(join(records, "content", "home.yaml"), HOME_YAML);
      await writeTextAtomic(join(records, "content", "_order.yaml"), CONTENT_ORDER);
      await writeTextAtomic(join(records, "nav.yaml"), NAV_YAML);
      return;
    }
    throw err;
  }
  throw new Error("This site already has records.");
}
