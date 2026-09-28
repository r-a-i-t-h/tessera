import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { authoringToZones, zonesToAuthoring } from "../src/site/document.js";
import { SiteStore } from "../src/site/store.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const siteNames = ["pure", "ineffable", "millersark", "willow"] as const;

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
    const store = new SiteStore(join(dir, "data"), flat);
    await store.writeFromDocument(original);
    const again = parseSiteDocument(JSON.parse(await readFile(flat, "utf8")));
    expect(again).toEqual(original);
    const home = await store.read("content", "home");
    expect(home.id).toBe("home");
  });

  it("stores HTML zones without JSON string escaping", async () => {
    dir = await mkdtemp(join(tmpdir(), "tessera-zone-"));
    const store = new SiteStore(dir);
    await store.write("content", "note", {
      title: "Note",
      tags: ["page"],
      zones: {
        main: { html: '<p class="lead">Hello & welcome</p>\n<p>Second line</p>' },
      },
    });
    const { readText } = await import("../src/store/fs.js");
    const yaml = await readText(join(dir, "content", "note.yaml"));
    expect(yaml).toContain("html: |");
    expect(yaml).toContain('<p class="lead">Hello & welcome</p>');
    expect(yaml).not.toContain('\\"lead\\"');
  });
});

describe("zone authoring shorthand", () => {
  it("maps a single text block to html and back", () => {
    const authored = zonesToAuthoring({
      main: [{ type: "text", html: "<p>Hi</p>" }],
    });
    expect(authored.main).toEqual({ html: "<p>Hi</p>" });
    expect(authoringToZones(authored)).toEqual({
      main: [{ type: "text", html: "<p>Hi</p>" }],
    });
  });
});
