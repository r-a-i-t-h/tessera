import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_HANDOFF_FILE } from "../auth/sessions.js";
import { writeSeedFiles } from "./blank.js";
import { SITE_NAMES, type SiteName, isSiteName } from "./paths.js";
import { adoptLegacyRecordsDir } from "./records-dir.js";

export const BACKUP_NAME_RE = /^\d{4}-\d{2}-\d{2}T\d{6}Z\.tar\.gz$/;

const EXAMPLE_TITLES: Record<SiteName, string> = {
  willow: "Willow",
};

export interface BackupInfo {
  name: string;
  size: number;
  mtime: string;
}

export interface ExampleInfo {
  name: SiteName;
  title: string;
}

export interface RestoreResult {
  restored: string;
  safetyBackup: string;
}

export function isBackupName(name: string): boolean {
  return BACKUP_NAME_RE.test(name);
}

export function utcBackupName(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}${mm}${ss}Z.tar.gz`;
}

export function backupPath(backupDir: string, name: string): string | undefined {
  if (!isBackupName(name)) return undefined;
  return join(backupDir, name);
}

export async function listBackups(backupDir: string): Promise<BackupInfo[]> {
  let names: string[];
  try {
    names = await readdir(backupDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }

  const out: BackupInfo[] = [];
  for (const name of names) {
    if (!isBackupName(name)) continue;
    const path = join(backupDir, name);
    const st = await stat(path);
    if (!st.isFile()) continue;
    out.push({ name, size: st.size, mtime: st.mtime.toISOString() });
  }
  out.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  return out;
}

export function exampleArchiveName(name: SiteName): string {
  return `${name}.tar.gz`;
}

/** Place each demo archive in `backup/` when it is missing. Never replaces one that is already there. */
export async function ensureExampleArchives(
  backupDir: string,
  sources: { seedDir?: string; sitesDir?: string },
): Promise<void> {
  await mkdir(backupDir, { recursive: true });
  for (const name of SITE_NAMES) {
    const dest = join(backupDir, exampleArchiveName(name));
    if (await isFile(dest)) continue;
    const packed = sources.seedDir
      ? join(sources.seedDir, "examples", exampleArchiveName(name))
      : undefined;
    if (packed && (await isFile(packed))) {
      await cp(packed, dest);
      continue;
    }
    const site = sources.sitesDir ? join(sources.sitesDir, name) : undefined;
    if (!site || !(await isFile(join(site, "meta.json")))) continue;
    const partial = `${dest}.partial`;
    try {
      await runTar([
        "-czf",
        partial,
        "--exclude=users",
        "--exclude=history",
        `--exclude=${SESSION_HANDOFF_FILE}`,
        "--exclude=node_modules",
        "--exclude=backup",
        "-C",
        site,
        ".",
      ]);
      await rename(partial, dest);
    } catch (err) {
      await rm(partial, { force: true });
      throw err;
    }
  }
}

export async function listExamples(backupDir: string): Promise<ExampleInfo[]> {
  const out: ExampleInfo[] = [];
  for (const name of SITE_NAMES) {
    if (await isFile(join(backupDir, exampleArchiveName(name)))) {
      out.push({ name, title: EXAMPLE_TITLES[name] });
    }
  }
  return out;
}

export async function createDataBackup(dataDir: string, backupDir: string): Promise<BackupInfo> {
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
  let name = utcBackupName();
  let dest = join(backupDir, name);
  try {
    await stat(dest);
    name = utcBackupName(new Date(Date.now() + 1000));
    dest = join(backupDir, name);
  } catch {
    // dest does not exist yet
  }

  const partial = `${dest}.partial`;
  try {
    await runTar(
      ["-czf", partial, `--exclude=${SESSION_HANDOFF_FILE}`, "--exclude=backup", "-C", dataDir, "."],
    );
    await rename(partial, dest);
  } catch (err) {
    await rm(partial, { force: true });
    throw err;
  }

  const st = await stat(dest);
  return { name, size: st.size, mtime: st.mtime.toISOString() };
}

export async function deleteBackup(backupDir: string, name: string): Promise<boolean> {
  const path = backupPath(backupDir, name);
  if (!path) return false;
  try {
    await rm(path);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw err;
  }
}

/** Replace the site directory from a dated archive. Writes a safety archive first. */
export async function restoreDataBackup(
  dataDir: string,
  backupDir: string,
  name: string,
): Promise<RestoreResult> {
  const archive = backupPath(backupDir, name);
  if (!archive) throw new Error("Invalid backup name");
  await assertArchiveFile(archive);
  await assertSiteArchive(archive);

  const safetyBackup = await createDataBackup(dataDir, backupDir);
  try {
    await clearDataDir(dataDir);
    await extractTar(archive, dataDir);
    await adoptLegacyRecordsDir(dataDir);
  } catch (err) {
    await rollback(dataDir, backupDir, safetyBackup.name);
    throw err;
  }
  return { restored: name, safetyBackup: safetyBackup.name };
}

/**
 * Replace pages, shell, and the published tree from an example.
 * Editors in `users/` stay. A safety archive is written first.
 */
export async function restoreExample(
  dataDir: string,
  backupDir: string,
  name: string,
): Promise<RestoreResult> {
  if (!isSiteName(name)) throw new Error("Unknown example");
  const archive = join(backupDir, exampleArchiveName(name));
  if (!(await isFile(archive))) throw new Error("Example not found");
  await assertSiteArchive(archive);

  const safetyBackup = await createDataBackup(dataDir, backupDir);
  const hold = await mkdtemp(join(tmpdir(), "tessera-users-"));
  let heldUsers = false;
  try {
    try {
      await moveTree(join(dataDir, "users"), join(hold, "users"));
      heldUsers = true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }

    await clearDataDir(dataDir);
    await extractTar(archive, dataDir);
    await adoptLegacyRecordsDir(dataDir);
    await rm(join(dataDir, "users"), { recursive: true, force: true });
    if (heldUsers) await moveTree(join(hold, "users"), join(dataDir, "users"));
    if (!(await isFile(join(dataDir, "meta.json")))) {
      throw new Error("Example is not a site (missing meta.json)");
    }
  } catch (err) {
    await rollback(dataDir, backupDir, safetyBackup.name);
    throw err;
  } finally {
    await rm(hold, { recursive: true, force: true });
  }

  return { restored: name, safetyBackup: safetyBackup.name };
}

/** Kept across a re-seed. Editors, the schema stamp, and the session handoff stay. */
const RESEED_KEEP = new Set(["users", "meta.json", SESSION_HANDOFF_FILE]);

/**
 * Replace pages, shell, library files, history, and the published tree
 * with the starter site. Editors stay. A safety archive is written first.
 */
export async function reseedSite(dataDir: string, backupDir: string): Promise<RestoreResult> {
  const safetyBackup = await createDataBackup(dataDir, backupDir);
  try {
    await clearExcept(dataDir, RESEED_KEEP);
    await writeSeedFiles(dataDir);
  } catch (err) {
    await rollback(dataDir, backupDir, safetyBackup.name);
    throw err;
  }
  return { restored: "seed", safetyBackup: safetyBackup.name };
}

async function assertArchiveFile(archive: string): Promise<void> {
  try {
    const st = await stat(archive);
    if (!st.isFile()) throw new Error("Backup not found");
  } catch (err) {
    if (err instanceof Error && err.message === "Backup not found") throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error("Backup not found");
    throw err;
  }
}

async function assertSiteArchive(archive: string): Promise<void> {
  const probeDir = await mkdtemp(join(tmpdir(), "tessera-restore-probe-"));
  try {
    await extractTar(archive, probeDir);
    if (!(await isFile(join(probeDir, "meta.json")))) {
      throw new Error("Archive is not a site backup (missing meta.json)");
    }
  } finally {
    await rm(probeDir, { recursive: true, force: true });
  }
}

/** Copy then delete. `rename` fails with EXDEV when the hold dir is on another mount. */
async function moveTree(from: string, to: string): Promise<void> {
  await cp(from, to, { recursive: true });
  await rm(from, { recursive: true });
}

async function rollback(dataDir: string, backupDir: string, safetyName: string): Promise<void> {
  const safety = join(backupDir, safetyName);
  try {
    await clearDataDir(dataDir);
    await extractTar(safety, dataDir);
    await adoptLegacyRecordsDir(dataDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : "rollback failed";
    throw new Error(`Restore failed and rollback failed (${message}). Safety archive: ${safetyName}`);
  }
}

async function clearDataDir(dataDir: string): Promise<void> {
  await clearExcept(dataDir, new Set());
}

async function clearExcept(dataDir: string, keep: Set<string>): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dataDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      await mkdir(dataDir, { recursive: true });
      return;
    }
    throw err;
  }
  await Promise.all(
    entries
      .filter((entry) => !keep.has(entry))
      .map((entry) => rm(join(dataDir, entry), { recursive: true, force: true })),
  );
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw err;
  }
}

function assertArchiveSafe(listing: string): void {
  for (const raw of listing.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("/") || /^[A-Za-z]:[\\/]/.test(line)) {
      throw new Error("Archive contains an absolute path");
    }
    const parts = line.split(/[/\\]/).filter(Boolean);
    if (parts.includes("..")) throw new Error("Archive contains a parent path");
  }
}

async function extractTar(archive: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const listing = await runTarCapture(["-tzf", archive]);
  assertArchiveSafe(listing);
  await runTar(["-xzf", archive, "-C", destDir]);
}

function runTar(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `tar exited ${code}`));
    });
  });
}

function runTarCapture(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `tar exited ${code}`));
    });
  });
}
