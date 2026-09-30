import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { flattenPageTree, publishedPageTree, type PageTreeNode } from "@r-a-i-t-h/tessera-model";
import { ComponentRegistry } from "./registry.js";
import { escapeHtml, renderPage, type Skin } from "./render.js";
import type { MicroAppMount } from "./types.js";

export type PublishPagesOptions = {
  /** Absolute origin with no path, such as `https://willow.example`. */
  origin: string;
  /** `<html lang>`. Defaults to `en`. */
  lang?: string;
  /** HTML catalogue. Names it does not render stay micro-app mounts. */
  registry?: ComponentRegistry;
  skin?: Skin;
  /** Stylesheet hrefs, folder-relative (`./skin/w3.css`) or absolute. */
  stylesheets?: string[];
  /** Pages runtime, folder-relative. Defaults to `./tessera-pages.js`. */
  script?: string;
};

export type PublishedFile = {
  /** Path inside the site folder, using `/` separators. */
  path: string;
  contents: string;
};

/**
 * One HTML file per published page, plus `sitemap.xml`.
 * The body is the master layout around that page. Micro-apps are empty mounts
 * plus a JSON description. Nav is whatever the master layout places.
 */
export function publishPages(document: SiteDocument, options: PublishPagesOptions): PublishedFile[] {
  const origin = options.origin.replace(/\/$/, "");
  const lang = options.lang ?? "en";
  const registry = options.registry ?? new ComponentRegistry();
  const stylesheets = options.stylesheets ?? ["./skin/w3.css", "./site.css"];
  const script = options.script ?? "./tessera-pages.js";
  const tree = publishedPageTree(document);
  const pages = flattenPageTree(tree);
  const pathById = new Map(pages.map((node) => [node.page.id, node.path]));
  const files: PublishedFile[] = [];

  for (const node of pages) {
    const microApps: MicroAppMount[] = [];
    const body = renderPage({
      document,
      pageId: node.page.id,
      registry,
      skin: options.skin,
      mountMicroApps: true,
      microApps,
      pageHref: (pageId) => hrefForPageId(pathById, node.path, pageId),
    });
    const filePath = node.path ? `${node.path}/index.html` : "index.html";
    files.push({
      path: filePath,
      contents: pageHtml({
        document,
        node,
        body,
        origin,
        lang,
        microApps,
        stylesheets,
        script,
      }),
    });
  }

  files.push({
    path: "sitemap.xml",
    contents: sitemapXml(origin, pages),
  });
  return files;
}

function pageHtml(input: {
  document: SiteDocument;
  node: PageTreeNode;
  body: string;
  origin: string;
  lang: string;
  microApps: MicroAppMount[];
  stylesheets: string[];
  script: string;
}): string {
  const { document, node, body, origin, lang, microApps, stylesheets, script } = input;
  const title = `${node.page.title} · ${document.site.title}`;
  const description = node.page.description?.trim();
  const canonical = canonicalUrl(origin, node.path);
  const descriptionTag = description
    ? `\n    <meta name="description" content="${escapeHtml(description)}" />`
    : "";
  const styleTags = stylesheets
    .map((href) => `\n    <link rel="stylesheet" href="${escapeHtml(assetHref(node.path, href))}" />`)
    .join("");
  const microAppScript = microApps.length
    ? `\n    <script type="application/json" id="tessera-microapps">${escapeScriptJson(microApps)}</script>`
    : "";
  const scriptTag = `\n    <script type="module" src="${escapeHtml(assetHref(node.path, script))}"></script>`;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>${descriptionTag}
    <link rel="canonical" href="${escapeHtml(canonical)}" />${styleTags}
  </head>
  <body>
    ${body}${microAppScript}${scriptTag}
  </body>
</html>
`;
}

function hrefForPageId(pathById: Map<string, string>, fromPath: string, pageId: string): string {
  const toPath = pathById.get(pageId);
  if (toPath === undefined) return `#${pageId}`;
  return hrefFor(fromPath, toPath);
}

/** Prefix a folder-relative asset for a page that lives `fromPath` deep. */
export function assetHref(fromPath: string, href: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || href.startsWith("/") || href.startsWith("#")) {
    return href;
  }
  const prefix = fromPath ? "../".repeat(fromPath.split("/").length) : "./";
  return `${prefix}${href.replace(/^\.\//, "")}`;
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
