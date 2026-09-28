/**
 * One-shot converter: legacy RecTem demo JS → Tessera SiteDocument JSON.
 * Run: node scripts/convert-legacy-demos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const ref = path.join(root, ".ref-legacy");

function loadLegacyW3(sandbox) {
  const code = fs.readFileSync(path.join(ref, "js/w3css-helper.js"), "utf8");
  vm.runInNewContext(code + "\nthis.w3css = w3css;", sandbox);
}

function expandString(str, page, depth = 0) {
  if (typeof str !== "string" || depth > 8) return String(str ?? "");
  let out = str;

  // {{func:auto_title ...}}
  out = out.replace(/\{\{func:auto_title(?:\s+([^}]+))?\}\}/g, (_, arg) => {
    const a = (arg || "").trim();
    return a || page.id;
  });

  // {{func:open_days_table ...}} → marker for component injection
  out = out.replace(/\{\{func:open_days_table[^}]*\}\}/g, "[[COMPONENT:openDaysTable]]");

  // {{func:random_cells [...]||…}} → marker (items captured for props)
  out = out.replace(/\{\{func:random_cells\s+(\[[^\]]*\])[^}]*\}\}/g, (_, json) => {
    return `[[COMPONENT:randomCells:${json}]]`;
  });

  // {{zone:id ...}} — ignore wrapper templates; substitute zone content
  out = out.replace(/\{\{zone:([\w.-]+)(?:\s+[^}]*)?\}\}/g, (_, zoneId) => {
    const raw = page.content?.[zoneId];
    return flattenContent(raw, page, depth + 1);
  });

  return out;
}

function flattenContent(value, page, depth = 0) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return expandString(value, page, depth);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => flattenContent(v, page, depth)).join("");
  if (typeof value === "object") {
    // Gallery / CMS control blobs → stub HTML
    const g = value.Gallery || value;
    if (g.ImagePath) {
      return `<p class="w3-panel w3-pale-blue"><em>Gallery:</em> ${g.ImagePath}</p>`;
    }
    return `<pre class="w3-small">${JSON.stringify(value, null, 2)}</pre>`;
  }
  return String(value);
}

function contentToBlocks(html) {
  if (!html) return [];
  const blocks = [];
  const re = /\[\[COMPONENT:(openDaysTable|randomCells)(?::(\[[^\]]*\]))?\]\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) {
      blocks.push({ type: "text", html: html.slice(last, m.index) });
    }
    if (m[1] === "openDaysTable") {
      blocks.push({
        type: "component",
        name: "openDaysTable",
        props: { when: "future" },
      });
    } else {
      let items = [];
      try {
        items = JSON.parse(m[2] || "[]");
      } catch {
        items = [];
      }
      blocks.push({
        type: "component",
        name: "randomCells",
        props: { items },
      });
    }
    last = m.index + m[0].length;
  }
  if (last === 0) return [{ type: "text", html }];
  if (last < html.length) blocks.push({ type: "text", html: html.slice(last) });
  return blocks;
}

function rewriteMillersUrls(html) {
  return html
    .replace(/\/Web\/Site\//g, "https://www.millersark.co.uk/Web/Site/")
    .replace(/href="\/(?!\/)/g, 'href="https://www.millersark.co.uk/');
}

function evalItems(files, sandbox) {
  sandbox.rectem_data = sandbox.rectem_data || [];
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    // Standalone `({...})` files (ineffable pages)
    if (/^\s*\(\{/.test(code)) {
      const item = vm.runInNewContext(`(${code})`, sandbox);
      sandbox.rectem_data.push(item);
    } else {
      vm.runInNewContext(code, sandbox);
    }
  }
  return sandbox.rectem_data;
}

function evalNav(file, sandbox) {
  sandbox.nav_data = [];
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox);
  return sandbox.nav_data;
}

function pageTitle(page) {
  const t = page.content?.title ?? page.content?.PageTitle ?? "";
  if (typeof t === "string") {
    const m = t.match(/\{\{func:auto_title(?:\s+([^}]+))?\}\}/);
    if (m) return (m[1] || "").trim() || page.id;
    if (!t.includes("{{")) return t || page.id;
  }
  return page.id;
}

function convertIneffable() {
  const sandbox = {
    console,
    w3css: null,
    rectem_data: [],
    nav_data: [],
  };
  loadLegacyW3(sandbox);

  const pagesDir = path.join(ref, "demo-ineffable/data/pages");
  const pageFiles = fs.readdirSync(pagesDir).map((f) => path.join(pagesDir, f));
  evalItems(pageFiles, sandbox);
  // common footer as item only
  const footer = vm.runInNewContext(
    `(${fs.readFileSync(path.join(ref, "demo-ineffable/data/common/common-footer.js"), "utf8")})`,
    sandbox,
  );

  const nav = evalNav(path.join(ref, "demo-ineffable/data/nav.js"), sandbox);

  const pages = sandbox.rectem_data
    .filter((i) => (i.tags || "").includes("page") || pageFiles.some((f) => f.includes(`/${i.id}.js`)))
    .map((page) => {
      const title = pageTitle(page);
      let mainHtml = flattenContent(page.content?.main, { ...page, content: page.content });
      // also expand any leftover zone keys that were only used inside main
      mainHtml = expandString(mainHtml, page);
      return {
        id: page.id === "ineffable" ? "home" : page.id,
        title: title === "ineffable" ? "ineffable" : title,
        layoutId: "standard",
        tags: ["page"],
        includes: ["common-footer"],
        zones: {
          title: [{ type: "text", html: title === "ineffable" ? "ineffable" : title }],
          main: contentToBlocks(mainHtml),
        },
      };
    });

  // home id was ineffable
  const home = pages.find((p) => p.id === "home");
  if (home) home.title = "ineffable";

  const doc = {
    version: 1,
    site: {
      id: "ineffable",
      title: "ineffable.co.uk",
      homePageId: "home",
      theme: "deep-purple",
    },
    layouts: [
      {
        id: "standard",
        title: "Standard",
        root: {
          type: "region",
          role: "content",
          children: [
            {
              type: "region",
              role: "main",
              children: [
                {
                  type: "region",
                  tag: "h1",
                  className: "w3-text-theme",
                  children: [{ type: "zone", id: "title" }],
                },
                { type: "zone", id: "main" },
              ],
            },
            {
              type: "region",
              tag: "footer",
              role: "footer",
              className: "w3-theme-l3 w3-margin-top",
              children: [{ type: "zone", id: "footer" }],
            },
          ],
        },
      },
    ],
    items: [
      {
        id: "common-footer",
        zones: {
          footer: [
            {
              type: "text",
              html: expandString(footer.content.footer, footer).replace(
                /rec-tem/g,
                "tessera",
              ),
            },
          ],
        },
      },
    ],
    pages,
    media: [],
    nav: nav.map((n) => {
      const id = n.id === "" || n.id == null ? (n.heading ? undefined : "home") : n.id;
      return {
        sidebar: n.sidebar,
        topbar: n.topbar,
        heading: n.heading,
        fa: n.fa,
        title: n.title,
        id: n.heading ? undefined : id === "ineffable" ? "home" : id,
      };
    }),
  };

  // Fix nav home entry
  for (const n of doc.nav) {
    if (n.title === "ineffable" || n.id === "ineffable") n.id = "home";
    if (n.id === "rectem") {
      n.title = "tessera";
    }
  }

  // Update rectem page copy slightly
  const rectem = doc.pages.find((p) => p.id === "rectem");
  if (rectem) {
    rectem.id = "tessera";
    rectem.title = "tessera";
    rectem.zones.title = [{ type: "text", html: "tessera" }];
    const main = rectem.zones.main?.[0];
    if (main?.type === "text") {
      main.html = main.html
        .replace(/Rec-tem/g, "Tessera")
        .replace(/rec-tem/g, "tessera")
        .replace(/Recursive Templates/g, "zone-based site tiles");
    }
  }
  for (const n of doc.nav) {
    if (n.id === "rectem") n.id = "tessera";
  }

  return doc;
}

function convertMillersark() {
  const sandbox = {
    console,
    w3css: null,
    rectem_data: [],
    nav_data: [],
    site_data: {},
  };
  loadLegacyW3(sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(ref, "js/helpers.js"), "utf8"), sandbox);
  vm.runInNewContext(
    fs.readFileSync(path.join(ref, "demo-millersark/data/dynamic.js"), "utf8"),
    sandbox,
  );

  evalItems(
    [
      path.join(ref, "demo-millersark/data/pages.js"),
      path.join(ref, "demo-millersark/data/pages-converted.js"),
    ],
    sandbox,
  );

  const nav = evalNav(path.join(ref, "demo-millersark/data/nav.js"), sandbox);
  const openDays = sandbox.site_data.open_days || [];

  const pages = sandbox.rectem_data
    .filter((i) => (i.tags || "").includes("page"))
    .map((page) => {
      const titleRaw = page.content?.PageTitle || page.id;
      const title =
        typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : page.id;

      const chunks = [];
      for (const key of [
        "PageHeader",
        "OpenDayDates",
        "LatestNews",
        "MainContent",
        "SideContent",
        "SaleContent",
        "GalleryControl",
        "SaleGallery",
      ]) {
        if (page.content?.[key] == null || page.content[key] === "") continue;
        let html = flattenContent(page.content[key], page);
        html = rewriteMillersUrls(html);
        chunks.push(...contentToBlocks(html));
      }

      return {
        id: page.id,
        title,
        layoutId: "standard",
        tags: ["page"],
        includes: ["common-footer"],
        zones: {
          title: [{ type: "text", html: title }],
          main: chunks.length ? chunks : [{ type: "text", html: "<p></p>" }],
        },
      };
    });

  return {
    version: 1,
    site: {
      id: "millersark",
      title: "Miller's Ark",
      homePageId: "home",
      theme: "indigo",
      settings: { openDays },
    },
    layouts: [
      {
        id: "standard",
        root: {
          type: "region",
          role: "content",
          children: [
            {
              type: "region",
              role: "main",
              children: [
                {
                  type: "region",
                  tag: "h1",
                  className: "w3-text-theme",
                  children: [{ type: "zone", id: "title" }],
                },
                { type: "zone", id: "main" },
              ],
            },
            {
              type: "region",
              tag: "footer",
              role: "footer",
              className: "w3-theme-l3 w3-margin-top",
              children: [{ type: "zone", id: "footer" }],
            },
          ],
        },
      },
    ],
    items: [
      {
        id: "common-footer",
        zones: {
          footer: [
            {
              type: "text",
              html: `<div class="w3-right w3-container w3-xlarge w3-text-white"><a href="#" onclick="window.scrollTo(0, 0); return false;"><i class="fa fa-chevron-circle-up"></i></a></div>
                <p>&copy; Miller's Ark</p><p class="w3-tiny">@raith :: &lt;tessera&gt; + &lt;w3-css&gt;</p>`,
            },
          ],
        },
      },
    ],
    pages,
    media: [],
    nav: nav
      .filter((n) => n.sidebar || n.heading || n.topbar)
      .map((n) => ({
        sidebar: !!n.sidebar,
        topbar: !!n.topbar,
        heading: n.heading,
        fa: n.fa,
        title: n.title,
        id: n.id || undefined,
      })),
  };
}

function writeDoc(outPath, doc) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
  console.log("Wrote", outPath, `(${doc.pages.length} pages)`);
}

const ineffable = convertIneffable();
writeDoc(path.join(root, "sites/ineffable/publish/data/site.json"), ineffable);

const millers = convertMillersark();
writeDoc(path.join(root, "sites/millersark/publish/data/site.json"), millers);

console.log("Done.");
