/**
 * artifactAgent — turns an `interactive` lesson block's `spec` into a small
 * self-contained HTML/CSS/JS demo. It runs in a second pass
 * (lib/jobs/artifactWorker.ts) after the lesson is already readable.
 *
 * Deliberately NO `outputType`: a large code string under strict structured
 * output is slow (constrained decoding) and fragile. The agent replies in plain
 * text with one ```html fence, and the schema below extracts + validates it so
 * runAgent's corrective retry still applies.
 */
import { Agent } from "@openai/agents";
import { z } from "zod";
import { modelName } from "@/lib/ai/provider";
import { runAgent } from "@/lib/ai/runAgent";
import { extractArtifactHtml } from "@/lib/ai/artifactHtml";
import { learnerProfile, type LessonGenInput } from "@/lib/ai/agents/lesson";

const artifactAgent = new Agent({
  name: "Artifact Builder",
  model: modelName(),
  instructions: `
# Role
You are the 'artifactAgent'. You build ONE small interactive demo that runs inside a lesson, from a brief ('spec').

# Output format (CRITICAL)
- Reply with exactly one fenced block: \`\`\`html ... \`\`\` and nothing else.
- The block is a BODY FRAGMENT: optional <style>, the markup, then one inline <script>. No <html>, <head> or <body> tags.

# Sandbox rules (anything else breaks the demo)
- Plain inline JavaScript only. No modules, imports, libraries, CDNs or external URLs.
- No network: no fetch, XMLHttpRequest, WebSocket.
- No storage: no localStorage, sessionStorage, indexedDB, cookies. Keep state in variables.
- No alert/confirm/prompt dialogs and no <form>. Show messages in the page.
- Draw with SVG, <canvas> or DOM elements.

# Styling
- The page already defines CSS variables: --bg, --surface, --fg, --muted, --border, --accent, --accent-fg, --highlight, --danger, --success, --series-1, --series-2, --series-3, --radius, --font, --mono. Use them for every colour; never hard-code colours and NEVER redeclare these variables (no :root block). The page background is already dark.
- Buttons, inputs and range sliders are pre-styled; don't restyle them.
- Must fit widths from 320px to 700px: use percentages, flex-wrap and an SVG viewBox. Keep total height under 600px.

# Pedagogy
- Implement the spec's Controls, Behaviour and Takeaway exactly. One focused idea, not a full app.
- Start in a meaningful initial state, so something is visible before any interaction.
- Label every control. Show live values next to sliders.
- Include a one-line takeaway or live explanation text that updates with the state.
- Every control must be usable by keyboard (native buttons, inputs, selects).
- Match the learner's level: simpler wording for beginners, more precise terms for advanced learners.
`,
});

/** Extract + validate the fenced HTML; failures become runAgent retry feedback. */
const artifactReplySchema = z.string().transform((reply, ctx) => {
  const result = extractArtifactHtml(reply);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.html;
});

export interface ArtifactGenInput
  extends Pick<LessonGenInput, "strengths" | "gaps" | "topicMastery"> {
  lessonTitle: string;
  objectives: string[];
  learnerLevel: string;
  title: string;
  spec: string;
  /** Markdown of the text block the demo follows, for matching terminology. */
  context?: string;
}

export function runArtifactAgent(input: ArtifactGenInput): Promise<string> {
  const prompt = `Lesson title: ${input.lessonTitle}
Objectives: ${input.objectives.join("; ")}
Learner's overall level: ${input.learnerLevel}
${learnerProfile(input)}
Demo title: ${input.title}
Spec:
${input.spec}
${input.context ? `\nLesson text just before the demo:\n${input.context.slice(0, 2000)}\n` : ""}
Build the demo.`;
  return runAgent(artifactAgent, prompt, artifactReplySchema);
}
