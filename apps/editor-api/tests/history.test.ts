import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendPageHistory,
  listPageHistory,
  pageHistoryPath,
  prunePageHistory,
  readPageHistoryEntry,
} from "../src/site/history.js";

describe("page history file", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("appends former bytes without rewriting earlier entries", async () => {
    dir = await mkdtemp(join(tmpdir(), "tessera-history-"));
    const file = pageHistoryPath(dir, "home");
    const first = "id: home\ntitle: One\n# tessera-history 1\n---\n";
    const second = "id: home\ntitle: Two\n";
    await appendPageHistory(file, first, 0, "2026-09-27T12:00:00.000Z");
    await appendPageHistory(file, second, 1, "2026-09-27T12:05:00.000Z");

    const listed = await listPageHistory(file);
    expect(listed).toEqual([
      { index: 0, savedAt: "2026-09-27T12:00:00.000Z", schemaVersion: 0, bytes: Buffer.byteLength(first) },
      { index: 1, savedAt: "2026-09-27T12:05:00.000Z", schemaVersion: 1, bytes: Buffer.byteLength(second) },
    ]);
    expect(await readPageHistoryEntry(file, 0)).toEqual({
      savedAt: "2026-09-27T12:00:00.000Z",
      schemaVersion: 0,
      raw: first,
    });
    expect((await readPageHistoryEntry(file, 1))?.raw).toBe(second);
    expect(await readPageHistoryEntry(file, 2)).toBeUndefined();

    const onDisk = await readFile(file);
    expect(onDisk.subarray(0, Buffer.from("# tessera-history 1\n").length).toString()).toBe(
      "# tessera-history 1\n",
    );
  });
});

describe("page history prune", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function seedFive(): Promise<string> {
    dir = await mkdtemp(join(tmpdir(), "tessera-history-prune-"));
    const file = pageHistoryPath(dir, "home");
    await appendPageHistory(file, "raw-0\n", 0, "2026-01-01T00:00:00.000Z");
    await appendPageHistory(file, "raw-1\n", 0, "2026-01-10T00:00:00.000Z");
    await appendPageHistory(file, "raw-2\n", 0, "2026-01-20T00:00:00.000Z");
    await appendPageHistory(file, "raw-3\n", 0, "2026-02-01T00:00:00.000Z");
    await appendPageHistory(file, "raw-4\n", 0, "2026-02-10T00:00:00.000Z");
    return file;
  }

  it("leaves the file unchanged when neither limit is set", async () => {
    const file = await seedFive();
    const before = await readFile(file);
    const result = await prunePageHistory(file, {}, new Date("2026-02-15T00:00:00.000Z"));
    expect(result).toEqual({ kept: 0, dropped: 0 });
    expect(await readFile(file)).toEqual(before);
    expect(await listPageHistory(file)).toHaveLength(5);
  });

  it("keeps only the newest N when maxEntries is set", async () => {
    const file = await seedFive();
    const result = await prunePageHistory(file, { maxEntries: 2 }, new Date("2026-02-15T00:00:00.000Z"));
    expect(result).toEqual({ kept: 2, dropped: 3 });
    const listed = await listPageHistory(file);
    expect(listed.map((e) => e.savedAt)).toEqual([
      "2026-02-01T00:00:00.000Z",
      "2026-02-10T00:00:00.000Z",
    ]);
    expect((await readPageHistoryEntry(file, 0))?.raw).toBe("raw-3\n");
    expect((await readPageHistoryEntry(file, 1))?.raw).toBe("raw-4\n");
  });

  it("drops entries older than maxAgeDays", async () => {
    const file = await seedFive();
    // From 2026-02-15, 20 days back is 2026-01-26 — keep Feb entries only.
    const result = await prunePageHistory(file, { maxAgeDays: 20 }, new Date("2026-02-15T00:00:00.000Z"));
    expect(result).toEqual({ kept: 2, dropped: 3 });
    expect((await listPageHistory(file)).map((e) => e.savedAt)).toEqual([
      "2026-02-01T00:00:00.000Z",
      "2026-02-10T00:00:00.000Z",
    ]);
  });

  it("applies age and count as OR (drop if either fails)", async () => {
    const file = await seedFive();
    // Newest 4 by count would keep Jan 10..Feb 10, but age 20 days from Feb 15
    // drops Jan 10 and Jan 20 — survivors are the two Feb entries.
    const result = await prunePageHistory(
      file,
      { maxEntries: 4, maxAgeDays: 20 },
      new Date("2026-02-15T00:00:00.000Z"),
    );
    expect(result).toEqual({ kept: 2, dropped: 3 });
    expect((await listPageHistory(file)).map((e) => e.savedAt)).toEqual([
      "2026-02-01T00:00:00.000Z",
      "2026-02-10T00:00:00.000Z",
    ]);
  });

  it("deletes the file when every entry is pruned", async () => {
    const file = await seedFive();
    const result = await prunePageHistory(file, { maxAgeDays: 1 }, new Date("2026-02-15T00:00:00.000Z"));
    expect(result).toEqual({ kept: 0, dropped: 5 });
    await expect(access(file)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
