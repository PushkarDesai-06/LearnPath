import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentDoc, OnboardingDoc } from "@/lib/db/models";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), onboardingFind: vi.fn(), assessmentFind: vi.fn(),
  onboardingCreate: vi.fn(), onboardingUpdate: vi.fn(), assessmentCreate: vi.fn(),
  quiz: vi.fn(), clarity: vi.fn(),
}));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/ai/agents/assessment", () => ({ runQuizGenAgent: mocks.quiz }));
vi.mock("@/lib/ai/agents/clarity", () => ({ runClarityAgent: mocks.clarity }));
vi.mock("@/lib/db/collections", () => ({
  onboardingCollection: async () => ({
    findOne: mocks.onboardingFind, create: mocks.onboardingCreate, updateOne: mocks.onboardingUpdate,
  }),
  assessmentsCollection: async () => ({ findOne: mocks.assessmentFind, create: mocks.assessmentCreate }),
}));
import { POST as start } from "@/app/api/assessment/start/route";
import { POST as clarify } from "@/app/api/onboarding/clarity/route";

const owner = new ObjectId();
let setup: OnboardingDoc;
let assessment: AssessmentDoc;
const request = (body?: string) => new Request("http://localhost/api", { method: "POST", body });

beforeEach(() => {
  vi.resetAllMocks();
  setup = {
    _id: new ObjectId(), userId: owner, rawDescription: "SQL", status: "assessing",
    clarity: { clearEnough: true, cycle: 1, maxCycles: 4, exchanges: [] },
    createdAt: new Date(), updatedAt: new Date(),
  };
  assessment = {
    _id: new ObjectId(), userId: owner, onboardingId: setup._id, domain: "SQL", refinedTopic: "SQL",
    state: "in_progress", levels: ["beginner"], rounds: 1, questions: [],
    createdAt: new Date(), updatedAt: new Date(),
  };
  mocks.user.mockResolvedValue({ _id: owner });
  mocks.onboardingFind.mockImplementation((filter) => {
    const query = {
      sort: () => query,
      lean: async () => filter.userId.equals(setup.userId)
        && (filter._id === undefined || filter._id?.equals(setup._id)) ? setup : null,
    };
    return query;
  });
  mocks.assessmentFind.mockImplementation(() => ({ sort: () => ({ lean: async () => assessment }) }));
});

describe("assessment start", () => {
  it.each([undefined, "", "{}"])("resumes the newest setup for body %s", async (body) => {
    const response = await start(request(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ assessmentId: assessment._id.toHexString() });
    expect(mocks.onboardingFind).toHaveBeenCalledWith({ userId: owner, status: { $in: ["ready", "assessing"] } });
    expect(mocks.quiz).not.toHaveBeenCalled();
  });

  it("scopes explicit setup and assessment lookups to the signed-in learner", async () => {
    expect((await start(request(JSON.stringify({ onboardingId: setup._id.toHexString() })))).status).toBe(200);
    expect(mocks.onboardingFind).toHaveBeenCalledWith({
      _id: setup._id, userId: owner, status: { $in: ["ready", "assessing"] },
    });
    expect(mocks.assessmentFind).toHaveBeenCalledWith({ userId: owner, onboardingId: setup._id });
  });

  it.each(["{broken", "null", '{"onboardingId":12}', " "])("rejects invalid non-empty body %s", async (body) => {
    expect((await start(request(body))).status).toBe(400);
    expect(mocks.onboardingFind).not.toHaveBeenCalled();
  });

  it("rejects a foreign setup without falling back to the learner's newest setup", async () => {
    setup.userId = new ObjectId();
    expect((await start(request(JSON.stringify({ onboardingId: setup._id.toHexString() })))).status).toBe(400);
    expect(mocks.onboardingFind).toHaveBeenCalledWith(expect.objectContaining({ userId: owner, _id: setup._id }));
    expect(mocks.assessmentFind).not.toHaveBeenCalled();
    expect(mocks.quiz).not.toHaveBeenCalled();
  });

  it("rejects a malformed setup ID without generating a quiz", async () => {
    expect((await start(request('{"onboardingId":"bad-id"}'))).status).toBe(400);
    expect(mocks.assessmentFind).not.toHaveBeenCalled();
    expect(mocks.quiz).not.toHaveBeenCalled();
  });
});

describe("onboarding clarity", () => {
  it("rejects another learner's setup before calling the agent or writing", async () => {
    setup.userId = new ObjectId();
    const response = await clarify(request(JSON.stringify({ description: "joins", onboardingId: setup._id.toHexString() })));
    expect(response.status).toBe(404);
    expect(mocks.onboardingFind).toHaveBeenCalledWith({ _id: setup._id, userId: owner });
    expect(mocks.clarity).not.toHaveBeenCalled();
    expect(mocks.onboardingCreate).not.toHaveBeenCalled();
    expect(mocks.onboardingUpdate).not.toHaveBeenCalled();
  });

  it("rejects a malformed setup ID before querying or calling the agent", async () => {
    expect((await clarify(request('{"description":"joins","onboardingId":"bad-id"}'))).status).toBe(400);
    expect(mocks.onboardingFind).not.toHaveBeenCalled();
    expect(mocks.clarity).not.toHaveBeenCalled();
  });

  it("refuses to continue a setup that has already reached assessment", async () => {
    const response = await clarify(request(JSON.stringify({ description: "joins", onboardingId: setup._id.toHexString() })));
    expect(response.status).toBe(409);
    expect(mocks.clarity).not.toHaveBeenCalled();
    expect(mocks.onboardingUpdate).not.toHaveBeenCalled();
  });
});
