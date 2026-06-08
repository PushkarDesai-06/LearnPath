# LearnPath — Adaptive Learning Path Generator

An adaptive learning platform: intake clarity loop, diagnostic assessment,
AI-generated curriculum, interactive lessons with inline practice, adaptive
progress, a Socratic tutor, and a progress dashboard.

Built on **Next.js 16** (App Router, route handlers, `proxy.ts`) + **React 19**,
**MongoDB**, and the **OpenAI Agents SDK** pointed at any OpenAI-compatible model
endpoint.

## Setup

1. **Dependencies**: `npm install`
2. **MongoDB**: a running instance. For local dev with Docker:
   ```bash
   sudo docker run -d --name learnpath-mongo -p 27017:27017 mongo:7
   ```
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
  ai/                 Agents SDK → provider, runAgent (zod-parse + retry), schemas, agents/
  domain/             pure logic: adaptive assessment search, EWMA mastery, adaptation
  server/             route helpers (assessment flow, curriculum build/view/locate, grading)
  client/             browser fetch helper
app/api/              route handlers (the backend API)
app/                  minimal client UI (to be redesigned)
proxy.ts              cheap auth gate for /api/* (requireUser is the real check)
```

### Data model (MongoDB)
`users`, `sessions` (TTL + revocable), `onboarding` (clarity state), `assessments`
(adaptive search state + result), `curricula` (modules → lessons, mastery, status),
`lessons` (generated content blocks), `progressEvents` (append-only log), `chats`.

### Adaptive logic
- **Assessment**: binary search over 5 difficulty bands; a confirming question
  guards against single-question noise; terminates at the competence boundary or
  a question cap.
- **Mastery**: EWMA per lesson (`0.5·outcome + 0.5·prev`), seeded from assessment.
  `≥0.8` mastered, `<0.4` needs-review.
- **Adaptation**: deterministic — skip mastered, hoist needs-review, reorder
  weakest-first respecting the module prerequisite DAG. The LLM authors content;
  it never decides ordering.

## API

All endpoints return JSON. Auth is a session cookie; protected routes call
`requireUser()`. Test with `curl -c jar -b jar`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` `/login` `/logout` | email + password auth |
| GET | `/api/me` | current user + onboarding status |
| POST | `/api/onboarding/clarity` | clarity loop (repeat until `done`) |
| POST | `/api/assessment/start` | begin/resume adaptive assessment |
| POST | `/api/assessment/answer` | grade + next question or final result |
| POST | `/api/curriculum/generate` · GET `/api/curriculum` | generate / fetch path |
| GET | `/api/lesson/[id]` | lazy-generate + fetch lesson content |
| POST | `/api/lesson/[id]/practice` | grade inline practice → mastery |
| POST | `/api/progress/complete` | finalize lesson + run adaptation |
| GET | `/api/progress` | dashboard aggregate + recommended next |
| POST | `/api/tutor` | Socratic tutor chat |

## Scripts
`npm run dev` · `npm run build` · `npm start` · `npm run lint`
