/**
 * Runs an Agents-SDK agent and returns its output, validated at runtime against
 * the given zod `schema`. Validation is OWNED here rather than delegated to the
 * SDK.
 *
 * The SDK does validate `result.finalOutput` against the agent's `outputType`
 * today — but only while its internal `isZodObject` guard recognizes our schema.
 * That guard reads zod's private `_zod.def` internals via a compat shim, so a
 * future `@openai/agents` or `zod` bump can break it; when it does,
 * `processFinalOutput` silently falls back to `JSON.parse` and returns
 * UNVALIDATED model JSON with no error (see the SDK's agent `processFinalOutput`).
 * Re-validating here with `safeParse` guarantees malformed AI output can never
 * flow into the routes regardless of SDK internals.
 *
 * On failure (a transient throw, or output that fails the schema — e.g. a lesson
 * block missing its content) we re-run once, appending the specific schema
 * violations so the model gets an actionable correction, before surfacing a 502.
 */
import type { Agent } from "@openai/agents";
import { z } from "zod";
import { getRunner } from "@/lib/ai/provider";
import { ApiError } from "@/lib/http";

export async function runAgent<S extends z.ZodType>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: Agent<any, any>,
  input: string,
  schema: S,
): Promise<z.infer<S>> {
  const runner = getRunner();
  let currentInput = input;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await runner.run(agent, currentInput);
      const parsed = schema.safeParse(result.finalOutput);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    currentInput =
      input +
      `\n\nYour previous reply could not be used (${lastError}). ` +
      `Respond again with output that matches the required schema exactly.`;
  }

  throw new ApiError(
    502,
    `AI agent failed to produce valid output: ${lastError}`,
  );
}
