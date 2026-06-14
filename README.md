# LearnPath — Adaptive Learning Path Generator

An adaptive learning platform: intake clarity loop, diagnostic assessment,
AI-generated curriculum, interactive lessons with inline practice, adaptive
progress, a Socratic tutor, and a progress dashboard.

Built on **Next.js 16** (App Router, route handlers, `proxy.ts`) + **React 19**,
**MongoDB**, and the **OpenAI Agents SDK** pointed at any OpenAI-compatible model
endpoint.

## Setup

1. **Dependencies**: `npm install`
2. **MongoDB**: `npm run dev` **auto-starts a local Docker container** (`learnpath-mongo`,
   `mongo:7`, port 27017) via the `predev` hook (`scripts/start-mongo.sh`). You only
   need Docker installed and its daemon running.
   - If Docker needs `sudo` on your machine you'll be prompted for a password each run;
     avoid that with a one-time `sudo usermod -aG docker $USER` (then re-login).
   - The hook is skipped automatically if `MONGODB_URI` is non-local (e.g. Atlas).
   - To start it manually instead: `docker run -d --name learnpath-mongo -p 27017:27017 mongo:7`.
3. **Environment**: `cp .env.example .env.local`, then fill in `SESSION_SECRET`,
   `GEMINI_API_KEY`, and (if not using Gemini) `GEMINI_BASE_URL` / `GEMINI_MODEL`.
   - The `GEMINI_*` names are historical; **any OpenAI-compatible provider works**
     (Gemini's OpenAI endpoint, NVIDIA, OpenRouter, …).
   - **`GEMINI_BASE_URL` must be the API root** (e.g. `.../v1`) — do NOT include
     `/chat/completions`; the SDK appends it.
4. **Run**: `npm run dev` → http://localhost:3000

> New teammate? `npm install` → start Mongo (step 2) → `cp .env.example .env.local`
> and fill secrets → `npm run dev` → open http://localhost:3000 and sign up.

## Architecture

```
lib/
  env.ts              validated env access
  db/                 Mongoose connection, schemas/models (collections.ts), TS interfaces (models.ts)
  auth/               bcrypt passwords, jose JWT + revocable sessions, requireUser()
  ai/                 Agents SDK → provider, runAgent (SDK outputType + retry), schemas, agents/
  domain/             pure logic: adaptive assessment search, EWMA mastery, adaptation
  server/             route helpers (assessment flow, curriculum build/view/locate, grading)
  client/             browser fetch helper
app/api/              route handlers (the backend API)
app/                  client UI — shadcn/ui (components/ui/*), Tailwind v4
components/ui/        shadcn components (managed via `npx shadcn@latest add`)
proxy.ts              cheap auth gate for /api/* (requireUser is the real check)
```

### Data model (MongoDB)
`users`, `sessions` (TTL + revocable), `onboarding` (clarity state), `assessments`
(adaptive search state + result), `curricula` (modules → lessons, mastery, status),
`lessons` (generated content blocks), `progressEvents` (append-only log), `chats`.

### Adaptive logic
- **Assessment**: a batch quiz of MCQs spread across 5 difficulty bands, generated
  in one call and graded together; the level estimate is the highest *contiguously
  passed* band. A second refinement round is offered only when results look noisy
  (a harder band passed while an easier one failed).
- **Mastery**: EWMA per lesson (`0.5·outcome + 0.5·prev`), seeded from assessment.
  `≥0.8` mastered, `<0.4` needs-review.
- **Adaptation**: deterministic — skip mastered, hoist needs-review, reorder
  weakest-first respecting the module prerequisite DAG. The LLM authors content;
  it never decides ordering.

## API

All endpoints return JSON. Auth is a session cookie; protected routes call
`requireUser()`. Test with `curl -c jar -b jar`.

A learner can have **multiple topics** at once (each topic = one curriculum).
Topic-scoped reads accept an optional `?curriculumId=` (or `curriculumId` in the
body) and default to the most recent topic when omitted. Every such lookup is
scoped to the owner (`{ _id, userId }`) — passing another user's id returns 404.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` `/login` `/logout` | email + password auth |
| GET | `/api/me` | current user + onboarding status |
| GET | `/api/topics` | list topics (curricula) + progress, and in-progress funnels |
| POST | `/api/onboarding/clarity` | clarity loop (repeat until `done`; `restart:true` = new topic) |
| POST | `/api/assessment/start` | begin/resume the quiz, or report a completed one (resumable) |
| POST | `/api/assessment/submit` | grade the whole quiz at once → score + review + optional refinement round |
| POST | `/api/curriculum/generate` · GET `/api/curriculum?curriculumId=` | generate / fetch a topic's path |
| GET | `/api/lesson/[id]` | lazy-generate + fetch lesson content (lesson ids are global) |
| POST | `/api/lesson/[id]/practice` | grade inline practice → mastery |
| POST | `/api/progress/complete` | finalize lesson + run adaptation |
| GET | `/api/progress?curriculumId=` | a topic's dashboard aggregate + recommended next |
| GET | `/api/tutor/conversations?curriculumId=` | list a topic's tutor threads |
| POST · GET | `/api/tutor` | Socratic tutor — POST starts/continues a thread (`conversationId`), GET loads one |

## Theming
UI is **shadcn/ui** (config in `components.json`); add components with
`npx shadcn@latest add <name>`. The theme is CSS-variable driven in
`app/globals.css`. To change the **accent color project-wide**, edit the single
`--brand` / `--brand-foreground` pair at the top of `:root` (and the `.dark`
block) — `--primary` is wired to them. Default is the shadcn neutral theme.

## Scripts
`npm run dev` · `npm run build` · `npm start` · `npm run lint` · `npm test` (unit) ·
`npm run test:integration` (live LLM) · `npm run test:all` · `npm run test:watch`

Tests use **Vitest**. `npm test` runs the fast, deterministic unit suite
(`test/unit/`). `npm run test:integration` (`test/integration/`) hits the live LLM
and is slow — it self-skips without `GEMINI_API_KEY`.
