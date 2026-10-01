const USERNAME_MAX = 64;

/** Same rule as `apps/editor-api/src/auth/username.ts`. Empty string means valid. */
export function usernameError(raw: string): string {
  const username = raw.trim();
  if (!hasVisibleCharacter(username)) {
    return "Username must include at least one visible character.";
  }
  if (!/^\p{L}/u.test(username)) return "Username must start with a letter.";
  if (username.length > USERNAME_MAX || !/^[\p{L}\p{N}._-]+$/u.test(username)) {
    return "Username can use letters, numbers, dots, underscores, and hyphens, up to 64 characters.";
  }
  return "";
}

function hasVisibleCharacter(value: string): boolean {
  return /[^\s\p{Cf}\p{Cc}]/u.test(value);
}
