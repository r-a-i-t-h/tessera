import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { embedDatasetsInDocument } from "../src/site/dataset-embed.js";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";

const baseDoc = (): SiteDocument => ({
  version: 2,
  site: { id: "t", title: "T", homePageId: "home", defaultLayoutId: "l" },
  layouts: [{ id: "l", root: { type: "region", role: "main", children: [{ type: "page" }] } }],
  pages: [{ id: "home", title: "Home", zones: {} }],
  items: [],
  media: [],
  folders: [],
  nav: [],
  bindings: [{ id: "list", component: "datasetTable", props: { dataset: "demo" } }],
  types: [],
  runtimeModules: [],
});

describe("embedDatasetsInDocument", () => {
  let dir = "";

  afterEach(async () => {
    dir = "";
  });

  it("embeds datasets referenced by bindings", async () => {
    dir = await mkdtemp(join(tmpdir(), "tessera-embed-"));
    const datasetsDir = join(dir, "datasets");
    await mkdir(datasetsDir, { recursive: true });
    await writeFile(
      join(datasetsDir, "demo.json"),
      JSON.stringify({
        id: "demo",
        title: "Demo",
        view: { columns: [] },
        schema: { fields: [{ key: "f1", id: "name", label: "Name", kind: "string" }] },
        nextUid: 2,
        records: [
          {
            uid: 1,
            added: "2026-01-01T00:00:00.000Z",
            modified: "2026-01-01T00:00:00.000Z",
            name: "One",
          },
        ],
      }),
      "utf8",
    );

    const doc = await embedDatasetsInDocument(dir, baseDoc());
    expect(doc.datasets?.demo?.records).toHaveLength(1);
    expect(doc.datasets?.demo?.records[0].name).toBe("One");
    expect(doc.datasets?.demo).not.toHaveProperty("nextUid");
  });
});
