import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password.js";

describe("password hashing", () => {
  it("verifies a freshly hashed password", async () => {
    const { hash, salt } = await hashPassword("secret-pass");
    expect(await verifyPassword("secret-pass", hash, salt)).toBe(true);
    expect(await verifyPassword("wrong", hash, salt)).toBe(false);
  });

  it("verifies the committed seed admin password", async () => {
    expect(
      await verifyPassword(
        "admin",
        "a9ad5bcfa4a264557f9b451c2e06987b600585739edd96681faec4c9133496bc22507e42b7a0a777c344732e9ba414a836c2414eb737a35f587d3862638cc9c7",
        "45950efa6cebcc04bc7ae014e96cb26d",
      ),
    ).toBe(true);
  });
});
