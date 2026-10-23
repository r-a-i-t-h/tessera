import { describe, expect, it } from "vitest";
import { parseDatasetSchema } from "@r-a-i-t-h/tessera-model";
import {
  availableViewColumns,
  cellDisplay,
  cellDisplayMarkup,
  filterRecords,
  gridColumns,
  sortRecords,
} from "./grid.js";

const schema = parseDatasetSchema({
  fields: [
    { key: "f0", id: "title", label: "Title", kind: "string" },
    { key: "f1", id: "heldOn", label: "Held on", kind: "date" },
    { key: "f2", id: "body", label: "Body", kind: "text" },
    { key: "f3", id: "site", label: "Site", kind: "url" },
  ],
});

const record = {
  uid: 1,
  added: "2026-01-01T00:00:00.000Z",
  modified: "2026-01-01T00:00:00.000Z",
  title: "AGM",
  heldOn: "2026-10-09",
  body: "<p>Hello <strong>world</strong></p>",
};

describe("dataset grid", () => {
  it("shows no columns until view columns are chosen", () => {
    expect(gridColumns([], schema.fields)).toEqual([]);
    expect(gridColumns(["uid", "heldOn"], schema.fields).map((c) => (c.kind === "system" ? c.id : c.id))).toEqual([
      "uid",
      "heldOn",
    ]);
  });

  it("lists uid, schema fields, and timestamps as selectable columns", () => {
    expect(availableViewColumns(schema.fields)).toEqual([
      "uid",
      "title",
      "heldOn",
      "body",
      "site",
      "added",
      "modified",
    ]);
    expect(availableViewColumns([])).toEqual(["uid", "added", "modified"]);
  });

  it("shows url fields as plain text in the grid (not the published link icon)", () => {
    const columns = gridColumns(["site"], schema.fields);
    const siteCol = columns.find((c) => c.kind === "field" && c.id === "site");
    expect(siteCol).toBeTruthy();
    if (!siteCol || siteCol.kind !== "field") return;
    const urlRecord = { ...record, site: "https://example.com/page" };
    const ctx = { assetName: (id: string) => id, refTitle: () => "" };
    expect(cellDisplayMarkup(urlRecord, siteCol, ctx)).toBeUndefined();
    expect(cellDisplay(urlRecord, siteCol, ctx)).toBe("https://example.com/page");
  });

  it("shows text fields as plain text in the grid", () => {
    const columns = gridColumns(["heldOn", "body"], schema.fields);
    const bodyCol = columns.find((c) => c.kind === "field" && c.id === "body");
    expect(bodyCol).toBeTruthy();
    if (!bodyCol || bodyCol.kind !== "field") return;
    expect(cellDisplay(record, bodyCol, { assetName: (id) => id, refTitle: () => "" })).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
  });

  it("sorts by title when the column is visible", () => {
    const columns = gridColumns(["title"], schema.fields);
    const ctx = { assetName: (id: string) => id, refTitle: () => "" };
    const sorted = sortRecords(
      [
        record,
        { ...record, uid: 2, title: "Beta" },
      ],
      columns,
      { column: "title", dir: "asc" },
      ctx,
    );
    expect(sorted[0]?.title).toBe("AGM");
  });

  it("filters by title when the column is visible", () => {
    const columns = gridColumns(["title"], schema.fields);
    const ctx = { assetName: (id: string) => id, refTitle: () => "" };
    const out = filterRecords([record], columns, { title: "agm" }, ctx);
    expect(out).toHaveLength(1);
  });
});
