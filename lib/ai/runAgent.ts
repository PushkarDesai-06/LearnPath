/**
 * Runs an Agents-SDK agent whose `outputType` is a zod schema and returns the
 * SDK-parsed, schema-validated result.
 *
 * Because each agent declares its shape via `outputType`, the SDK sends that
 * schema as the model's structured `response_format` and parses + validates the
 * reply against it — so `result.finalOutput` is already the typed object, not a
 * string we have to extract JSON from. We add only a single corrective retry: if
 * a run throws (a transient error, or the reply failing schema validation — e.g.
 * a lesson block missing its content), we re-run once with a nudge appended
 * before surfacing a 502.
 */
import type { Agent } from "@openai/agents";
import { getRunner } from "@/lib/ai/provider";
import { ApiError } from "@/lib/http";

export async function runAgent<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: Agent<any, any>,
  input: string,
): Promise<T> {
  const runner = getRunner();
  let currentInput = input;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await runner.run(agent, currentInput);
      const output = result.finalOutput as T | undefined;
      if (output !== undefined && output !== null) return output;
      lastError = "Agent returned no output";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    currentInput =
      input +
      `\n\nYour previous reply could not be used (${lastError}). ` +
      `Respond again with output that matches the required schema exactly.`;
  }

  throw new ApiError(502, `AI agent failed to produce valid output: ${lastError}`);
}
