import { ObjectId } from "mongodb";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), generate: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/current", () => ({ requireUserOrRedirect: mocks.user }));
vi.mock("@/lib/server/curriculumGeneration", () => ({ generateCurriculum: mocks.generate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { generatePathAction } from "@/app/(app)/assessment/actions";

beforeEach(() => vi.resetAllMocks());

it("lets an authentication redirect propagate without generating a path", async () => {
  const redirect = new Error("NEXT_REDIRECT");
  mocks.user.mockRejectedValue(redirect);
  await expect(generatePathAction(new ObjectId().toHexString())).rejects.toBe(redirect);
  expect(mocks.generate).not.toHaveBeenCalled();
});

it("returns generation failures as form feedback", async () => {
  mocks.user.mockResolvedValue({ _id: new ObjectId() });
  mocks.generate.mockRejectedValue(new Error("Please try again"));
  await expect(generatePathAction(new ObjectId().toHexString())).resolves.toEqual({ error: "Please try again" });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});

it("revalidates navigation and redirects to the generated curriculum", async () => {
  const userId = new ObjectId();
  const assessmentId = new ObjectId();
  const curriculumId = new ObjectId();
  const redirect = new Error("NEXT_REDIRECT");
  mocks.user.mockResolvedValue({ _id: userId });
  mocks.generate.mockResolvedValue({ curriculum: { _id: curriculumId } });
  mocks.redirect.mockImplementation(() => { throw redirect; });
  await expect(generatePathAction(assessmentId.toHexString())).rejects.toBe(redirect);
  expect(mocks.generate).toHaveBeenCalledWith(userId, assessmentId);
  expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  expect(mocks.redirect).toHaveBeenCalledWith(`/dashboard?id=${curriculumId}`);
});
