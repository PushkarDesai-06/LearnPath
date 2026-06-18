<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# If `npm run dev` exits silently after `✓ Ready`

Run `rm -rf node_modules && npm ci`. The `node_modules` tree can end up partially extracted (missing `.mjs` / `.d.ts` files), which surfaces in 16.2.9 as `Module not found: Can't resolve '@openai/agents-core'` from the instrumentation hook, and in 16.2.7 as a silent process exit. Use **npm only** in this repo (`package-lock.json` is authoritative).

# Project orientation

- Setup, API table, and theme notes: `README.md`.
- Architecture deep-dive, data model, AI gotchas, known limitations: `summary.md`.
