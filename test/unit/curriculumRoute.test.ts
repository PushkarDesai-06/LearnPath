import { ObjectId } from "mongodb";
import { beforeEach, expect, it, vi } from "vitest";
import { curriculumFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({ user: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/server/curriculumGeneration", () => ({ generateCurriculum: mocks.generate }));
import { POST } from "@/app/api/curriculum/generate/route";

beforeEach(() => vi.resetAllMocks());

it("requires a valid explicit assessment ID instead of guessing the latest topic", async () => {
  mocks.user.mockResolvedValue({ _id: new ObjectId() });
  for (const body of [{}, { assessmentId: "bad-id" }]) {
    const response = await POST(new Request("http://localhost/api/curriculum/generate", {
      method: "POST", body: JSON.stringify(body),
    }));
    expect(response.status).toBe(400);
  }
  expect(mocks.generate).not.toHaveBeenCalled();
});

it("passes the selected assessment and authenticated owner to generation", async () => {
  const curriculum = curriculumFixture();
  mocks.user.mockResolvedValue({ _id: curriculum.userId });
  mocks.generate.mockResolvedValue({ curriculum, existed: false });
  const response = await POST(new Request("http://localhost/api/curriculum/generate", {
    method: "POST", body: JSON.stringify({ assessmentId: curriculum.assessmentId.toHexString() }),
  }));
  expect(response.status).toBe(201);
  expect(mocks.generate).toHaveBeenCalledWith(curriculum.userId, curriculum.assessmentId);
});
