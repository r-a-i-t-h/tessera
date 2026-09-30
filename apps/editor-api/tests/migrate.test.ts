import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { ensureMetaFile, metaPath, readSchemaVersion } from "../src/store/meta.js";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const migrateSh = join(repoRoot, "deploy", "migrate.sh");
const postUpdateSh = join(repoRoot, "deploy", "post-update.sh");

async function runMigrate(dataDir: string, script = migrateSh): Promise<{ stdout: string; code: number }> {
  try {
    const { stdout } = await execFileAsync("sh", [script], {
      env: { ...process.env, TESSERA_DATA: dataDir },
    });
    return { stdout, code: 0 };
  } catch (err) {
    const failed = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: `${failed.stdout ?? ""}${failed.stderr ?? ""}`,
      code: typeof failed.code === "number" ? failed.code : 1,
    };
  }
}

describe("authoring schema migrations", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  it("001 stamps schemaVersion 1 and keeps other meta keys", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-migrate-"));
    await writeFile(join(dataDir, "meta.json"), `${JSON.stringify({ extra: "keep-me" }, null, 2)}\n`);

    const first = await runMigrate(dataDir);
    expect(first.code).toBe(0);
    expect(first.stdout).toMatch(/applying 001-schema-version\.sh/);
    expect(first.stdout).toMatch(/now at schema 2/);

    const meta = JSON.parse(await readFile(join(dataDir, "meta.json"), "utf8")) as {
      schemaVersion: number;
      extra: string;
    };
    expect(meta.schemaVersion).toBe(2);
    expect(meta.extra).toBe("keep-me");
    expect(await readSchemaVersion(join(dataDir, "meta.json"))).toBe(2);

    const second = await runMigrate(dataDir);
    expect(second.code).toBe(0);
    expect(second.stdout).toMatch(/already at schema 2/);
  });

  it("treats a non-numeric schemaVersion as 0", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-migrate-"));
    await writeFile(join(dataDir, "meta.json"), `${JSON.stringify({ schemaVersion: "nope" })}\n`);
    const result = await runMigrate(dataDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/applying 001-schema-version\.sh \(from schema 0\)/);
  });

  it("refuses to run without meta.json", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-migrate-"));
    const result = await runMigrate(dataDir);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/meta\.json missing/);
  });

  it("post-update.sh applies the same migrations", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-migrate-"));
    await writeFile(join(dataDir, "meta.json"), "{}\n");
    const result = await runMigrate(dataDir, postUpdateSh);
    expect(result.code).toBe(0);
    expect(await readSchemaVersion(join(dataDir, "meta.json"))).toBe(2);
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
});
