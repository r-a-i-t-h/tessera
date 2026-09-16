import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
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
  return {
    username,
    passwordHash,
    passwordSalt,
    createdAt: String(raw.createdAt ?? nowIso()),
  };
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
 * File-backed user map. Each editor is `data/users/<username>.json`.
 * There is no self-signup; add users with the seed:user script.
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

  async saveUser(user: UserRecord): Promise<void> {
    this.users.set(user.username, user);
    await writeJsonAtomic(join(this.dataDir, "users", `${user.username}.json`), user, {
      mode: 0o600,
    });
  }

  async createUser(username: string, passwordHash: string, passwordSalt: string): Promise<UserRecord> {
    if (this.users.has(username)) {
      throw new Error("Username already taken");
    }
    const user: UserRecord = {
      username,
      passwordHash,
      passwordSalt,
      createdAt: nowIso(),
    };
    await this.saveUser(user);
    return user;
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
