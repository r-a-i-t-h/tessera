import { join } from "node:path";
import { hashPassword } from "../auth/password.js";
import { SessionStore, SESSION_HANDOFF_FILE } from "../auth/sessions.js";
import { normalizedUsername, usernameError } from "../auth/username.js";
import { UserStore } from "../store/users.js";

export async function resetUserPassword(
  dataDir: string,
  username: string,
  newPassword: string,
): Promise<string> {
  const nameProblem = usernameError(username);
  if (nameProblem) throw new Error(nameProblem);
  if (newPassword.length < 6) throw new Error("Password must be at least 6 characters.");

  const users = new UserStore(dataDir);
  await users.load();
  const existing = users.findUser(username);
  if (!existing) throw new Error("User not found");

  const { hash, salt } = await hashPassword(newPassword);
  await users.updatePassword(existing.username, hash, salt);

  const sessionFile = join(dataDir, SESSION_HANDOFF_FILE);
  const sessions = await SessionStore.load(sessionFile);
  sessions.destroyAllForUser(existing.username);
  await sessions.dump();

  return existing.username;
}
