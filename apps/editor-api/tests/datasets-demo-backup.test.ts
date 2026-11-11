import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseDatasetFile } from "@r-a-i-t-h/tessera-model";
import { embedDatasetsInDocument } from "../src/site/dataset-embed.js";
import { extractTar } from "../src/site/backup.js";
import { SiteStore } from "../src/site/store.js";

const demoArchive = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "demo", "datasets-demo.tar.gz");

describe("datasets demo backup", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("unpacks, parses datasets, and embeds refs for bindings", async () => {
    const site = await mkdtemp(join(tmpdir(), "tessera-datasets-demo-"));
    dirs.push(site);
    await extractTar(demoArchive, site);

    for (const id of ["people", "products", "meetings"]) {
      const { readFile } = await import("node:fs/promises");
      const raw = JSON.parse(await readFile(join(site, "datasets", `${id}.json`), "utf8"));
      expect(() => parseDatasetFile(raw)).not.toThrow();
    }

    const store = new SiteStore(join(site, "records"), join(site, "preview", "data", "site.json"));
    const doc = await store.flatten();
    expect(doc).toBeDefined();
    if (!doc) return;
    expect(doc.pages.some((p) => p.id === "orchard-tablet")).toBe(true);
    expect(doc.bindings.some((b) => b.id === "page-product" && b.props?.pageData === true)).toBe(true);
    expect(doc.bindings.some((b) => b.id === "meetings-roster-module" && b.props?.module === "demo-meetings-roster")).toBe(
      true,
    );
    expect(doc.runtimeModules?.some((m) => m.id === "demo-org-chart")).toBe(true);

    const embedded = await embedDatasetsInDocument(site, doc);
    expect(embedded.datasets?.people).toBeDefined();
    expect(embedded.datasets?.meetings).toBeDefined();
    expect(embedded.datasets?.meetings?.records).toBeDefined();
    expect(embedded.datasets?.people?.records.length).toBeGreaterThanOrEqual(5);
    const spring = embedded.datasets?.meetings?.records.find((r) => r.uid === 1);
    expect(spring?.attendees).toEqual(expect.arrayContaining([1, 2, 3, 4]));
  });
});
