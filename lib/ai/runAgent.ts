/**
 * Runs an Agents-SDK agent and parses its reply into a zod schema.
 *
 * Rather than depend on Gemini honoring strict JSON-schema `response_format`
 * (support is inconsistent across the OpenAI-compat layer), agents are plain
 * text agents instructed to emit a JSON object, and we parse that text here.
 * On a parse/validation failure we retry once with a corrective nudge appended.
 */
import type { Agent } from "@openai/agents";
import type { ZodType } from "zod";
import { getRunner } from "@/lib/ai/provider";
import { ApiError } from "@/lib/http";

/**
 * Recursively drop null-valued keys. Models often include optional fields with
 * an explicit `null` instead of omitting them, which zod's `.optional()` rejects;
 * treating null as "absent" makes parsing robust.
 */
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

/** Pull a JSON object/array out of a model reply that may wrap it in prose or fences. */
function extractJson(text: string): string {
  const trimmed = text.trim();

  // ```json ... ``` or ``` ... ``` fenced block
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();

  // Otherwise grab from the first { or [ to its matching last } or ]
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
  if (start === -1) return trimmed;

  const openChar = trimmed[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = trimmed.lastIndexOf(closeChar);
  if (end <= start) return trimmed;
  return trimmed.slice(start, end + 1);
}

export async function runAgentStructured<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: Agent<any, any>,
  input: string,
  schema: ZodType<T>,
): Promise<T> {
  const runner = getRunner();
  let currentInput = input;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      const result = await runner.run(agent, currentInput);
      text = (result.finalOutput as string | undefined) ?? "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      continue;
    }

    let candidate: unknown;
    try {
      candidate = stripNulls(JSON.parse(extractJson(text)));
    } catch {
      lastError = "Response was not valid JSON";
      candidate = undefined;
    }

    if (candidate !== undefined) {
      const parsed = schema.safeParse(candidate);
      if (parsed.success) return parsed.data;
      lastError = JSON.stringify(parsed.error.issues);
    }

    currentInput =
      input +
      `\n\nYour previous reply could not be used (${lastError}). ` +
      `Respond with ONLY a single valid JSON object matching the required shape — no prose, no markdown fences.`;
  }

  throw new ApiError(502, `AI agent failed to produce valid output: ${lastError}`);
}
