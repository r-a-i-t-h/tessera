import { describe, expect, it } from "vitest";
import { datasetFileToSnapshot, parseDatasetFile } from "../dataset.js";
import { pageDataRoots, walkDatasetRecords } from "../dataset-walk.js";

describe("dataset walk", () => {
  const people = parseDatasetFile({
    id: "people",
    title: "People",
    schema: {
      fields: [
        { key: "f1", id: "name", label: "Name", kind: "string" },
        { key: "f2", id: "friend", label: "Friend", kind: "ref", dataset: "people" },
      ],
    },
    view: { columns: ["name"] },
    nextUid: 3,
    records: [
      {
        uid: 1,
        added: "2026-01-01T00:00:00.000Z",
        modified: "2026-01-01T00:00:00.000Z",
        name: "A",
        friend: 2,
      },
      { uid: 2, added: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z", name: "B" },
    ],
  });

  it("walks refs without repeats", () => {
    const snapshots = { people: datasetFileToSnapshot(people) };
    const root = people.records[0]!;
    const { records, order } = walkDatasetRecords(snapshots, [{ datasetId: "people", record: root }]);
    expect(order).toHaveLength(2);
    expect(records.get("people:1")?.name).toBe("A");
    expect(records.get("people:2")?.name).toBe("B");
  });

  it("filters page data roots", () => {
    const meetings = parseDatasetFile({
      id: "meetings",
      title: "Meetings",
      schema: { fields: [{ key: "f1", id: "topic", label: "Topic", kind: "string" }] },
      view: { columns: ["topic"] },
      nextUid: 3,
      records: [
        {
          uid: 1,
          page: "agm",
          added: "2026-01-01T00:00:00.000Z",
          modified: "2026-01-01T00:00:00.000Z",
          topic: "AGM",
        },
        {
          uid: 2,
          added: "2026-01-01T00:00:00.000Z",
          modified: "2026-01-01T00:00:00.000Z",
          topic: "Other",
        },
      ],
    });
    const snapshots = { meetings: datasetFileToSnapshot(meetings) };
    const roots = pageDataRoots(snapshots, "meetings", "agm");
    expect(roots).toHaveLength(1);
    expect(roots[0]?.topic).toBe("AGM");
  });
});
