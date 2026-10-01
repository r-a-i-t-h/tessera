const USERNAME_MAX = 64;

/**
 * Editor usernames. The seed script used to be the only check
 * (`/^[a-zA-Z0-9_-]{2,32}$/`, which did not require a leading letter).
 * Creating, renaming, and seeding now share this rule. The value is also a
 * filename under `users/`, so the rest of the name stays inside a safe set.
 */
export function usernameError(raw: string): string | undefined {
  const username = raw.trim();
  if (!hasVisibleCharacter(username)) {
    return "Username must include at least one visible character.";
  }
  if (!/^\p{L}/u.test(username)) return "Username must start with a letter.";
  if (username.length > USERNAME_MAX || !/^[\p{L}\p{N}._-]+$/u.test(username)) {
    return "Username can use letters, numbers, dots, underscores, and hyphens, up to 64 characters.";
  }
  return undefined;
}

export function normalizedUsername(raw: string): string {
  return raw.trim();
}

function hasVisibleCharacter(value: string): boolean {
  return /[^\s\p{Cf}\p{Cc}]/u.test(value);
}
