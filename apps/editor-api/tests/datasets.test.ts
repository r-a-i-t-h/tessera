import { mkdtemp, rm } from "node:fs/promises";
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
});
