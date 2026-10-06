/**
 * @vitest-environment happy-dom
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { emitDist } from "../src/site/dist.js";
import { SiteStore } from "../src/site/store.js";

const document = parseSiteDocument({
  version: 2,
  site: {
    id: "hall",
    title: "Hall",
    homePageId: "home",
    masterLayoutId: "master",
    defaultLayoutId: "page",
    origin: "https://hall.example",
  },
  layouts: [
    {
      id: "master",
      root: { type: "region", children: [{ type: "static", html: "<header>Hall</header>" }, { type: "page" }] },
    },
    {
      id: "page",
      root: { type: "region", role: "main", children: [{ type: "zone", id: "main" }] },
    },
  ],
  pages: [
    {
      id: "home",
      title: "Home",
      zones: { main: [{ type: "text", html: "<p>Welcome</p>" }] },
    },
    {
      id: "about",
      title: "About",
      parentId: "home",
      zones: { main: [{ type: "text", html: "<p>About</p>" }] },
    },
  ],
});

describe("emitDist", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function target(delivery: "pages" | "snapshot") {
    const root = await mkdtemp(join(tmpdir(), "tessera-dist-"));
    dirs.push(root);
    const bundleDir = join(root, "bundle");
    const skinDir = join(root, "skin");
    await mkdir(bundleDir, { recursive: true });
    await mkdir(skinDir, { recursive: true });
    await mkdir(join(root, "shell"), { recursive: true });
    await writeFile(join(bundleDir, "tessera.js"), "export {}\n");
    await writeFile(join(bundleDir, "tessera-pages.js"), "export {}\n");
    await writeFile(join(skinDir, "w3.css"), "body{}\n");
    await writeFile(
      join(root, "shell", "index.html"),
      `<meta name="tessera-site" content="./data/site.json" />\n<link rel="stylesheet" href="./skin/w3.css" />\n<link rel="stylesheet" href="./site.css" />\n`,
    );
    await writeFile(join(root, "shell", "site.css"), "body{margin:0}\n");
    await writeFile(join(root, "publish", "old", "index.html"), "<p>old</p>\n").catch(async () => {
      await mkdir(join(root, "publish", "old"), { recursive: true });
      await writeFile(join(root, "publish", "old", "index.html"), "<p>old</p>\n");
    });
    await mkdir(join(root, "publish", "media"), { recursive: true });
    await writeFile(join(root, "publish", "media", "logo.svg"), "<svg></svg>\n");
    return {
      document: parseSiteDocument({ ...document, site: { ...document.site, delivery } }),
      target: {
        publishDir: join(root, "publish"),
        shellIndex: join(root, "shell", "index.html"),
        bundleDir,
        skinDir,
      },
      root,
    };
  }

  it("writes one HTML file per page and drops a stale page", async () => {
    const fixture = await target("pages");
    const report = await emitDist(fixture.document, fixture.target);
    expect(report.flavour).toBe("pages");
    expect(report.pages).toBe(2);
    const home = await readFile(join(fixture.root, "publish", "index.html"), "utf8");
    expect(home).toContain("<p>Welcome</p>");
    expect(home).toContain('href="./skin/w3.css"');
    expect(home).toContain('src="./tessera-pages.js"');
    const about = await readFile(join(fixture.root, "publish", "about", "index.html"), "utf8");
    expect(about).toContain("<p>About</p>");
    expect(about).toContain('href="../skin/w3.css"');
    await expect(readFile(join(fixture.root, "publish", "old", "index.html"), "utf8")).rejects.toThrow();
    expect(await readFile(join(fixture.root, "publish", "media", "logo.svg"), "utf8")).toContain("svg");
    expect(await readFile(join(fixture.root, "publish", "sitemap.xml"), "utf8")).toContain("https://hall.example/about/");
  });

  it("refuses a pages dist without an origin and leaves publish untouched", async () => {
    const fixture = await target("pages");
    const doc = parseSiteDocument({ ...fixture.document, site: { ...fixture.document.site, origin: undefined } });
    await expect(emitDist(doc, fixture.target)).rejects.toThrow(/origin/);
    expect(await readFile(join(fixture.root, "publish", "old", "index.html"), "utf8")).toContain("old");
  });

  it("prefixes canonicals and the sitemap with an origin folder", async () => {
    const fixture = await target("pages");
    const doc = parseSiteDocument({
      ...fixture.document,
      site: { ...fixture.document.site, origin: "https://hall.example/willow" },
    });
    await emitDist(doc, fixture.target);
    const home = await readFile(join(fixture.root, "publish", "index.html"), "utf8");
    const about = await readFile(join(fixture.root, "publish", "about", "index.html"), "utf8");
    const sitemap = await readFile(join(fixture.root, "publish", "sitemap.xml"), "utf8");
    expect(home).toContain('href="https://hall.example/willow/"');
    expect(about).toContain('href="https://hall.example/willow/about/"');
    expect(sitemap).toContain("https://hall.example/willow/");
    expect(sitemap).toContain("https://hall.example/willow/about/");
  });

  it("refuses a pages dist whose origin has a query or hash and leaves publish untouched", async () => {
    for (const origin of ["https://hall.example/willow?x=1", "https://hall.example/willow#top"]) {
      const fixture = await target("pages");
      const doc = parseSiteDocument({ ...fixture.document, site: { ...fixture.document.site, origin } });
      await expect(emitDist(doc, fixture.target)).rejects.toThrow(/query or hash/);
      expect(await readFile(join(fixture.root, "publish", "old", "index.html"), "utf8")).toContain("old");
    }
  });

  it("keeps publish untouched until publish() is asked", async () => {
    const fixture = await target("pages");
    const records = join(fixture.root, "records");
    const store = new SiteStore(
      records,
      join(fixture.root, "preview", "data", "site.json"),
      async () => 0,
      join(fixture.root, "history"),
      fixture.target,
    );
    await store.writeFromDocument(fixture.document);
    expect(await readFile(join(fixture.root, "preview", "data", "site.json"), "utf8")).toContain("Welcome");
    expect(await readFile(join(fixture.root, "publish", "old", "index.html"), "utf8")).toContain("old");
    const report = await store.publish();
    expect(report.dist.flavour).toBe("pages");
    expect(await readFile(join(fixture.root, "publish", "index.html"), "utf8")).toContain("Welcome");
  });

  it("writes a snapshot dist and removes page directories", async () => {
    const fixture = await target("snapshot");
    const report = await emitDist(fixture.document, fixture.target);
    expect(report.flavour).toBe("snapshot");
    expect(report.snapshot?.file).toMatch(/^site\.[a-f0-9]+\.json$/);
    const index = await readFile(join(fixture.root, "publish", "index.html"), "utf8");
    expect(index).toContain(`./data/${report.snapshot?.file}`);
    const shell = await readFile(join(fixture.root, "shell", "index.html"), "utf8");
    expect(shell).toContain("./data/site.json");
    await expect(readFile(join(fixture.root, "publish", "old", "index.html"), "utf8")).rejects.toThrow();
    expect(await readFile(join(fixture.root, "publish", "media", "logo.svg"), "utf8")).toContain("svg");
  });
});
