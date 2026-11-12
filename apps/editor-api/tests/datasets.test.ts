import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatasetStore, ValidationError } from "../src/site/dataset-store.js";

describe("DatasetStore", () => {
  let dir: string;
  let store: DatasetStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "tessera-datasets-"));
    store = new DatasetStore(join(dir, "datasets"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("invalidateListing drops a stale summary cache", async () => {
    await store.create("alpha", "Alpha");
    expect((await store.list()).map((d) => d.id)).toEqual(["alpha"]);
    const otherPath = join(dir, "datasets", "beta.json");
    await writeFile(
      otherPath,
      `${JSON.stringify(
        {
          id: "beta",
          title: "Beta",
          schema: { fields: [] },
          view: { columns: ["uid"] },
          records: [],
          nextUid: 1,
        },
        null,
        2,
      )}\n`,
    );
    expect((await store.list()).map((d) => d.id)).toEqual(["alpha"]);
    store.invalidateListing();
    expect((await store.list()).map((d) => d.id)).toEqual(["alpha", "beta"]);
  });

  it("lists datasets sorted by title", async () => {
    await store.create("zebra", "Zebra");
    await store.create("alpha", "Alpha");
    await store.create("mid", "Mid");
    const list = await store.list();
    expect(list.map((d) => d.id)).toEqual(["alpha", "mid", "zebra"]);
  });

  it("creates and appends a record with uid and timestamps", async () => {
    await store.create("meetings", "Meetings");
    await store.updateSchema("meetings", {
      fields: [{ key: "f1", id: "heldOn", label: "Held on", kind: "date", required: true }],
    });
    const file = await store.appendRecord("meetings", { heldOn: "2026-10-09" });
    expect(file.records).toHaveLength(1);
    expect(file.records[0]?.uid).toBe(1);
    expect(file.records[0]?.added).toBeTruthy();
    expect(file.records[0]?.modified).toBeTruthy();
  });

  it("formats root record labels from the display name template", async () => {
    await store.create("meetings", "Meetings");
    await store.updateSchema("meetings", {
      fields: [
        { key: "f1", id: "heldOn", label: "Held on", kind: "date", required: true },
        { key: "f2", id: "name", label: "Name", kind: "string" },
      ],
    });
    await store.updateView("meetings", { columns: [], displayName: "{name} ({heldOn})" });
    await store.appendRecord("meetings", { heldOn: "2026-10-09", name: "AGM" });
    const roots = await store.rootRecords("meetings");
    expect(roots[0]?.displayName).toBe("AGM (2026-10-09)");
  });

  it("rejects invalid records", async () => {
    await store.create("meetings", "Meetings");
    await store.updateSchema("meetings", {
      fields: [{ key: "f1", id: "heldOn", label: "Held on", kind: "date", required: true }],
    });
    await expect(store.appendRecord("meetings", {})).rejects.toBeInstanceOf(ValidationError);
  });

  it("rewrites records when schema renames a field", async () => {
    await store.create("meetings", "Meetings");
    await store.updateSchema("meetings", {
      fields: [{ key: "f1", id: "precis", label: "Precis", kind: "string" }],
    });
    await store.appendRecord("meetings", { precis: "Hi" });
    await store.updateSchema("meetings", {
      fields: [{ key: "f1", id: "summary", label: "Summary", kind: "text" }],
    });
    const { file } = await store.read("meetings");
    expect(file.records[0]?.summary).toBe("Hi");
  });

  it("duplicates schema, view, and records under a new id", async () => {
    await store.create("items", "Items");
    await store.updateSchema("items", {
      fields: [{ key: "f1", id: "name", label: "Name", kind: "string", required: true }],
    });
    await store.updateView("items", { columns: ["uid", "name"], displayName: "{name}" });
    await store.appendRecord("items", { name: "Alpha" });
    const copy = await store.duplicate("items", "items-copy");
    expect(copy.id).toBe("items-copy");
    expect(copy.title).toBe("Items copy");
    expect(copy.schema.fields.map((f) => f.id)).toEqual(["name"]);
    expect(copy.view.columns).toEqual(["uid", "name"]);
    expect(copy.records).toHaveLength(1);
    expect(copy.records[0]?.name).toBe("Alpha");
    const list = await store.list();
    expect(list.map((d) => d.id).sort()).toEqual(["items", "items-copy"]);
  });

  it("keeps original title when copy is renamed after duplicate", async () => {
    await store.create("items", "Items");
    await store.duplicate("items", "items-copy");
    await store.updateTitle("items-copy", "Renamed Copy");
    const { file: original } = await store.read("items");
    const { file: copy } = await store.read("items-copy");
    expect(original.title).toBe("Items");
    expect(copy.title).toBe("Renamed Copy");
  });

  it("replaces records from a raw JSON array", async () => {
    await store.create("meetings", "Meetings");
    await store.updateSchema("meetings", {
      fields: [{ key: "f1", id: "heldOn", label: "Held on", kind: "date", required: true }],
    });
    const withRecord = await store.appendRecord("meetings", { heldOn: "2026-01-01" });
    const added = withRecord.records[0]?.added;
    const raw = JSON.stringify(
      [
        { uid: 1, added, modified: "2026-02-01T00:00:00.000Z", heldOn: "2026-02-02" },
        { uid: 2, added: "2026-02-01T00:00:00.000Z", modified: "2026-02-01T00:00:00.000Z", heldOn: "2026-03-01" },
      ],
      null,
      2,
    );
    const file = await store.replaceRecordsRaw("meetings", raw);
    expect(file.records).toHaveLength(2);
    expect(file.records[0]?.heldOn).toBe("2026-02-02");
    expect(file.records[0]?.added).toBe(added);
    expect(file.nextUid).toBe(3);
    expect(file.title).toBe("Meetings");
    await expect(store.replaceRecordsRaw("meetings", "{}")).rejects.toThrow(/array/);
    await expect(
      store.replaceRecordsRaw(
        "meetings",
        JSON.stringify([
          { uid: 1, heldOn: "2026-01-01" },
          { uid: 1, heldOn: "2026-02-01" },
        ]),
      ),
    ).rejects.toThrow(/Duplicate uid/);
    await expect(store.replaceRecordsRaw("meetings", JSON.stringify([{ uid: 1 }]))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("clears all records and resets nextUid", async () => {
    await store.create("items", "Items");
    await store.updateSchema("items", {
      fields: [{ key: "f1", id: "name", label: "Name", kind: "string", required: true }],
    });
    await store.appendRecord("items", { name: "Alpha" });
    await store.appendRecord("items", { name: "Beta" });
    const file = await store.clearAllRecords("items");
    expect(file.records).toEqual([]);
    expect(file.nextUid).toBe(1);
    expect(file.schema.fields).toHaveLength(1);
    const { file: again } = await store.read("items");
    expect(again.records).toEqual([]);
  });
});
