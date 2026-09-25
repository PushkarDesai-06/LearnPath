import { beforeEach, expect, it, vi } from "vitest";
import { curriculumFixture, lessonFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({ user: vi.fn(), locate: vi.fn(), lessons: vi.fn(), grade: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/server/curriculumLocate", () => ({ locateLesson: mocks.locate }));
vi.mock("@/lib/db/collections", () => ({ lessonsCollection: mocks.lessons }));
vi.mock("@/lib/ai/agents/grading", () => ({ runAnswerGradeAgent: mocks.grade }));
vi.mock("@/lib/server/practiceProgress", () => ({ recordPractice: mocks.record }));
import { POST } from "@/app/api/lesson/[lessonId]/practice/route";

beforeEach(() => vi.resetAllMocks());

it("rejects locked practice before loading answers, calling AI, or writing progress", async () => {
  const curriculum = curriculumFixture();
  curriculum.modules = Array.from({ length: 3 }, (_, i) => ({
    ...curriculum.modules[0], id: `m${i}`, order: i, lessons: [lessonFixture(`l${i}`)],
  }));
  mocks.user.mockResolvedValue({ _id: curriculum.userId });
  mocks.locate.mockResolvedValue({ curriculum, module: curriculum.modules[2], lesson: curriculum.modules[2].lessons[0] });
  const response = await POST(new Request("http://localhost/api/lesson/l2/practice", {
    method: "POST", body: JSON.stringify({ questionId: "q1", answer: "answer" }),
  }), { params: Promise.resolve({ lessonId: "l2" }) });
  expect(response.status).toBe(403);
  expect(mocks.lessons).not.toHaveBeenCalled();
  expect(mocks.grade).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
