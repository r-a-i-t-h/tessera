import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../src/auth/password.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const username = process.argv[2] ?? "admin";
const password = process.argv[3] ?? "admin";

if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username)) {
  console.error("Username must be 2–32 characters: letters, numbers, _ or -.");
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const { hash, salt } = await hashPassword(password);
const user = {
  username,
  passwordHash: hash,
  passwordSalt: salt,
  createdAt: new Date().toISOString(),
};

const dir = join(root, "seed", "users");
await mkdir(dir, { recursive: true });
const path = join(dir, `${username}.json`);
await writeFile(path, `${JSON.stringify(user, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Wrote ${path} (password: ${password})`);
