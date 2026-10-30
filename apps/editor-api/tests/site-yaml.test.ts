import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { contentZones, zoneBlocks } from "./fixtures/content-zones.js";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { authoringToZones, itemZonesToAuthoring, pageZonesToAuthoring } from "../src/site/document.js";
import { SiteStore } from "../src/site/store.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const siteNames = [] as const;

describe("site YAML flatten", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it.each(siteNames)("round-trips the %s document through YAML files", async (name) => {
    dir = await mkdtemp(join(tmpdir(), "tessera-site-"));
    const siteJson = join(repoRoot, "sites", name, "publish", "data", "site.json");
    const original = parseSiteDocument(JSON.parse(await readFile(siteJson, "utf8")));
    const flat = join(dir, "site.json");
    const store = new SiteStore(join(dir, "records"), flat);
    await store.writeFromDocument(original);
    const again = parseSiteDocument(JSON.parse(await readFile(flat, "utf8")));
    expect(again).toEqual(original);
    const home = await store.read("content", "home");
    expect(home.id).toBe("home");
  });

  it("drops legacy showInNav on content save", async () => {
    dir = await mkdtemp(join(tmpdir(), "tessera-showinnav-"));
    const store = new SiteStore(dir);
    await store.write("content", "home", {
      title: "Home",
      showInNav: false,
      zones: contentZones("<p>Hi</p>"),
    });
    const record = await store.read("content", "home");
    expect(record).not.toHaveProperty("showInNav");
    const { readText } = await import("../src/store/fs.js");
    const yaml = await readText(join(dir, "content", "home.yaml"));
    expect(yaml).not.toMatch(/showInNav/);
  });

  it("persists widget blocks in YAML without escaped quotes in html fields", async () => {
    dir = await mkdtemp(join(tmpdir(), "tessera-zone-"));
    const store = new SiteStore(dir);
    await store.write("content", "note", {
      title: "Note",
      tags: ["page"],
      zones: {
        main: zoneBlocks('<p class="lead">Hello & welcome</p>\n<p>Second line</p>'),
      },
    });
    const { readText } = await import("../src/store/fs.js");
    const yaml = await readText(join(dir, "content", "note.yaml"));
    expect(yaml).toContain("blocks:");
    expect(yaml).toContain("kind:");
    expect(yaml).toContain("Hello &amp; welcome");
    expect(yaml).not.toContain('\\"lead\\"');
  });
});

describe("zone authoring round-trip", () => {
  it("maps flattened text blocks to page widget blocks and item html shorthand", () => {
    expect(
      pageZonesToAuthoring({
        main: [{ type: "text", html: "<p>Hi</p>" }],
      }).main,
    ).toEqual(zoneBlocks("<p>Hi</p>"));
    expect(
      itemZonesToAuthoring({
        main: [{ type: "text", html: "<p>Hi</p>" }],
      }).main,
    ).toEqual({ html: "<p>Hi</p>" });
    expect(
      authoringToZones(
        itemZonesToAuthoring({
          main: [{ type: "text", html: "<p>Hi</p>" }],
        }),
      ),
    ).toEqual({
      main: [{ type: "text", html: "<p>Hi</p>" }],
    });
  });
});
