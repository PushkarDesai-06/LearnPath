import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("produces a bcrypt hash distinct from the plaintext", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).not.toBe("hunter2");
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
  }, 15_000);

  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  }, 15_000);

  it("salts: the same password hashes to different values", async () => {
    const [a, b] = await Promise.all([
      hashPassword("samepass"),
      hashPassword("samepass"),
    ]);
    expect(a).not.toBe(b);
    expect(await verifyPassword("samepass", a)).toBe(true);
    expect(await verifyPassword("samepass", b)).toBe(true);
  }, 20_000);
});
