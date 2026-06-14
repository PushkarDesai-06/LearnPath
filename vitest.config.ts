import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Project root, without a trailing slash, so the `@` alias rewrites
// `@/lib/foo` -> `<root>/lib/foo`. The alias matches only `@` and `@/...`
// (rollup-alias semantics), so scoped deps like `@openai/agents` are untouched.
const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // No generous global timeout: unit tests must fail fast. The slow LLM
    // integration tests set their own per-test timeout (3rd arg to `it`).
  },
});
