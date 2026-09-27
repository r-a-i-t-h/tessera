import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendPageHistory,
  listPageHistory,
  pageHistoryPath,
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
