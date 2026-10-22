import { describe, expect, it } from "vitest";
import { parseDatasetSchema } from "../dataset.js";
import { collectBindingDatasetIds, queryDatasetRecords, type DatasetSnapshot } from "../dataset-query.js";

const branches: DatasetSnapshot = {
  id: "branches",
  title: "Branches",
  view: { columns: ["name", "city"], displayName: "{name}" },
  schema: parseDatasetSchema({
    fields: [
      { key: "f1", id: "name", label: "Name", kind: "string" },
      { key: "f2", id: "city", label: "City", kind: "string" },
      { key: "f3", id: "open", label: "Open", kind: "boolean" },
    ],
  }),
  records: [
    {
      uid: 1,
      added: "2026-01-01T00:00:00.000Z",
      modified: "2026-01-01T00:00:00.000Z",
      name: "North",
      city: "York",
      open: true,
    },
    {
      uid: 2,
      added: "2026-01-01T00:00:00.000Z",
      modified: "2026-01-01T00:00:00.000Z",
      name: "South",
      city: "London",
      open: false,
    },
  ],
};

describe("queryDatasetRecords", () => {
  it("sorts, limits, and filters", () => {
    const result = queryDatasetRecords(
      { branches },
      {
        dataset: "branches",
        sort: { field: "name", dir: "desc" },
        limit: 1,
        filter: [{ field: "open", op: "eq", value: true }],
        fields: ["name", "city"],
      },
    );
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0].displayName).toBe("North");
    expect(result?.rows[0].fields.map((f) => f.text)).toEqual(["North", "York"]);
  });
});

describe("collectBindingDatasetIds", () => {
  it("reads dataset prop from dataset components only", () => {
    const ids = collectBindingDatasetIds({
      bindings: [
        { id: "a", component: "datasetTable", props: { dataset: "branches" } },
        { id: "b", component: "datedList", props: { dataset: "ignored" } },
      ],
    });
    expect(ids).toEqual(["branches"]);
  });
});
