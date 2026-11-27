/**
 * Topic management routes: rename validation, archive and restore, and the
 * delete cascade (owner scoping, curriculum removed first, every dependent
 * collection cleared, the shared onboarding/assessment kept when still used).
 */
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const chain = () => ({ lean: async () => null });
  return {
    user: vi.fn(),
    curriculaUpdate: vi.fn(), curriculaExists: vi.fn(), curriculaDelete: vi.fn(),
    lessonsDelete: vi.fn(), variantsDelete: vi.fn(), decksDelete: vi.fn(), cardsDelete: vi.fn(),
    chatsDelete: vi.fn(), eventsDelete: vi.fn(), prefsUpdate: vi.fn(),
    assessmentsDelete: vi.fn(), assessmentsExists: vi.fn(), onboardingDelete: vi.fn(),
    chain,
  };
});
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/db/collections", () => ({
  curriculaCollection: async () => ({
    updateOne: mocks.curriculaUpdate, exists: mocks.curriculaExists, findOneAndDelete: mocks.curriculaDelete,
  }),
  lessonsCollection: async () => ({ deleteMany: mocks.lessonsDelete }),
  blockVariantsCollection: async () => ({ deleteMany: mocks.variantsDelete }),
  flashcardDecksCollection: async () => ({ deleteMany: mocks.decksDelete }),
  flashcardsCollection: async () => ({ deleteMany: mocks.cardsDelete }),
  chatsCollection: async () => ({ deleteMany: mocks.chatsDelete }),
  progressEventsCollection: async () => ({ deleteMany: mocks.eventsDelete }),
  userPrefsCollection: async () => ({ updateOne: mocks.prefsUpdate }),
  assessmentsCollection: async () => ({ findOneAndDelete: mocks.assessmentsDelete, exists: mocks.assessmentsExists }),
  onboardingCollection: async () => ({ deleteOne: mocks.onboardingDelete }),
}));
import { DELETE as remove, PATCH as rename } from "@/app/api/topics/[id]/route";
import { POST as archive } from "@/app/api/topics/[id]/archive/route";
import { POST as restore } from "@/app/api/topics/[id]/restore/route";

const userId = new ObjectId();
const topicId = new ObjectId();
const assessmentId = new ObjectId();
const onboardingId = new ObjectId();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/topics/x", { method, body: body === undefined ? undefined : JSON.stringify(body) });
const lean = <T,>(value: T) => ({ lean: async () => value });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ _id: userId });
  mocks.curriculaUpdate.mockResolvedValue({ matchedCount: 1 });
  mocks.curriculaExists.mockResolvedValue({ _id: topicId });
  for (const fn of [
    mocks.lessonsDelete, mocks.variantsDelete, mocks.decksDelete, mocks.cardsDelete,
    mocks.chatsDelete, mocks.eventsDelete, mocks.prefsUpdate, mocks.onboardingDelete,
  ]) fn.mockResolvedValue({});
});

describe("auth and ids", () => {
  it("401s without a session and 404s a malformed id", async () => {
    const { unauthorized } = await import("@/lib/http");
    mocks.user.mockRejectedValueOnce(unauthorized());
    expect((await rename(req("PATCH", { title: "x" }), ctx(topicId.toHexString()))).status).toBe(401);
    expect((await remove(req("DELETE"), ctx("not-an-id"))).status).toBe(404);
    expect((await archive(req("POST"), ctx("nope"))).status).toBe(404);
    expect(mocks.curriculaDelete).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/topics/[id]", () => {
  it("trims and saves the title, scoped to the owner", async () => {
    const res = await rename(req("PATCH", { title: "  New name  " }), ctx(topicId.toHexString()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: topicId.toHexString(), title: "New name" });
    const [filter, update] = mocks.curriculaUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: topicId, userId });
    expect(update.$set.title).toBe("New name");
  });

  it("400s empty, whitespace only, too long or missing titles", async () => {
    for (const title of ["", "   ", "x".repeat(121), undefined, 5]) {
      expect((await rename(req("PATCH", { title }), ctx(topicId.toHexString()))).status).toBe(400);
    }
    expect((await rename(req("PATCH", { title: "x".repeat(120) }), ctx(topicId.toHexString()))).status).toBe(200);
  });

  it("404s a topic the learner does not own", async () => {
    mocks.curriculaUpdate.mockResolvedValue({ matchedCount: 0 });
    expect((await rename(req("PATCH", { title: "Mine now" }), ctx(topicId.toHexString()))).status).toBe(404);
  });
});

describe("archive and restore", () => {
  it("sets archivedAt only if not already set", async () => {
    const res = await archive(req("POST"), ctx(topicId.toHexString()));
    expect(await res.json()).toEqual({ id: topicId.toHexString(), archived: true });
    const [filter, update] = mocks.curriculaUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: topicId, userId, archivedAt: null });
    expect(update.$set.archivedAt).toBeInstanceOf(Date);
  });

  it("clears archivedAt on restore", async () => {
    const res = await restore(req("POST"), ctx(topicId.toHexString()));
    expect(await res.json()).toEqual({ id: topicId.toHexString(), archived: false });
    expect(mocks.curriculaUpdate.mock.calls[0][1]).toEqual({ $unset: { archivedAt: "" } });
  });

  it("404s a topic the learner does not own", async () => {
    mocks.curriculaExists.mockResolvedValue(null);
    expect((await archive(req("POST"), ctx(topicId.toHexString()))).status).toBe(404);
    expect((await restore(req("POST"), ctx(topicId.toHexString()))).status).toBe(404);
    expect(mocks.curriculaUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/topics/[id]", () => {
  const scope = () => ({ userId, curriculumId: topicId });

  it("404s a topic the learner does not own and deletes nothing", async () => {
    mocks.curriculaDelete.mockReturnValue(lean(null));
    expect((await remove(req("DELETE"), ctx(topicId.toHexString()))).status).toBe(404);
    expect(mocks.curriculaDelete.mock.calls[0][0]).toEqual({ _id: topicId, userId });
    for (const fn of [mocks.lessonsDelete, mocks.cardsDelete, mocks.chatsDelete, mocks.eventsDelete]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("removes the curriculum and everything tied to it, scoped to user and topic", async () => {
    mocks.curriculaDelete.mockReturnValue(lean({ _id: topicId, userId, assessmentId }));
    mocks.curriculaExists.mockResolvedValue(null);
    mocks.assessmentsDelete.mockReturnValue(lean({ _id: assessmentId, onboardingId }));
    mocks.assessmentsExists.mockResolvedValue(null);

    const res = await remove(req("DELETE"), ctx(topicId.toHexString()));
    expect(res.status).toBe(200);
    for (const fn of [
      mocks.lessonsDelete, mocks.variantsDelete, mocks.decksDelete,
      mocks.cardsDelete, mocks.chatsDelete, mocks.eventsDelete,
    ]) {
      expect(fn).toHaveBeenCalledWith(scope());
    }
    expect(mocks.prefsUpdate).toHaveBeenCalledWith(
      { userId },
      { $pull: { pinnedLessons: { curriculumId: topicId }, recentLessons: { curriculumId: topicId } } },
    );
    expect(mocks.assessmentsDelete.mock.calls[0][0]).toEqual({ _id: assessmentId, userId });
    expect(mocks.onboardingDelete).toHaveBeenCalledWith({ _id: onboardingId, userId });
  });

  it("keeps the assessment while another topic still uses it", async () => {
    mocks.curriculaDelete.mockReturnValue(lean({ _id: topicId, userId, assessmentId }));
    mocks.curriculaExists.mockResolvedValue({ _id: new ObjectId() });
    expect((await remove(req("DELETE"), ctx(topicId.toHexString()))).status).toBe(200);
    expect(mocks.assessmentsDelete).not.toHaveBeenCalled();
    expect(mocks.onboardingDelete).not.toHaveBeenCalled();
  });

  it("keeps the onboarding while another assessment still uses it", async () => {
    mocks.curriculaDelete.mockReturnValue(lean({ _id: topicId, userId, assessmentId }));
    mocks.curriculaExists.mockResolvedValue(null);
    mocks.assessmentsDelete.mockReturnValue(lean({ _id: assessmentId, onboardingId }));
    mocks.assessmentsExists.mockResolvedValue({ _id: new ObjectId() });
    expect((await remove(req("DELETE"), ctx(topicId.toHexString()))).status).toBe(200);
    expect(mocks.onboardingDelete).not.toHaveBeenCalled();
  });
});
