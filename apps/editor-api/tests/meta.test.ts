import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureMetaFile, metaPath, readSchemaVersion } from "../src/store/meta.js";

describe("meta.json", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  it("copies seed meta once and does not overwrite a stamped file", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-meta-"));
    const seed = await mkdtemp(join(tmpdir(), "tessera-seed-"));
    await writeFile(join(seed, "meta.json"), "{}\n");
    await ensureMetaFile(dataDir, seed);
    expect(await readFile(metaPath(dataDir), "utf8")).toBe("{}\n");
    await writeFile(metaPath(dataDir), `${JSON.stringify({ schemaVersion: 1, extra: "stay" }, null, 2)}\n`);
    await ensureMetaFile(dataDir, seed);
    const meta = JSON.parse(await readFile(metaPath(dataDir), "utf8")) as { schemaVersion: number; extra: string };
    expect(meta.schemaVersion).toBe(1);
    expect(meta.extra).toBe("stay");
    await rm(seed, { recursive: true, force: true });
  });

  it("reads a missing or non-numeric schemaVersion as 0", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-meta-"));
    expect(await readSchemaVersion(metaPath(dataDir))).toBe(0);
    await writeFile(metaPath(dataDir), `${JSON.stringify({ schemaVersion: "nope" })}\n`);
    expect(await readSchemaVersion(metaPath(dataDir))).toBe(0);
  });
});
