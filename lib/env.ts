/**
 * Centralised, validated access to environment variables.
 *
 * Importing this module reads `process.env` lazily — the first time a getter is
 * called it validates that the variable is present and throws a clear error if
 * not. Nothing here is `NEXT_PUBLIC_`, so none of these values reach the client.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to .env.local (see the plan / README for the full list).`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  get mongodbUri() {
    return required("MONGODB_URI");
  },
  get mongodbDb() {
    return optional("MONGODB_DB", "learnpath");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  get geminiBaseUrl() {
    return optional(
      "GEMINI_BASE_URL",
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
  },
  get geminiModel() {
    return optional("GEMINI_MODEL", "gemini-2.5-flash");
  },
};
