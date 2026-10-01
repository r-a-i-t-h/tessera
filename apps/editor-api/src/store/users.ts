import { randomBytes } from "node:crypto";
import { cp, mkdir, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { normalizedUsername, usernameError } from "../auth/username.js";
import type { UserRecord } from "../model.js";
import { readJson, writeJsonAtomic } from "./fs.js";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUser(raw: Record<string, unknown>): UserRecord | undefined {
  const username = String(raw.username ?? "").trim();
  const passwordHash = String(raw.passwordHash ?? "");
  const passwordSalt = String(raw.passwordSalt ?? "");
  if (!username || !passwordHash || !passwordSalt) return undefined;
  const user: UserRecord = {
    username,
    passwordHash,
    passwordSalt,
    createdAt: String(raw.createdAt ?? nowIso()),
  };
  if (raw.disabled === true) user.disabled = true;
  return user;
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

/**
 * Editors for one site directory. Files are `$TESSERA_DATA/users/<username>.json`.
 * `seed/users` is copied once, when that folder is empty. A later boot does not
 * overwrite them, and another `TESSERA_DATA` directory has its own users.
 * There is no self-signup.
 */
export class UserStore {
  private users = new Map<string, UserRecord>();

  constructor(readonly dataDir: string) {}

  async load(seedDir?: string): Promise<void> {
    const usersDir = join(this.dataDir, "users");
    await mkdir(usersDir, { recursive: true });

    if (seedDir && (await listJsonFiles(usersDir)).length === 0) {
      try {
        await cp(join(seedDir, "users"), usersDir, { recursive: true });
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw err;
      }
    }

    this.users.clear();
    for (const file of await listJsonFiles(usersDir)) {
      const raw = await readJson<Record<string, unknown>>(join(usersDir, file));
      const user = normalizeUser(raw);
      if (user) this.users.set(user.username, user);
    }
  }

  getUser(username: string): UserRecord | undefined {
    return this.users.get(username);
  }

  /** Case-insensitive match. `Admin` and `admin` share one file on a case-insensitive disk. */
  findUser(username: string): UserRecord | undefined {
    const key = normalizedUsername(username).toLowerCase();
    if (!key) return undefined;
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === key) return user;
    }
    return undefined;
  }

  listUsers(): UserRecord[] {
    return [...this.users.values()].sort((a, b) => a.username.localeCompare(b.username));
  }

  async saveUser(user: UserRecord): Promise<void> {
    this.users.set(user.username, user);
    await writeJsonAtomic(join(this.dataDir, "users", `${user.username}.json`), user, {
      mode: 0o600,
    });
  }

  async createUser(username: string, passwordHash: string, passwordSalt: string): Promise<UserRecord> {
    const name = checkedUsername(username);
    if (this.findUser(name)) throw new Error("Username already taken");
    const user: UserRecord = {
      username: name,
      passwordHash,
      passwordSalt,
      createdAt: nowIso(),
    };
    await this.saveUser(user);
    return user;
  }

  async renameUser(from: string, to: string): Promise<UserRecord> {
    const existing = this.users.get(from);
    if (!existing) throw new Error("User not found");
    const next = checkedUsername(to);
    if (from === next) return existing;
    const clash = this.findUser(next);
    if (clash && clash.username !== from) throw new Error("Username already taken");

    const updated: UserRecord = { ...existing, username: next };
    const dir = join(this.dataDir, "users");
    const fromPath = join(dir, `${from}.json`);
    const toPath = join(dir, `${next}.json`);
    const staging = join(dir, `.${randomBytes(8).toString("hex")}.json.staging`);
    const backup = `${fromPath}.bak`;
    await writeJsonAtomic(staging, updated, { mode: 0o600 });
    await rename(fromPath, backup);
    try {
      await rename(staging, toPath);
    } catch (err) {
      await rename(backup, fromPath).catch(() => undefined);
      await unlink(staging).catch(() => undefined);
      throw err;
    }
    await unlink(backup).catch(() => undefined);
    this.users.delete(from);
    this.users.set(next, updated);
    return updated;
  }

  async setDisabled(username: string, disabled: boolean): Promise<UserRecord> {
    const existing = this.users.get(username);
    if (!existing) throw new Error("User not found");
    const updated: UserRecord = { ...existing, disabled: disabled ? true : undefined };
    await this.saveUser(updated);
    return updated;
  }

  async deleteUser(username: string): Promise<void> {
    const existing = this.users.get(username);
    if (!existing) throw new Error("User not found");
    await unlink(join(this.dataDir, "users", `${username}.json`)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT") throw err;
    });
    this.users.delete(username);
  }

  async updatePassword(
    username: string,
    passwordHash: string,
    passwordSalt: string,
  ): Promise<UserRecord> {
    const existing = this.users.get(username);
    if (!existing) throw new Error("User not found");
    const updated: UserRecord = { ...existing, passwordHash, passwordSalt };
    await this.saveUser(updated);
    return updated;
  }
}

function checkedUsername(raw: string): string {
  const problem = usernameError(raw);
  if (problem) throw new Error(problem);
  return normalizedUsername(raw);
}
