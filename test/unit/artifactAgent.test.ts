/**
 * runArtifactAgent with the runner mocked: a sandbox-breaking reply gets one
 * corrective retry carrying the extractor's feedback, and the stored value is
 * the extracted fragment, not the raw reply.
 */
import { beforeEach, expect, it, vi } from "vitest";

const run = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/provider", () => ({ modelName: () => "test-model", getRunner: () => ({ run }) }));
import { runArtifactAgent } from "@/lib/ai/agents/artifact";

const INPUT = {
  lessonTitle: "Binary search", objectives: ["Halve the range"], learnerLevel: "beginner",
  gaps: ["logarithms"], topicMastery: [{ topic: "search", score: 0.4 }],
  title: "Binary search, step by step", spec: "Concept: halving.",
};

beforeEach(() => run.mockReset());

it("retries a sandbox-breaking reply with feedback, then returns the fragment", async () => {
  run
    .mockResolvedValueOnce({ finalOutput: "```html\n<script>fetch('/x')</script>\n```" })
    .mockResolvedValueOnce({ finalOutput: "```html\n<button id=a>Step</button><script>a.onclick=()=>{}</script>\n```" });
  const html = await runArtifactAgent(INPUT);
  expect(html).toBe("<button id=a>Step</button><script>a.onclick=()=>{}</script>");
  expect(run).toHaveBeenCalledTimes(2);
  const firstPrompt = run.mock.calls[0][1] as string;
  expect(firstPrompt).toContain("Learner gaps: logarithms");
  expect(firstPrompt).toContain("search 40%");
  expect(run.mock.calls[1][1]).toMatch(/no network access/);
});

it("surfaces a 502 after two unusable replies", async () => {
  run.mockResolvedValue({ finalOutput: "I can't build that." });
  await expect(runArtifactAgent(INPUT)).rejects.toMatchObject({ status: 502 });
});
