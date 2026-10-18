import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLibraryAddedAt } from "../src/migrations/library-added-at.js";

describe("migrateLibraryAddedAt", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  it("backfills addedAt from blob mtime and stamps schema 4", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-added-at-"));
    const mediaDir = join(dataDir, "records", "media");
    const filesDir = join(dataDir, "files");
    await mkdir(mediaDir, { recursive: true });
    await mkdir(filesDir, { recursive: true });
    await writeFile(join(dataDir, "meta.json"), `${JSON.stringify({ schemaVersion: 3 })}\n`);
    await writeFile(
      join(mediaDir, "porch.yaml"),
      "id: porch\nname: porch.svg\nkind: image\next: svg\nfolderId: hall\n",
    );
    const blob = join(filesDir, "porch.svg");
    await writeFile(blob, "<svg/>");
    const when = new Date("2024-06-15T12:00:00.000Z");
    await utimes(blob, when, when);

    await migrateLibraryAddedAt(dataDir);

    const row = parseYaml(await readFile(join(mediaDir, "porch.yaml"), "utf8")) as { addedAt?: string };
    expect(row.addedAt).toBe(when.toISOString());
    const meta = JSON.parse(await readFile(join(dataDir, "meta.json"), "utf8")) as { schemaVersion: number };
    expect(meta.schemaVersion).toBe(4);
  });

  it("skips records that already have addedAt", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-added-at-"));
    const mediaDir = join(dataDir, "records", "media");
    await mkdir(mediaDir, { recursive: true });
    await writeFile(join(dataDir, "meta.json"), `${JSON.stringify({ schemaVersion: 3 })}\n`);
    const kept = "2022-01-01T00:00:00.000Z";
    await writeFile(
      join(mediaDir, "notes.yaml"),
      `id: notes\nkind: document\next: pdf\naddedAt: ${kept}\n`,
    );

    await migrateLibraryAddedAt(dataDir);

    const row = parseYaml(await readFile(join(mediaDir, "notes.yaml"), "utf8")) as { addedAt: string };
    expect(row.addedAt).toBe(kept);
  });
});
