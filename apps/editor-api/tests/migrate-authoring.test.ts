import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureAuthoringSchemaMigration, migrateAuthoredRecord } from "../src/site/migrate-authoring.js";
import { readSchemaVersion } from "../src/store/meta.js";
import { metaPath } from "../src/store/meta.js";

describe("migrateAuthoredRecord", () => {
  it("converts html zones to widget blocks except title", () => {
    const out = migrateAuthoredRecord({
      id: "home",
      title: "Home",
      zones: {
        main: { html: "<p>Hi</p>" },
        title: { html: "Welcome" },
        agenda: { json: [{ item: "x" }] },
      },
    });
    expect(out.zones).toEqual({
      main: { blocks: expect.arrayContaining([expect.objectContaining({ kind: "text" })]) },
      title: { html: "Welcome" },
    });
    expect(out.zones).not.toHaveProperty("agenda");
  });
});

describe("ensureAuthoringSchemaMigration", () => {
  it("rewrites records and bumps schemaVersion", async () => {
    const root = await mkdtemp(join(tmpdir(), "tessera-migrate-"));
    const records = join(root, "records");
    await mkdir(join(records, "content"), { recursive: true });
    await writeFile(
      join(records, "content", "note.yaml"),
      `id: note
title: Note
zones:
  main:
    html: |
      <p>Body</p>
`,
    );
    await writeFile(metaPath(root), '{"schemaVersion":3}\n');
    const migrated = await ensureAuthoringSchemaMigration(root, records);
    expect(migrated).toBe(true);
    expect(await readSchemaVersion(metaPath(root))).toBe(4);
    const yaml = await readFile(join(records, "content", "note.yaml"), "utf8");
    expect(yaml).toContain("blocks:");
    expect(yaml).toContain("kind:");
    expect(yaml).not.toContain("\n    html:");
    await rm(root, { recursive: true, force: true });
  });
});
