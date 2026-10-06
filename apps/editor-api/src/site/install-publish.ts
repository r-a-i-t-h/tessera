import { access, cp, lstat, readdir, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { DistError } from "./dist.js";

const INCOMING = ".tessera-incoming";

/**
 * Replace the files inside an existing directory with a copy of `publish/`.
 * The directory itself stays. `publish/` is not moved.
 * Returns the resolved live path.
 */
export async function installPublish(
  publishDir: string,
  liveDir: string,
  instanceRoot: string,
): Promise<string> {
  const live = assertLiveDir(liveDir, instanceRoot);
  await assertLiveDirReady(live);
  const incoming = resolve(live, INCOMING);
  await rm(incoming, { recursive: true, force: true });
  try {
    await cp(publishDir, incoming, { recursive: true });
  } catch (err) {
    await rm(incoming, { recursive: true, force: true });
    throw new DistError(
      `Could not copy publish/ into the live folder. The live folder was left unchanged. ${errorText(err)}`,
    );
  }
  try {
    for (const name of await readdir(live)) {
      if (name === INCOMING) continue;
      await rm(resolve(live, name), { recursive: true });
    }
    for (const name of await readdir(incoming)) {
      await rename(resolve(incoming, name), resolve(live, name));
    }
    await rm(incoming, { recursive: true });
  } catch (err) {
    throw new DistError(
      `The live folder may be partial. publish/ is unchanged; publish again to finish. ${errorText(err)}`,
    );
  }
  return live;
}

function assertLiveDir(liveDir: string, instanceRoot: string): string {
  const raw = liveDir.trim();
  if (!isAbsolute(raw)) throw new DistError("Publish to must be an absolute path.");
  if (raw.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new DistError("Publish to must not include . or .. path segments.");
  }
  const live = resolve(raw);
  const instance = resolve(instanceRoot);
  if (sameOrInside(instance, live) || sameOrInside(live, instance)) {
    throw new DistError("Publish to must be outside this site directory, and must not contain it.");
  }
  return live;
}

/** Confirm the path is a real, writable directory. Called after the path is accepted. */
async function assertLiveDirReady(live: string): Promise<void> {
  let info;
  try {
    info = await lstat(live);
  } catch {
    throw new DistError(
      "Publish to directory does not exist. Create it and give this process ownership of it before publishing.",
    );
  }
  if (info.isSymbolicLink()) throw new DistError("Publish to must be a real directory, not a symlink.");
  if (!info.isDirectory()) throw new DistError("Publish to must be a directory.");
  try {
    await access(live, constants.W_OK | constants.X_OK);
  } catch {
    throw new DistError("This process cannot write the publish to directory.");
  }
}

function sameOrInside(root: string, target: string): boolean {
  if (target === root) return true;
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return target.startsWith(prefix);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Could not install the published files.";
}
