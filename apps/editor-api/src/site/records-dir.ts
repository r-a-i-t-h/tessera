import { rename, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * YAML records live in `records/`. Trees saved before that rename keep them
 * in `data/` beside `shell/` and `publish/`. Move that folder once.
 * `publish/data` is the snapshot URL and is left alone.
 */
export async function adoptLegacyRecordsDir(instanceRoot: string): Promise<void> {
  const records = join(instanceRoot, "records");
  if (await exists(records)) return;
  const legacy = join(instanceRoot, "data");
  if (!(await isFile(join(legacy, "site.yaml")))) return;
  await rename(legacy, records);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw err;
  }
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
