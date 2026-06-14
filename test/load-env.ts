/**
 * Side-effecting import that loads `.env.local` into `process.env` with no
 * dependency on dotenv. Imported at the TOP of the agent integration tests so
 * the provider env vars are present before `describe.skipIf(...)` is evaluated
 * at collection time. Existing process.env values win; a missing file is fine
 * (the integration suite then skips via its GEMINI_API_KEY guard).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // No .env.local — integration tests skip themselves.
}
