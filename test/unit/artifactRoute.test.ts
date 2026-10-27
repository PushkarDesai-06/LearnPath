/**
 * The artifact route serves model-written HTML, so it must apply the lesson's
 * own ownership + module-access rules and always attach the sandboxing CSP.
 */
import { ObjectId } from "mongodb";
import { beforeEach, expect, it, vi } from "vitest";
import { curriculumFixture, lessonFixture } from "../helpers/curriculum";

const mocks = vi.hoisted(() => ({ user: vi.fn(), locate: vi.fn(), findOne: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/server/curriculumLocate", () => ({ locateLesson: mocks.locate, publicLessonBlock: (b: unknown) => b }));
vi.mock("@/lib/db/collections", () => ({ lessonsCollection: async () => ({ findOne: mocks.findOne }) }));
import { GET } from "@/app/api/lesson/[lessonId]/artifact/[blockId]/route";

const curriculum = curriculumFixture();
const params = (lessonId = "lesson-1", blockId = "b1") => ({ params: Promise.resolve({ lessonId, blockId }) });
const request = () => new Request("http://localhost/api/lesson/lesson-1/artifact/b1");
const lessonDoc = (artifactStatus: string) => ({
  _id: new ObjectId(), title: "Lesson",
  blocks: [{ kind: "interactive", blockId: "b1", caption: "Demo", artifactStatus, artifactHtml: "<script>go()</script>" }],
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ _id: curriculum.userId });
  mocks.locate.mockResolvedValue({ curriculum, module: curriculum.modules[0], lesson: curriculum.modules[0].lessons[0] });
  mocks.findOne.mockReturnValue({ lean: async () => lessonDoc("ready") });
});

it("serves a ready artifact as a sandboxed HTML document", async () => {
  const res = await GET(request(), params());
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(res.headers.get("content-security-policy")).toContain("sandbox allow-scripts");
  expect(res.headers.get("content-security-policy")).toContain("connect-src 'none'");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  const body = await res.text();
  expect(body).toContain("<script>go()</script>");
  expect(body).toContain("<title>Demo</title>");
});

it("404s for another user's lesson, an unknown block, or an unbuilt artifact", async () => {
  mocks.locate.mockResolvedValueOnce(null);
  expect((await GET(request(), params())).status).toBe(404);
  expect((await GET(request(), params("lesson-1", "nope"))).status).toBe(404);
  mocks.findOne.mockReturnValue({ lean: async () => lessonDoc("pending") });
  expect((await GET(request(), params())).status).toBe(404);
});

it("rejects a locked module before loading the lesson", async () => {
  const locked = curriculumFixture();
  locked.modules = Array.from({ length: 3 }, (_, i) => ({
    ...locked.modules[0], id: `m${i}`, order: i, lessons: [lessonFixture(`l${i}`)],
  }));
  mocks.locate.mockResolvedValue({ curriculum: locked, module: locked.modules[2], lesson: locked.modules[2].lessons[0] });
  const res = await GET(request(), params("l2"));
  expect(res.status).toBe(403);
  expect(mocks.findOne).not.toHaveBeenCalled();
});
