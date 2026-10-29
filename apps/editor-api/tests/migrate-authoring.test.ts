import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ensureAuthoringSchemaMigration,
  ensureItemAuthoringRepair,
  migrateAuthoredRecord,
  migrateItemAuthoringRecord,
} from "../src/site/migrate-authoring.js";
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

describe("migrateItemAuthoringRecord", () => {
  it("keeps html and component zones, rewrites blocks, drops json", () => {
    expect(
      migrateItemAuthoringRecord({
        id: "footer",
        zones: {
          footer: { html: "<p>Hi</p>" },
          banner: { component: "eventList" },
          stray: { json: [{ title: "x" }] },
          broken: { blocks: [{ kind: "text", heading: "", level: 2, html: "<p>Fixed</p>" }] },
        },
      }),
    ).toEqual({
      id: "footer",
      zones: {
        footer: { html: "<p>Hi</p>" },
        banner: { component: "eventList" },
        broken: { html: "<p>Fixed</p>" },
      },
    });
  });
});

describe("ensureItemAuthoringRepair", () => {
  it("rewrites item yaml on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "tessera-item-repair-"));
    const records = join(root, "records");
    await mkdir(join(records, "items"), { recursive: true });
    await writeFile(
      join(records, "items", "common-footer.yaml"),
      `id: common-footer
zones:
  footer:
    blocks:
      - kind: text
        heading: ""
        level: 2
        html: "<p>Footer</p>"
`,
    );
    expect(await ensureItemAuthoringRepair(records)).toBe(true);
    const yaml = await readFile(join(records, "items", "common-footer.yaml"), "utf8");
    expect(yaml).toContain("html:");
    expect(yaml).not.toContain("blocks:");
    await rm(root, { recursive: true, force: true });
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

  it("ignores macOS AppleDouble ._*.yaml files", async () => {
    const root = await mkdtemp(join(tmpdir(), "tessera-migrate-apple-"));
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
    await writeFile(join(records, "content", "._note.yaml"), "Mac OS X resource fork junk\n");
    await writeFile(metaPath(root), '{"schemaVersion":3}\n');
    expect(await ensureAuthoringSchemaMigration(root, records)).toBe(true);
    expect(await readSchemaVersion(metaPath(root))).toBe(4);
    await rm(root, { recursive: true, force: true });
  });
});
