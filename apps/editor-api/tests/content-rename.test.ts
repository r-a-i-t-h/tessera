import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pageHistoryPath } from "../src/site/history.js";
import { SiteStore } from "../src/site/store.js";

describe("content rename", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function store(): Promise<SiteStore> {
    dir = await mkdtemp(join(tmpdir(), "tessera-rename-"));
    const site = new SiteStore(dir, join(dir, "out.json"));
    await site.write("layouts", "standard", { root: { type: "zone", id: "main" } });
    await site.writeSite({ version: 2, id: "demo", title: "Demo", homePageId: "home", defaultLayoutId: "standard" });
    await site.write("content", "home", { title: "Home", zones: { main: { html: "<p>Hi</p>" } } });
    return site;
  }

  it("renames a page, rewrites children, nav, home, and history", async () => {
    const site = await store();
    await site.writeNav([{ id: "about", title: "About", sidebar: true }]);
    await site.write("content", "about", {
      title: "About",
      zones: { main: { html: "<p>About</p>" } },
    });
    await site.write("content", "team", {
      title: "Team",
      parentId: "about",
      zones: { main: { html: "<p>Team</p>" } },
    });
    await site.write("content", "about", {
      title: "About us",
      zones: { main: { html: "<p>About us</p>" } },
    });
    const historyFile = pageHistoryPath(dir, "about");
    await expect(readFile(historyFile, "utf8")).resolves.toContain("About");

    await site.renameContent("about", "story");
    expect((await site.read("content", "story")).title).toBe("About us");
    await expect(site.read("content", "about")).rejects.toThrow();
    expect((await site.read("content", "team")).parentId).toBe("story");
    const nav = await readFile(join(dir, "nav.yaml"), "utf8");
    expect(nav).toContain("id: story");
    expect(nav).not.toMatch(/id: about\b/);
    await expect(readFile(historyFile, "utf8")).rejects.toThrow();
    await expect(readFile(pageHistoryPath(dir, "story"), "utf8")).resolves.toContain("About");
  });

  it("renames an article without changing its blog parent", async () => {
    const site = await store();
    await site.write("content", "news", {
      title: "News",
      type: "blog",
      fields: { pageSize: "10" },
      zones: { title: { html: "News" } },
    });
    await site.write("content", "fair", {
      title: "Fair",
      type: "article",
      parentId: "news",
      fields: { date: "2026-07-14" },
      zones: { main: { html: "<p>Hi</p>" } },
    });
    await site.renameContent("fair", "summer-fair");
    const article = await site.read("content", "summer-fair");
    expect(article.parentId).toBe("news");
    await expect(site.read("content", "fair")).rejects.toThrow();
  });

  it("refuses to rename a blog index directly", async () => {
    const site = await store();
    await site.write("content", "news", {
      title: "News",
      type: "blog",
      fields: { pageSize: "10" },
      zones: { title: { html: "News" } },
    });
    await expect(site.renameContent("news-index", "index")).rejects.toThrow(/blog instead/i);
  });

  it("rewrites data-tessera-page refs in other pages and binding hrefs", async () => {
    const site = await store();
    await site.write("content", "about", {
      title: "About",
      zones: { main: { html: "<p>About</p>" } },
    });
    await site.write("content", "home", {
      title: "Home",
      zones: {
        main: { html: `<p>See <a data-tessera-page="about" href="#">About</a>.</p>` },
      },
    });
    await site.write("bindings", "banner", {
      component: "imageRevealGallery",
      props: { items: [{ url: "./media/a.jpg", href: "about", title: "About" }] },
    });
    await site.renameContent("about", "story");
    const home = await site.read("content", "home");
    const main = (home.zones as Record<string, { html?: string }>).main;
    expect(main?.html).toContain('data-tessera-page="story"');
    expect(main?.html).not.toContain('data-tessera-page="about"');
    const binding = await site.read("bindings", "banner");
    const items = (binding.props as { items: { href: string }[] }).items;
    expect(items[0]?.href).toBe("story");
  });
});
