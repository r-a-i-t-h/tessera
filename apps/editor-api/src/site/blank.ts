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
    <link rel="stylesheet" href="./site.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./tessera.js"></script>
  </body>
</html>
`;

const SITE_CSS = `body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
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
title: Master
root:
  type: region
  children:
    - type: region
      tag: header
      className: w3-bar w3-theme w3-large
      children:
        - type: static
          html: '<a class="w3-bar-item w3-button" href="#home">New site</a>'
    - type: region
      className: w3-row
      children:
        - type: region
          tag: nav
          className: w3-col m3 l2 w3-padding
          children:
            - type: component
              name: navFlat
              props:
                scope: sidebar
        - type: region
          tag: main
          className: w3-col m9 l10 w3-padding
          children:
            - type: page
`;

const STANDARD_YAML = `id: standard
title: Standard
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
