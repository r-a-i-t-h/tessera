import { describe, expect, it } from "vitest";
import { parseDatasetSchema } from "@r-a-i-t-h/tessera-model";
import { availableViewColumns, cellDisplay, filterRecords, gridColumns, sortRecords } from "./grid.js";

const schema = parseDatasetSchema({
  fields: [
    { key: "f0", id: "title", label: "Title", kind: "string" },
    { key: "f1", id: "heldOn", label: "Held on", kind: "date" },
    { key: "f2", id: "body", label: "Body", kind: "html" },
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
    expect(availableViewColumns(schema.fields)).toEqual(["uid", "title", "heldOn", "body", "added", "modified"]);
    expect(availableViewColumns([])).toEqual(["uid", "added", "modified"]);
  });

  it("strips html for display", () => {
    const columns = gridColumns(["heldOn", "body"], schema.fields);
    const bodyCol = columns.find((c) => c.kind === "field" && c.id === "body");
    expect(bodyCol).toBeTruthy();
    if (!bodyCol || bodyCol.kind !== "field") return;
    expect(cellDisplay(record, bodyCol, { assetName: (id) => id, refTitle: () => "" })).toBe("Hello world");
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
