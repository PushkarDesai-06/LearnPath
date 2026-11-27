/**
 * The /api/me routes: pins (cap, ownership, reorder), recents and view prefs.
 * The prefs document is an in-memory stand-in so the real route logic and the
 * real list helpers run end to end.
 */
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "@/lib/http";
import { defaultPrefs } from "@/lib/server/prefs";
import type { UserPrefsDoc } from "@/lib/db/models";

const state = vi.hoisted(() => ({
  user: vi.fn(),
  owned: vi.fn(),
  prefs: null as unknown,
}));
vi.mock("@/lib/auth/guards", () => ({ requireUser: state.user }));
vi.mock("@/lib/server/prefs", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/server/prefs")>()),
  requireOwnedLesson: state.owned,
  mutatePrefs: async (
    _userId: ObjectId,
    mutate: (p: UserPrefsDoc) => { value: unknown; changes?: Partial<UserPrefsDoc> },
  ) => {
    const { value, changes } = mutate(state.prefs as UserPrefsDoc);
    if (changes) state.prefs = { ...(state.prefs as UserPrefsDoc), ...changes };
    return value;
  },
}));
import { PATCH as reorderPins, POST as pin } from "@/app/api/me/pins/route";
import { DELETE as unpin } from "@/app/api/me/pins/[lessonId]/route";
import { POST as visit } from "@/app/api/me/recents/route";
import { DELETE as forget } from "@/app/api/me/recents/[lessonId]/route";
import { PATCH as patchPrefs } from "@/app/api/me/prefs/route";

const userId = new ObjectId();
const curriculumId = new ObjectId();
const send = (handler: (r: Request, c?: never) => Promise<Response>, method: string, body?: unknown) =>
  handler(new Request("http://localhost/api/me", { method, body: body === undefined ? undefined : JSON.stringify(body) }));
const withParam = (lessonId: string) => ({ params: Promise.resolve({ lessonId }) });
const current = () => state.prefs as UserPrefsDoc;
const pinned = () => current().pinnedLessons.map((p) => p.lessonId);

beforeEach(() => {
  vi.resetAllMocks();
  state.prefs = defaultPrefs(userId);
  state.user.mockResolvedValue({ _id: userId });
  state.owned.mockResolvedValue(curriculumId);
});

describe("auth", () => {
  it("rejects every route without a session", async () => {
    const { unauthorized } = await import("@/lib/http");
    state.user.mockRejectedValue(unauthorized());
    const body = { curriculumId: curriculumId.toHexString(), lessonId: "l1" };
    expect((await send(pin, "POST", body)).status).toBe(401);
    expect((await send(reorderPins, "PATCH", { order: [] })).status).toBe(401);
    expect((await unpin(new Request("http://x", { method: "DELETE" }), withParam("l1"))).status).toBe(401);
    expect((await send(visit, "POST", body)).status).toBe(401);
    expect((await forget(new Request("http://x", { method: "DELETE" }), withParam("l1"))).status).toBe(401);
    expect((await send(patchPrefs, "PATCH", { focusLessons: true })).status).toBe(401);
  });
});

describe("POST /api/me/pins", () => {
  const body = (lessonId: string) => ({ curriculumId: curriculumId.toHexString(), lessonId });

  it("pins an owned lesson", async () => {
    const res = await send(pin, "POST", body("l1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pins).toHaveLength(1);
    expect(json.pins[0]).toMatchObject({ curriculumId: curriculumId.toHexString(), lessonId: "l1" });
    expect(state.owned).toHaveBeenCalledWith(userId, curriculumId.toHexString(), "l1");
  });

  it("is idempotent for a lesson that is already pinned", async () => {
    await send(pin, "POST", body("l1"));
    await send(pin, "POST", body("l1"));
    expect(pinned()).toEqual(["l1"]);
  });

  it("404s a lesson the learner does not own and pins nothing", async () => {
    state.owned.mockRejectedValue(notFound("Lesson not found"));
    expect((await send(pin, "POST", body("foreign"))).status).toBe(404);
    expect(pinned()).toEqual([]);
  });

  it("409s when 10 lessons are already pinned", async () => {
    for (let i = 0; i < 10; i++) expect((await send(pin, "POST", body(`l${i}`))).status).toBe(200);
    const res = await send(pin, "POST", body("l10"));
    expect(res.status).toBe(409);
    expect(pinned()).toHaveLength(10);
  });

  it("400s malformed bodies", async () => {
    for (const bad of [{}, { curriculumId: "nope", lessonId: "l1" }, { curriculumId: curriculumId.toHexString() }]) {
      expect((await send(pin, "POST", bad)).status).toBe(400);
    }
    expect(state.owned).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/me/pins", () => {
  beforeEach(async () => {
    for (const id of ["a", "b", "c"]) {
      await send(pin, "POST", { curriculumId: curriculumId.toHexString(), lessonId: id });
    }
  });

  it("reorders and never drops a pin", async () => {
    const res = await send(reorderPins, "PATCH", { order: ["c", "a"] });
    expect(res.status).toBe(200);
    expect(pinned()).toEqual(["c", "a", "b"]);
  });

  it("400s a body that is not a list of ids", async () => {
    expect((await send(reorderPins, "PATCH", { order: "a" })).status).toBe(400);
    expect((await send(reorderPins, "PATCH", {})).status).toBe(400);
  });
});

describe("DELETE /api/me/pins/[lessonId]", () => {
  it("unpins, and an unpinned lesson is a no-op", async () => {
    await send(pin, "POST", { curriculumId: curriculumId.toHexString(), lessonId: "a" });
    const del = (id: string) => unpin(new Request("http://x", { method: "DELETE" }), withParam(id));
    expect((await (await del("a")).json()).pins).toEqual([]);
    expect((await del("a")).status).toBe(200);
  });
});

describe("recents", () => {
  const body = (lessonId: string) => ({ curriculumId: curriculumId.toHexString(), lessonId });

  it("records newest first, moves repeats to the front and caps at 6", async () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) await send(visit, "POST", body(id));
    await send(visit, "POST", body("d"));
    const ids = current().recentLessons.map((r) => r.lessonId);
    expect(ids).toEqual(["d", "g", "f", "e", "c", "b"]);
  });

  it("404s a lesson the learner does not own", async () => {
    state.owned.mockRejectedValue(notFound("Lesson not found"));
    expect((await send(visit, "POST", body("foreign"))).status).toBe(404);
    expect(current().recentLessons).toEqual([]);
  });

  it("removes one entry", async () => {
    await send(visit, "POST", body("a"));
    await send(visit, "POST", body("b"));
    const res = await forget(new Request("http://x", { method: "DELETE" }), withParam("a"));
    expect((await res.json()).recents.map((r: { lessonId: string }) => r.lessonId)).toEqual(["b"]);
  });
});

describe("PATCH /api/me/prefs", () => {
  it("merges a partial dashboard update without touching the rest", async () => {
    const res = await send(patchPrefs, "PATCH", { dashboard: { groupBy: "status" } });
    expect(res.status).toBe(200);
    expect((await res.json()).prefs).toEqual({
      dashboard: { groupBy: "status", hideMastered: false, hideLocked: false, showSummaries: true },
      collapsedGroups: [],
      focusLessons: false,
    });
  });

  it("updates collapsed groups and focus independently", async () => {
    await send(patchPrefs, "PATCH", { collapsedGroups: ["m1", "m2"] });
    await send(patchPrefs, "PATCH", { focusLessons: true });
    expect(current()).toMatchObject({ collapsedGroups: ["m1", "m2"], focusLessons: true });
  });

  it("400s empty, unknown or mistyped fields", async () => {
    for (const bad of [
      {},
      { nope: 1 },
      { focusLessons: "yes" },
      { dashboard: { groupBy: "size" } },
      { dashboard: { extra: true } },
      { collapsedGroups: [1] },
    ]) {
      expect((await send(patchPrefs, "PATCH", bad)).status).toBe(400);
    }
  });
});
