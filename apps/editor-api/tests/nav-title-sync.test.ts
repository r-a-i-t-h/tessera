import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contentZones } from "./fixtures/content-zones.js";
import { SiteStore } from "../src/site/store.js";

describe("nav title sync on content save", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function store(): Promise<SiteStore> {
    dir = await mkdtemp(join(tmpdir(), "tessera-nav-title-"));
    const site = new SiteStore(dir, join(dir, "out.json"));
    await site.write("layouts", "standard", { root: { type: "zone", id: "main" } });
    await site.writeSite({ version: 2, id: "demo", title: "Demo", homePageId: "home", defaultLayoutId: "standard" });
    await site.write("content", "home", { title: "Home", zones: contentZones("<p>Hi</p>") });
    return site;
  }

  it("updates nav yaml when a mirrored page title changes", async () => {
    const site = await store();
    await site.writeNav([{ id: "about", title: "About", sidebar: true }]);
    await site.write("content", "about", {
      title: "About",
      zones: contentZones("<p>About</p>"),
    });
    await site.write("content", "about", {
      title: "About us",
      zones: contentZones("<p>About us</p>"),
    });
    const nav = await readFile(join(dir, "nav.yaml"), "utf8");
    expect(nav).toContain("title: About us");
    expect(nav).not.toContain("title: About\n");
  });

  it("preserves a custom nav label when the page title changes", async () => {
    const site = await store();
    await site.writeNav([{ id: "about", title: "Who we are", sidebar: true }]);
    await site.write("content", "about", {
      title: "About",
      zones: contentZones("<p>About</p>"),
    });
    await site.write("content", "about", {
      title: "About us",
      zones: contentZones("<p>About us</p>"),
    });
    const nav = await readFile(join(dir, "nav.yaml"), "utf8");
    expect(nav).toContain("title: Who we are");
    expect(nav).not.toContain("About us");
  });

  it("updates a nested nav link under a heading", async () => {
    const site = await store();
    await site.writeNav([
      {
        heading: "Company",
        sidebar: true,
        children: [{ id: "about", title: "About", sidebar: true }],
      },
    ]);
    await site.write("content", "about", {
      title: "About",
      zones: contentZones("<p>About</p>"),
    });
    await site.write("content", "about", {
      title: "About us",
      zones: contentZones("<p>About us</p>"),
    });
    const nav = await readFile(join(dir, "nav.yaml"), "utf8");
    expect(nav).toContain("title: About us");
  });

  it("syncs titles on writeRaw", async () => {
    const site = await store();
    await site.writeNav([{ id: "about", title: "About", sidebar: true }]);
    await site.write("content", "about", {
      title: "About",
      zones: contentZones("<p>About</p>"),
    });
    const raw = await site.readRaw("content", "about");
    await site.writeRaw("content", "about", raw.replace(/^title: About$/m, "title: About us"));
    const nav = await readFile(join(dir, "nav.yaml"), "utf8");
    expect(nav).toContain("title: About us");
  });
});
