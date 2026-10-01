import { describe, expect, it } from "vitest";
import { usernameError } from "./username";

describe("usernameError", () => {
  it("accepts a short name that starts with a letter", () => {
    expect(usernameError("a")).toBe("");
    expect(usernameError("  Alice_2 ")).toBe("");
    expect(usernameError("Édith")).toBe("");
  });

  it("rejects blank, non-letters, and filename-unsafe characters", () => {
    expect(usernameError("   ")).toBe("Username must include at least one visible character.");
    expect(usernameError("\u200b")).toBe("Username must include at least one visible character.");
    expect(usernameError("1abc")).toBe("Username must start with a letter.");
    expect(usernameError("_admin")).toBe("Username must start with a letter.");
    expect(usernameError("a b")).toBe(
      "Username can use letters, numbers, dots, underscores, and hyphens, up to 64 characters.",
    );
    expect(usernameError(`a${"b".repeat(64)}`)).toBe(
      "Username can use letters, numbers, dots, underscores, and hyphens, up to 64 characters.",
    );
  });
});
