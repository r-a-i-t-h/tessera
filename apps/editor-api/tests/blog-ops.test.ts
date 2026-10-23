import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SiteStore } from "../src/site/store.js";

describe("blog ops", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function store(): Promise<SiteStore> {
    dir = await mkdtemp(join(tmpdir(), "tessera-blog-"));
    const site = new SiteStore(dir, join(dir, "out.json"));
    await site.write("layouts", "standard", { root: { type: "zone", id: "main" } });
    await site.writeSite({ version: 2, id: "demo", title: "Demo", homePageId: "home", defaultLayoutId: "standard" });
    await site.write("content", "home", { title: "Home", zones: { main: { html: "<p>Hi</p>" } } });
    return site;
  }

  it("creates an index and parents an article on its blog", async () => {
    const site = await store();
    await site.write("content", "news", {
      title: "News",
      type: "blog",
      fields: { pageSize: "10" },
      zones: { title: { html: "News" }, lead: { html: "" } },
    });
    const index = await site.read("content", "news-index");
    expect(index).toMatchObject({ type: "blog-index", parentId: "news" });
    await site.write("content", "fair", {
      title: "Fair",
      type: "article",
      parentId: "news",
      includes: ["common-footer"],
      fields: { date: "2026-07-14", precis: "Crumbs" },
      zones: { main: { html: "<p>Hi</p>" } },
    });
    const fair = await site.read("content", "fair");
    expect(fair.parentId).toBe("news");
    expect(fair.includes).toBeUndefined();
  });

  it("deletes a blog and its index when there are no articles", async () => {
    const site = await store();
    await site.write("content", "news", {
      title: "News",
      type: "blog",
      fields: { pageSize: "10" },
      zones: { title: { html: "News" } },
    });
    await site.deleteBlog("news");
    await expect(site.read("content", "news")).rejects.toThrow();
    await expect(site.read("content", "news-index")).rejects.toThrow();
  });

  it("refuses a plain delete with articles, renames references, and cascade-deletes the blog", async () => {
    const site = await store();
    await site.writeNav([{ id: "news", title: "News", sidebar: true }]);
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
    await expect(site.deleteBlog("news")).rejects.toThrow(/cascade delete/);
    await site.renameBlog("news", "willow");
    expect((await site.read("content", "fair")).parentId).toBe("willow");
    expect((await site.read("content", "willow")).id).toBe("willow");
    await site.cascadeBlog("willow");
    await expect(site.read("content", "fair")).rejects.toThrow();
    await expect(site.read("content", "willow")).rejects.toThrow();
    await expect(site.read("content", "willow-index")).rejects.toThrow();
    const nav = await readFile(join(dir, "nav.yaml"), "utf8");
    expect(nav).not.toContain("willow");
  });
});
