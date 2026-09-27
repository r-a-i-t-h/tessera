import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { flattenPageTree, publishedPageTree, type PageTreeNode } from "@r-a-i-t-h/tessera-model";
import { ComponentRegistry } from "./registry.js";
import { escapeHtml, renderPage } from "./render.js";
import type { MicroAppMount } from "./types.js";

export type PublishPagesOptions = {
  /** Absolute origin with no path, such as `https://willow.example`. */
  origin: string;
  /** `<html lang>`. Defaults to `en`. */
  lang?: string;
};

export type PublishedFile = {
  /** Path inside the site folder, using `/` separators. */
  path: string;
  contents: string;
};

type NavItem = {
  node: PageTreeNode;
  children: NavItem[];
};

/**
 * One HTML file per published page, plus `sitemap.xml`.
 * Prose is in the file. Micro-apps are empty mounts plus a JSON description.
 * Nav is the same tree in every file, with links relative to that file.
 */
export function publishPages(document: SiteDocument, options: PublishPagesOptions): PublishedFile[] {
  const origin = options.origin.replace(/\/$/, "");
  const lang = options.lang ?? "en";
  const tree = publishedPageTree(document);
  const pages = flattenPageTree(tree);
  const nav = visibleNav(tree);
  const files: PublishedFile[] = [];

  for (const node of pages) {
    const microApps: MicroAppMount[] = [];
    const body = renderPage({
      document,
      pageId: node.page.id,
      registry: new ComponentRegistry(),
      mountMicroApps: true,
      microApps,
    });
    const filePath = node.path ? `${node.path}/index.html` : "index.html";
    files.push({
      path: filePath,
      contents: pageHtml({
        document,
        node,
        body,
        nav,
        origin,
        lang,
        microApps,
      }),
    });
  }

  files.push({
    path: "sitemap.xml",
    contents: sitemapXml(origin, pages),
  });
  return files;
}

function visibleNav(nodes: PageTreeNode[]): NavItem[] {
  const out: NavItem[] = [];
  for (const node of nodes) {
    const children = visibleNav(node.children);
    if (node.page.showInNav === false) out.push(...children);
    else out.push({ node, children });
  }
  return out;
}

function pageHtml(input: {
  document: SiteDocument;
  node: PageTreeNode;
  body: string;
  nav: NavItem[];
  origin: string;
  lang: string;
  microApps: MicroAppMount[];
}): string {
  const { document, node, body, nav, origin, lang, microApps } = input;
  const title = `${node.page.title} · ${document.site.title}`;
  const description = node.page.description?.trim();
  const canonical = canonicalUrl(origin, node.path);
  const descriptionTag = description
    ? `\n    <meta name="description" content="${escapeHtml(description)}" />`
    : "";
  const microAppScript = microApps.length
    ? `\n    <script type="application/json" id="tessera-microapps">${escapeScriptJson(microApps)}</script>`
    : "";
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>${descriptionTag}
    <link rel="canonical" href="${escapeHtml(canonical)}" />
  </head>
  <body>
    ${renderNav(nav, node.path, node.page.id)}
    <main>
      ${body}
    </main>${microAppScript}
  </body>
</html>
`;
}

function renderNav(items: NavItem[], fromPath: string, currentId: string): string {
  if (!items.length) return "";
  return `<nav aria-label="Primary">\n${renderNavList(items, fromPath, currentId)}\n    </nav>`;
}

function renderNavList(items: NavItem[], fromPath: string, currentId: string): string {
  const rows = items
    .map((item) => {
      const current = item.node.page.id === currentId ? ` aria-current="page"` : "";
      const href = hrefFor(fromPath, item.node.path);
      const label = escapeHtml(item.node.page.title);
      const children = item.children.length
        ? `\n${renderNavList(item.children, fromPath, currentId)}`
        : "";
      return `        <li><a href="${escapeHtml(href)}"${current}>${label}</a>${children}</li>`;
    })
    .join("\n");
  return `      <ul>\n${rows}\n      </ul>`;
}

/** Link from a page's directory to another page's directory. */
export function hrefFor(fromPath: string, toPath: string): string {
  const prefix = fromPath ? "../".repeat(fromPath.split("/").length) : "./";
  return toPath ? `${prefix}${toPath}/` : prefix;
}

export function canonicalUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  return path ? `${base}/${path}/` : `${base}/`;
}

function sitemapXml(origin: string, pages: PageTreeNode[]): string {
  const urls = pages
    .map((node) => `  <url><loc>${escapeXml(canonicalUrl(origin, node.path))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Keep a `<` inside JSON from closing the script element. */
function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
