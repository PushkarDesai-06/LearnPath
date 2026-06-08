/**
 * Wires the OpenAI Agents SDK to Gemini's OpenAI-compatible endpoint.
 *
 * Gemini's endpoint only speaks Chat Completions (not the Responses API the SDK
 * defaults to), so we use an OpenAIProvider configured with `useResponses:
 * false` pointed at the Gemini base URL. Tracing is disabled because the
 * default tracing exporter ships to OpenAI with an OpenAI key, which would hang
 * or error when we only have a Gemini key.
 */
import { OpenAIProvider, Runner, setTracingDisabled } from "@openai/agents";
import { env } from "@/lib/env";

const globalForAi = globalThis as unknown as {
  _learnpathRunner?: Runner;
};

setTracingDisabled(true);

export function getRunner(): Runner {
  if (!globalForAi._learnpathRunner) {
    const provider = new OpenAIProvider({
      apiKey: env.geminiApiKey,
      baseURL: env.geminiBaseUrl,
      useResponses: false,
    });
    globalForAi._learnpathRunner = new Runner({ modelProvider: provider });
  }
  return globalForAi._learnpathRunner;
}

/** The model name every agent uses (resolved by the provider above). */
export function modelName(): string {
  return env.geminiModel;
}
