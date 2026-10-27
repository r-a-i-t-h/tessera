import { describe, expect, it } from "vitest";
import { parseDatasetSchema } from "@r-a-i-t-h/tessera-model";
import { ComponentRegistry, type RenderContext } from "@r-a-i-t-h/tessera-renderer";
import { datasetColumnAlign, datasetRowTitle, resolveCardHeadingField } from "./dataset-payload.js";
import { datasetCards, datasetTable } from "./dataset-present.js";
import { registerExtras } from "./index.js";

describe("dataset presentations", () => {
  it("assigns column alignment from field kind", () => {
    const snapshot = {
      id: "t",
      title: "T",
      view: { columns: [] },
      schema: parseDatasetSchema({
        fields: [
          { key: "f1", id: "name", label: "Name", kind: "string" },
          { key: "f2", id: "qty", label: "Qty", kind: "number" },
          { key: "f3", id: "when", label: "When", kind: "date" },
        ],
      }),
      records: [],
    };
    expect(datasetColumnAlign("name", snapshot)).toBe("left");
    expect(datasetColumnAlign("qty", snapshot)).toBe("right");
    expect(datasetColumnAlign("when", snapshot)).toBe("center");
    expect(datasetColumnAlign("uid", snapshot)).toBe("right");
    expect(datasetColumnAlign("added", snapshot)).toBe("center");
  });

  it("resolves card heading to the first column by default", () => {
    const columns = [
      { id: "name", label: "Name", sortable: true, align: "left" as const },
      { id: "qty", label: "Qty", sortable: true, align: "right" as const },
    ];
    expect(resolveCardHeadingField(columns)).toBe("name");
    expect(resolveCardHeadingField(columns, "qty")).toBe("qty");
    expect(resolveCardHeadingField(columns, "missing")).toBe("name");
  });

  it("uses column values for list titles when display name is unset", () => {
    const columns = [{ id: "label", label: "Label", sortable: true, align: "left" as const }];
    expect(
      datasetRowTitle(
        { uid: 1, displayName: "#1", values: { label: "Alpha" } },
        { columns },
      ),
    ).toBe("Alpha");
    expect(
      datasetRowTitle(
        { uid: 2, displayName: "Custom", values: { label: "Beta" } },
        { columns },
      ),
    ).toBe("Custom");
  });

  it("marks url columns for icon rendering in the client payload", () => {
    const registry = new ComponentRegistry();
    registerExtras((name, fn) => registry.define(name, fn));
    const html = datasetTable(
      {
        document: {
          version: 2,
          site: { id: "t", title: "T", homePageId: "home", defaultLayoutId: "l" },
          layouts: [{ id: "l", root: { type: "region", role: "main", children: [{ type: "page" }] } }],
          pages: [{ id: "home", title: "Home", zones: {} }],
          datasets: {
            items: {
              id: "items",
              title: "Items",
              view: { columns: ["site"], displayName: "" },
              schema: parseDatasetSchema({
                fields: [{ key: "f1", id: "site", label: "Site", kind: "url" }],
              }),
              records: [
                {
                  uid: 1,
                  added: "2026-01-01T00:00:00.000Z",
                  modified: "2026-01-01T00:00:00.000Z",
                  site: "https://example.com",
                },
              ],
            },
          },
          items: [],
          media: [],
          folders: [],
          nav: [],
          bindings: [],
          types: [],
          runtimeModules: [],
        },
        page: { id: "home", title: "Home", zones: {} },
        profile: { layoutId: "l", layoutSource: "site" },
        zones: new Map(),
        registry,
        renderBlocks: () => "",
        zoneJson: () => [],
        mediaHtml: () => "",
        escapeHtml: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
      },
      { dataset: "items", fields: ["site"] },
    );
    const json = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    expect(json).toBeTruthy();
    const payload = JSON.parse(json!) as {
      columns: { id: string; cellFormat?: string }[];
      rows: { richValues?: Record<string, string> }[];
    };
    expect(payload.columns.find((c) => c.id === "site")?.cellFormat).toBe("url");
    expect(payload.rows[0]?.richValues?.site).toContain("tessera-dataset-url");
  });

  it("emits a client component with processed JSON instead of static rows", () => {
    const registry = new ComponentRegistry();
    registerExtras((name, fn) => registry.define(name, fn));

    const html = datasetTable(
      {
        document: {
          version: 2,
          site: { id: "t", title: "T", homePageId: "home", defaultLayoutId: "l" },
          layouts: [{ id: "l", root: { type: "region", role: "main", children: [{ type: "page" }] } }],
          pages: [{ id: "home", title: "Home", zones: {} }],
          datasets: {
            items: {
              id: "items",
              title: "Items",
              view: { columns: ["label"], displayName: "{label}" },
              schema: parseDatasetSchema({
                fields: [{ key: "f1", id: "label", label: "Label", kind: "string" }],
              }),
              records: [
                {
                  uid: 1,
                  added: "2026-01-01T00:00:00.000Z",
                  modified: "2026-01-01T00:00:00.000Z",
                  label: "Alpha",
                },
              ],
            },
          },
          items: [],
          media: [],
          folders: [],
          nav: [],
          bindings: [],
          types: [],
          runtimeModules: [],
        },
        page: { id: "home", title: "Home", zones: {} },
        profile: { layoutId: "l", layoutSource: "site" },
        zones: new Map(),
        registry,
        renderBlocks: () => "",
        zoneJson: () => [],
        mediaHtml: () => "",
        escapeHtml: (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
      },
      { dataset: "items", fields: ["label"], sort: { field: "label", dir: "asc" }, interactiveSort: true },
    );

    expect(html).toContain("<tessera-dataset-table");
    expect(html).toContain('"interactiveSort":true');
    expect(html).toContain("Alpha");
    expect(html).not.toContain("<tbody>");
  });

  it("passes frame colour into the cards payload", () => {
    const registry = new ComponentRegistry();
    registerExtras((name, fn) => registry.define(name, fn));
    const ctx: RenderContext = {
      document: {
        version: 2,
        site: { id: "t", title: "T", homePageId: "home", defaultLayoutId: "l" },
        layouts: [{ id: "l", root: { type: "region", role: "main", children: [{ type: "page" }] } }],
        pages: [{ id: "home", title: "Home", zones: {} }],
        datasets: {
          items: {
            id: "items",
            title: "Items",
            view: { columns: ["label"], displayName: "{label}" },
            schema: parseDatasetSchema({
              fields: [{ key: "f1", id: "label", label: "Label", kind: "string" }],
            }),
            records: [
              {
                uid: 1,
                added: "2026-01-01T00:00:00.000Z",
                modified: "2026-01-01T00:00:00.000Z",
                label: "Alpha",
              },
            ],
          },
        },
        items: [],
        media: [],
        folders: [],
        nav: [],
        bindings: [],
        types: [],
        runtimeModules: [],
      },
      page: { id: "home", title: "Home", zones: {} },
      profile: { layoutId: "l", layoutSource: "site" },
      zones: new Map(),
      registry,
      renderBlocks: () => "",
      zoneJson: () => [],
      mediaHtml: () => "",
      escapeHtml: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    };
    const html = datasetCards(ctx, {
      dataset: "items",
      fields: ["label"],
      frameColor: "rgba(0, 0, 0, 0.55)",
    });
    const json = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    expect(json).toBeTruthy();
    const payload = JSON.parse(json!) as { frameColor?: string };
    expect(payload.frameColor).toBe("rgba(0, 0, 0, 0.55)");
  });

  it("shows the binding empty message when the query returns no rows", () => {
    const registry = new ComponentRegistry();
    registerExtras((name, fn) => registry.define(name, fn));
    const ctx: RenderContext = {
      document: {
        version: 2,
        site: { id: "t", title: "T", homePageId: "home", defaultLayoutId: "l" },
        layouts: [{ id: "l", root: { type: "region", role: "main", children: [{ type: "page" }] } }],
        pages: [{ id: "home", title: "Home", zones: {} }],
        datasets: {
          items: {
            id: "items",
            title: "Items",
            view: { columns: ["label"], displayName: "{label}" },
            schema: parseDatasetSchema({
              fields: [{ key: "f1", id: "label", label: "Label", kind: "string" }],
            }),
            records: [],
          },
        },
        items: [],
        media: [],
        folders: [],
        nav: [],
        bindings: [],
        types: [],
        runtimeModules: [],
      },
      page: { id: "home", title: "Home", zones: {} },
      profile: { layoutId: "l", layoutSource: "site" },
      zones: new Map(),
      registry,
      renderBlocks: () => "",
      zoneJson: () => [],
      mediaHtml: () => "",
      escapeHtml: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    };
    expect(datasetTable(ctx, { dataset: "items", empty: "No matches." })).toContain("No matches.");
    expect(datasetTable(ctx, { dataset: "items" })).toBe("");
  });
});
