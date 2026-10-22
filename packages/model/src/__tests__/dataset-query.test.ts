import { describe, expect, it } from "vitest";
import { parseDatasetSchema } from "../dataset.js";
import {
  collectBindingDatasetIds,
  parseDatasetFilters,
  queryDatasetRecords,
  type DatasetSnapshot,
} from "../dataset-query.js";

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

  it("ANDs multiple filters and treats hasValue like notEmpty", () => {
    const result = queryDatasetRecords(
      { branches },
      {
        dataset: "branches",
        filter: [
          { field: "open", op: "hasValue" },
          { field: "city", op: "neq", value: "London" },
        ],
      },
    );
    expect(result?.rows.map((r) => r.displayName)).toEqual(["North"]);
  });

  it("matches empty, false, and zero for hasValue", () => {
    const snap: DatasetSnapshot = {
      ...branches,
      records: [
        { uid: 1, added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", name: "", open: false },
        { uid: 2, added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", name: "x", open: false },
        { uid: 3, added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", name: "n", city: "Y" },
      ],
    };
    const emptyOnly = queryDatasetRecords({ branches: snap }, { dataset: "branches", filter: [{ field: "name", op: "empty" }] });
    expect(emptyOnly?.rows.map((r) => r.uid)).toEqual([1]);
    const hasName = queryDatasetRecords({ branches: snap }, { dataset: "branches", filter: [{ field: "name", op: "hasValue" }] });
    expect(hasName?.rows.map((r) => r.uid)).toEqual([2, 3]);
    const openFalse = queryDatasetRecords({ branches: snap }, { dataset: "branches", filter: [{ field: "open", op: "hasValue" }] });
    expect(openFalse?.rows.map((r) => r.uid)).toEqual([1, 2]);
  });

  it("filters date fields with future and past relative to asOf", () => {
    const events: DatasetSnapshot = {
      id: "events",
      title: "Events",
      view: { columns: ["when"], displayName: "{when}" },
      schema: parseDatasetSchema({
        fields: [{ key: "f1", id: "when", label: "When", kind: "date" }],
      }),
      records: [
        { uid: 1, added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", when: "2026-10-21" },
        { uid: 2, added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", when: "2026-10-22" },
        { uid: 3, added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", when: "2026-10-23" },
      ],
    };
    const asOf = new Date(2026, 9, 22, 12, 0, 0);
    const past = queryDatasetRecords(
      { events },
      { dataset: "events", filter: [{ field: "when", op: "past" }], asOf },
    );
    expect(past?.rows.map((r) => r.uid)).toEqual([1]);
    const future = queryDatasetRecords(
      { events },
      { dataset: "events", filter: [{ field: "when", op: "future" }], asOf },
    );
    expect(future?.rows.map((r) => r.uid)).toEqual([2, 3]);
  });
});

describe("parseDatasetFilters", () => {
  it("accepts hasValue, future, past, and contains", () => {
    expect(
      parseDatasetFilters([
        { field: "email", op: "hasValue" },
        { field: "when", op: "future" },
        { field: "name", op: "contains", value: "north" },
      ]),
    ).toEqual([
      { field: "email", op: "hasValue" },
      { field: "when", op: "future" },
      { field: "name", op: "contains", value: "north" },
    ]);
  });
});

describe("contains filter", () => {
  it("matches string fields case-insensitively", () => {
    const result = queryDatasetRecords(
      { branches },
      {
        dataset: "branches",
        filter: [{ field: "name", op: "contains", value: "nor" }],
      },
    );
    expect(result?.rows.map((r) => r.displayName)).toEqual(["North"]);
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
