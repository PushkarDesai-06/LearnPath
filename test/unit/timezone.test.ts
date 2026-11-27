import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieStore.value === undefined ? undefined : { value: cookieStore.value }),
  }),
}));
import { readTimeZone } from "@/lib/server/timezone";

beforeEach(() => {
  cookieStore.value = undefined;
});

describe("readTimeZone", () => {
  it("returns a valid cookie zone", async () => {
    cookieStore.value = "Asia/Kolkata";
    expect(await readTimeZone()).toBe("Asia/Kolkata");
  });

  it("decodes a URL encoded zone", async () => {
    cookieStore.value = "America%2FNew_York";
    expect(await readTimeZone()).toBe("America/New_York");
  });

  it("falls back to UTC when the cookie is missing, empty or not a zone", async () => {
    expect(await readTimeZone()).toBe("UTC");
    for (const bad of ["", "Mars/Olympus", "%E0%A4%A", "<script>"]) {
      cookieStore.value = bad;
      expect(await readTimeZone()).toBe("UTC");
    }
  });
});
