import { describe, expect, it } from "vitest";
import {
  adaptRecords,
  emptyRootRecordDraft,
  formatRecordDisplayName,
  parseDatasetFile,
  parseDatasetSchema,
  sanitizeViewColumns,
  validateDisplayNameTemplate,
  validateRootRecord,
} from "../dataset.js";

const meetingSchema = parseDatasetSchema({
  fields: [
    { key: "f1", id: "heldOn", label: "Held on", kind: "date", required: true },
    {
      key: "f2",
      id: "agenda",
      label: "Agenda",
      kind: "list",
      fields: [{ key: "f3", id: "topic", label: "Topic", kind: "string", required: true }],
    },
  ],
});

const carSchema = parseDatasetSchema({
  fields: [
    { key: "f1", id: "make", label: "Make", kind: "string" },
    { key: "f2", id: "model", label: "Model", kind: "string" },
    { key: "f3", id: "year", label: "Year", kind: "number" },
  ],
});

describe("validateRootRecord", () => {
  it("accepts a valid record", () => {
    const issues = validateRootRecord(
      {
        uid: 1,
        added: "2026-01-01T00:00:00.000Z",
        modified: "2026-01-01T00:00:00.000Z",
        heldOn: "2026-10-09",
        agenda: [
          {
            uid: 2,
            added: "2026-01-01T00:00:00.000Z",
            modified: "2026-01-01T00:00:00.000Z",
            topic: "Minutes",
          },
        ],
      },
      meetingSchema,
    );
    expect(issues).toEqual([]);
  });

  it("rejects reserved field ids in schema", () => {
    expect(() =>
      parseDatasetSchema({
        fields: [{ key: "f1", id: "uid", label: "Bad", kind: "string" }],
      }),
    ).toThrow(/reserved/);
  });
});

describe("formatRecordDisplayName", () => {
  it("interpolates schema fields", () => {
    const record = { uid: 3, make: "Ford", model: "Focus", year: 2019 };
    expect(formatRecordDisplayName(record, "{make} {model} {year}", carSchema.fields)).toBe("Ford Focus 2019");
  });

  it("falls back to uid when the template is empty", () => {
    expect(formatRecordDisplayName({ uid: 7 }, "", carSchema.fields)).toBe("#7");
  });
});

describe("validateDisplayNameTemplate", () => {
  it("rejects unknown placeholders", () => {
    expect(validateDisplayNameTemplate("{missing}", carSchema.fields)).toMatch(/Unknown field/);
  });
});

describe("parseDatasetFile", () => {
  it("strips legacy id and title from stored records", () => {
    const file = parseDatasetFile({
      id: "cars",
      title: "Cars",
      schema: { fields: carSchema.fields },
      view: { columns: [], displayName: "{make}" },
      nextUid: 2,
      records: [{ uid: 1, id: "legacy", title: "Old", added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", make: "Ford" }],
    });
    expect(file.records[0]).not.toHaveProperty("id");
    expect(file.records[0]).not.toHaveProperty("title");
    expect(file.records[0]?.make).toBe("Ford");
  });
});

describe("adaptRecords", () => {
  const record = {
    uid: 1,
    added: "2026-01-01T00:00:00.000Z",
    modified: "2026-01-01T00:00:00.000Z",
    heldOn: "2026-10-09",
    precis: "Hello",
  };

  it("renames a field by key", () => {
    const next = parseDatasetSchema({
      fields: [{ key: "f9", id: "summary", label: "Summary", kind: "text" }],
    });
    const prev = parseDatasetSchema({
      fields: [{ key: "f9", id: "precis", label: "Precis", kind: "text" }],
    });
    const [out] = adaptRecords(prev, next, [record], { rootUidsInDataset: () => new Set() });
    expect(out.summary).toBe("Hello");
    expect(out.precis).toBeUndefined();
  });

  it("keeps string when swapping text and html", () => {
    const prev = parseDatasetSchema({
      fields: [{ key: "f1", id: "body", label: "Body", kind: "text" }],
    });
    const next = parseDatasetSchema({
      fields: [{ key: "f1", id: "body", label: "Body", kind: "html" }],
    });
    const [out] = adaptRecords(prev, next, [{ ...record, body: "<p>x</p>" }], {
      rootUidsInDataset: () => new Set(),
    });
    expect(out.body).toBe("<p>x</p>");
  });

  it("wraps asset when many is added", () => {
    const prev = parseDatasetSchema({
      fields: [{ key: "f1", id: "photo", label: "Photo", kind: "asset" }],
    });
    const next = parseDatasetSchema({
      fields: [{ key: "f1", id: "photo", label: "Photo", kind: "asset", many: true }],
    });
    const [out] = adaptRecords(prev, next, [{ ...record, photo: "img-1" }], {
      rootUidsInDataset: () => new Set(),
    });
    expect(out.photo).toEqual(["img-1"]);
  });
});

describe("sanitizeViewColumns", () => {
  it("drops unknown columns", () => {
    const fields = parseDatasetSchema({
      fields: [{ key: "f1", id: "heldOn", label: "Held on", kind: "date" }],
    }).fields;
    expect(sanitizeViewColumns(["heldOn", "missing", "added"], fields)).toEqual(["heldOn", "added"]);
  });
});

describe("emptyRootRecordDraft", () => {
  it("applies defaults", () => {
    const schema = parseDatasetSchema({
      fields: [{ key: "f1", id: "count", label: "Count", kind: "number", default: 3 }],
    });
    expect(emptyRootRecordDraft(schema).count).toBe(3);
  });
});
