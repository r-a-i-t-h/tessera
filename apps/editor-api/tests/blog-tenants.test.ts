import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SiteStore } from "../src/site/store.js";

describe("blog tenants", () => {
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
    await site.write("tenants", "hall", { id: "hall" });
    await site.write("tenants", "admin", { id: "admin" });
    return site;
  }

  it("creates an index, parents an article, and refuses a second unscoped blog", async () => {
    const site = await store();
    await site.write("content", "news", {
      title: "News",
      type: "blog",
      fields: { pageSize: "10" },
      zones: { title: { html: "News" }, lead: { html: "" } },
    });
    const index = await site.read("content", "news-index");
    expect(index).toMatchObject({ type: "blog-index", parentId: "news", slug: "index" });
    await site.write("content", "fair", {
      title: "Fair",
      type: "article",
      includes: ["common-footer"],
      fields: { tenant: "hall", date: "2026-07-14", precis: "Crumbs" },
      zones: { main: { html: "<p>Hi</p>" } },
    });
    const fair = await site.read("content", "fair");
    expect(fair.parentId).toBe("news");
    expect(fair.includes).toBeUndefined();
    await expect(
      site.write("content", "other", { title: "Other", type: "blog", zones: { title: { html: "Other" } } }),
    ).rejects.toThrow(/omit a tenant/);
  });

  it("refuses a plain delete, renames references, and cascade-deletes the blog", async () => {
    const site = await store();
    await site.writeNav([{ id: "news", title: "News", sidebar: true }]);
    await site.write("content", "news", {
      title: "News",
      type: "blog",
      fields: { tenant: "hall", pageSize: "10" },
      zones: { title: { html: "News" } },
    });
    await site.write("content", "fair", {
      title: "Fair",
      type: "article",
      fields: { tenant: "hall", date: "2026-07-14" },
      zones: { main: { html: "<p>Hi</p>" } },
    });
    await expect(site.deleteTenant("hall")).rejects.toThrow(/still selected/);
    await site.renameTenant("hall", "willow");
    expect((await site.read("content", "fair")).fields).toMatchObject({ tenant: "willow" });
    expect((await site.read("content", "news")).fields).toMatchObject({ tenant: "willow" });
    await site.cascadeTenant("willow");
    await expect(site.read("tenants", "willow")).rejects.toThrow();
    await expect(site.read("content", "fair")).rejects.toThrow();
    await expect(site.read("content", "news")).rejects.toThrow();
    await expect(site.read("content", "news-index")).rejects.toThrow();
    const nav = await readFile(join(dir, "nav.yaml"), "utf8");
    expect(nav).not.toContain("news");
  });
});
