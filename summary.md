# Project Handoff — LearnPath (Adaptive Learning Path Generator)

A handoff document for another agent/developer picking up this project. Read this
top-to-bottom before making changes. See `README.md` for setup and `AGENTS.md`
for the critical Next.js-16 caveat.

---

## 1. What this is

An adaptive learning platform. A learner describes what they want to learn; the
system clarifies the goal, diagnoses their level with an adaptive quiz, generates
a personalized curriculum, teaches it with AI-authored interactive lessons, adapts
the path as the learner progresses, and offers a Socratic tutor — plus a progress
dashboard.

**Six features**, all implemented and verified end-to-end:

1. Knowledge assessment (adaptive)
2. Curriculum generation (prerequisite-ordered)
3. Interactive lessons (text/code/analogy/example + inline practice)
4. Adaptive progress (mastery model reorders/skips/revisits)
5. Socratic tutor chat (guides, never reveals answers)
6. Progress dashboard

Plus an **onboarding clarity loop** (LLM judges if the topic description is clear
enough; asks follow-ups, capped at 4 cycles).

---

## 2. Tech stack & key decisions

| Area       | Choice                                                                                  | Why                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | **Next.js 16.2.7** (App Router) + React 19                                              | Pre-existing scaffold. NOT older Next — see §6.                                                                                               |
| DB         | **MongoDB** via **Mongoose** (ODM)                                                      | Schemas/models in `lib/db/collections.ts`; TS interfaces in `lib/db/models.ts`. Reads use `.lean()` (plain objects, no hydration). See §5/§7. |
| Auth       | **email + password** (bcryptjs) + JWT cookie (`jose`) + revocable `sessions` collection | Sessions are server-side revocable (delete doc = logout); TTL index expires them.                                                             |
| AI         | **`@openai/agents` v0.11** pointed at an OpenAI-compatible endpoint                     | User asked for "Gemini via the OpenAI Agents SDK," base URL + model in env. Code is **provider-agnostic**.                                    |
| Validation | **zod v4**                                                                              | Request bodies AND AI structured outputs.                                                                                                     |
| Frontend   | Minimal client pages                                                                    | just enough UI to exercise the backend.                                                                                                       |

**Build scope was deliberately phased**: backend first (user said "only design the
backend right now"), then a simple frontend ("we'll redesign it later"). The
frontend is intentionally bare.

---

## 3. The end-to-end flow

```
signup/login ─▶ /onboarding ─▶ /assessment ─▶ /curriculum (generate) ─▶ /learn/[id] ─▶ /dashboard
                  clarity loop    adaptive quiz   modules→lessons          lessons+practice   progress
                                                                                  └─▶ /tutor (Socratic)
```

1. **Auth** — `POST /api/auth/signup|login` sets an httpOnly `session` cookie.
2. **Onboarding clarity** — `POST /api/onboarding/clarity {description}` repeatedly.
   `clarityAgent` judges clarity; returns a follow-up question or `done:true` with
   a synthesized `refinedTopic`+`domain`. Loop stops on `clearEnough` OR cycle ≥ 4
   (best-effort proceed). State lives on the `onboarding` doc (authoritative).
3. **Assessment (batch quiz)** — `POST /api/assessment/start` generates a whole
   quiz (8 MCQs across difficulty bands, ONE `quizGenAgent` call) and returns the
   **answer-stripped** questions; it's resumable and reports a completed one
   instead of restarting. `POST /api/assessment/submit {assessmentId, answers[]}`
   grades the whole batch server-side, returns a **score**, `estimatedLevel`, and
   a **review** (with correct answers revealed). A second refinement round is
   appended only when band results are **non-monotonic** (passed harder, failed
   easier → looks like guessing). Logic in `domain/assessment.ts`; round 1 always
   yields a complete result (no half-finished state).
4. **Curriculum** — `POST /api/curriculum/generate` runs `curriculumAgent` from the
   assessment result, then `buildCurriculumDoc` assigns ids/order, maps prereq
   titles→ids, and **seeds lesson mastery** from assessment (topics ≥0.8 →
   pre-`mastered`/skipped). `adaptCurriculum` normalizes statuses/ordering.
   `GET /api/curriculum` returns the current path.
5. **Lessons** — `GET /api/lesson/[id]` lazily runs `lessonAgent`, persists the
   `lessons` doc, and returns **answer-stripped** blocks. `POST .../practice`
   grades an inline question (MCQ by key, short-answer by `answerGradeAgent`),
   updates **EWMA mastery**, reveals the explanation.
6. **Progress/adaptation** — `POST /api/progress/complete {curriculumId, lessonRef,
timeSpentMs}` finalizes the lesson's mastery and runs `adaptCurriculum`
   (deterministic): skip mastered, hoist needs-review, reorder weakest-first
   respecting the prereq DAG, bump `version`. `GET /api/progress` is the dashboard
   aggregate (mastery rollups, time, recommended-next).
7. **Tutor (multi-conversation)** — each topic has MANY threads. `POST /api/tutor
   {message, curriculumId?, conversationId?}` starts a new thread (no id) or
   appends to one; `GET /api/tutor?conversationId=` loads a thread;
   `GET /api/tutor/conversations?curriculumId=` lists them. A conversation's
   identity is its `_id`; `lessonRef` is only a context tag. (The old per-scope
   UNIQUE chats index was replaced — run `scripts/drop-chat-unique.js` on any
   existing DB; Mongoose won't drop it for you.)

---

## 4. Code map

```
proxy.ts                 Cheap auth gate for /api/* (401 if no cookie). NOT the real check.
lib/
  env.ts                 Lazy, validated env getters (throws if missing).
  http.ts                ApiError + handler() wrapper + readJson(zodSchema) + json helpers.
  db/
    client.ts            connectMongoose() — connection cached on globalThis (HMR-safe), dbName pinned.
    collections.ts       ⭐ Mongoose schemas + models + accessors (usersCollection() etc. return the
                            model). Indexes declared in-schema. Collection names pinned (3rd model arg).
    models.ts            ⭐ TS interfaces for document shapes + enums (the .lean() result types).
  auth/
    password.ts          bcrypt hash/verify.
    session.ts           createSession/readSession/destroySession (jose JWT + sessions coll).
    guards.ts            ⭐ requireUser() — the AUTHORITATIVE auth check, called in every protected route.
  ai/
    provider.ts          OpenAIProvider(useResponses:false) + Runner + setTracingDisabled(true).
    runAgent.ts          ⭐ runAgentStructured(agent, input, zodSchema): runs agent, extracts JSON,
                            stripNulls(), zod-parses, retries once with a corrective nudge.
    schemas.ts           All zod schemas for agent outputs (flat/shallow on purpose).
    agents/              clarity, assessment(questionGen), grading, curriculum, lesson, tutor.
  domain/                PURE logic (no I/O), unit-testable:
    assessment.ts        Binary-search step/termination/result computation.
    mastery.ts           EWMA update + lesson/module status transitions + thresholds.
    adapt.ts             orderModules (topo sort) + adaptCurriculum (reorder/status).
  server/                Route helpers bridging AI + domain + DB:
    assessmentFlow.ts    generateNextQuestion + publicQuestion (hides answer).
    curriculumBuild.ts   AI output → CurriculumDoc (ids, prereq mapping, mastery seeding).
    curriculumView.ts    publicCurriculum projection (ObjectId→string).
    curriculumLocate.ts  locateLesson + publicLessonBlock (hides correctKey/rubric/explanation).
    grade.ts             gradeMcq + outcomeFromGrade (shared by assessment & practice).
  client/api.ts          Browser fetch helper (throws ApiClientError with status).
app/api/                 17 route handlers (see README table).
app/                     Client pages: page, login, onboarding, assessment, curriculum,
                         learn/[lessonId], dashboard, tutor.
components/              Nav.tsx + ui.tsx (Button/Card/Badge/Spinner/ProgressBar/ErrorText).
```

⭐ = read these first.

---

## 5. Data model (MongoDB collections)

- **users** — `email`(unique, lowercased), `passwordHash`, timestamps.
- **sessions** — `userId`, `tokenId`(unique, = JWT `sid`), `expiresAt`(TTL index), revocable.
- **onboarding** — clarity loop state: `rawDescription`, `refinedTopic`, `domain`,
  `clarity{clearEnough,cycle,maxCycles,exchanges[]}`, `status`.
- **assessments** — batch quiz: `levels[]`, `rounds`, `questions[]` (each with
  `round`, `levelIdx`, `correctKey`, and the learner's `answer`/`correct`) +
  `result{ estimatedLevel, score, perTopicMastery, strengths, gaps }`.
- **curricula** — `modules[]{prerequisites[], status, lessons[]{status, masteryScore,
contentGenerated, topics[]...}}`, `version`.
- **lessons** — generated content `blocks[]` (flat tagged shape, `kind` selects fields).
- **progressEvents** — append-only log (lesson_started/completed, practice_answered,
  review_triggered, curriculum_reordered). Powers dashboard time + history.
- **chats** — one tutor conversation thread each (`title`, `messages[]`); many
  per topic, keyed by `_id`. `lessonRef` is a context tag, not identity.

Indexes are declared in the Mongoose schemas (`collections.ts`) and built on
connect (`autoIndex` on in dev).

### Multi-topic model (a learner can study several topics at once)
- A **topic = one curriculum** (+ its assessment/onboarding lineage). A user can
  own many; nothing is one-at-a-time.
- `GET /api/topics` lists them (uses `topicListItem` + `summarizeCurriculum` in
  `curriculumView.ts`). The UI hub is `app/topics/page.tsx`.
- Topic-scoped reads (`GET /api/curriculum`, `GET /api/progress`, tutor POST/GET)
  take an optional `curriculumId`; `resolveCurriculum(userId, curriculumId)` in
  `curriculumLocate.ts` selects it (default = most recent). Lessons are already
  global (resolved by unique `lessonRef`), and `progress/complete` already takes
  `curriculumId`.
- **IDOR guard**: every id-scoped query includes `userId` (`{ _id, userId }`) and
  404s on miss — accepting a client-supplied id without the owner filter would let
  any user read another's topic. This is the #1 thing to preserve when adding
  topic-scoped endpoints.
- **Frontend** always passes `?id=` on curriculum/dashboard/tutor views; "New
  topic" links to `/onboarding?new=1`, which sends `restart:true` on the first
  clarity message so it starts fresh instead of resuming an abandoned funnel.
  Curriculum generation happens at the assessment-done step (targets the just-
  finished assessment, not "latest").

### Mongoose conventions (read before touching the data layer)

- Models live in `lib/db/collections.ts`; accessor fns (`usersCollection()` etc.)
  return the **Mongoose model** after ensuring the connection. Same names as before.
- **Reads use `.lean()`** → plain POJOs matching `models.ts` interfaces. This means
  you get connection management, schema-declared indexes, and write-time validation,
  but **NOT** document hydration / instance methods / virtuals on read results.
- **Writes**: new docs via `Model.create(...)`; mutations via `updateOne`/`replaceOne`/
  `findOneAndUpdate` (upsert uses `{ new: true }`). The two **doubly-nested
  `arrayFilters` updates** (`modules.$[].lessons.$[l]...` in lesson GET/practice) run
  on the **native driver** (`Model.collection.updateOne`) to avoid Mongoose's
  positional-path casting quirks — keep that pattern if you add similar updates.
- **Collection names are pinned** via the 3rd `mongoose.model(...)` arg, so they stay
  `onboarding`/`curricula`/`progressEvents` (not Mongoose's auto-pluralized
  `onboardings`/`curriculums`/`progressevents`).
- `dbName` is passed explicitly in `client.ts` (the URI has no db path, or Mongoose
  would default to `test`). Docs carry Mongoose's `__v` version key (harmless; never
  surfaced — API responses use explicit projections).
- `ObjectId` is still imported from `mongodb` (Mongoose bundles the same BSON type);
  the `mongodb` package remains a dependency for that.

---

## 6. Next.js 16 gotchas (this is NOT older Next.js)

- `params`/`searchParams` are **Promises** — `await ctx.params` in route handlers
  and `useParams()` in client pages.
- Middleware is **`proxy.ts`** at root (exports `proxy()` + `config.matcher`).
  Defaults to Node.js runtime — do **not** set a `runtime` config.
- API = `app/.../route.ts` exporting `GET/POST/...` returning `Response`/`NextResponse`.
- React 19 lint rule `react-hooks/set-state-in-effect` flags any effect that calls
  a function containing `setState` — even after `await`. **Fix used**: fetch with a
  `.then()/.catch()/.finally()` promise chain + an `active` cleanup flag (see any
  page's `useEffect`). Do NOT call an async `useCallback` loader directly in an effect.

---

## 7. AI integration gotchas (IMPORTANT)

- **Provider is configured via `GEMINI_*` env vars but is provider-agnostic.** The
  user currently runs **NVIDIA's gateway** (`https://integrate.api.nvidia.com/v1`,
  model `meta/llama-3.3-70b-instruct`), not Google.
- **`GEMINI_BASE_URL` must be the API ROOT** (ends at `/v1`), NOT include
  `/chat/completions` — the OpenAI SDK appends that. A wrong base gives
  `404 page not found` (doubled path).
- Gemini-compatible endpoints speak **Chat Completions only**, so `provider.ts`
  uses `OpenAIProvider({useResponses:false})` and `setTracingDisabled(true)` (the
  default tracing exporter targets OpenAI and hangs on a non-OpenAI key).
- **Structured output is done by parsing, not strict schema.** Agents are plain
  text agents instructed to emit JSON; `runAgentStructured` extracts + zod-parses
  with one corrective retry. Keep schemas flat/shallow.
- Models often emit optional fields as explicit **`null`**; `runAgent.ts` calls
  `stripNulls()` before parsing. When adding agents, ask the model to ALWAYS
  populate best-effort fields so cap-fallbacks aren't empty.
- The current model is small/terse (8B-class). Prompts are tuned for it; a stronger
  model improves content quality with **no code changes** (just change `GEMINI_MODEL`).

---

## 8. Current state

- ✅ All 17 API routes + 7 pages implemented. `tsc`, `eslint`, `next build` all clean.
- ✅ Every feature verified end-to-end against the live model via curl.
- ✅ Dev server runs (`npm run dev`); MongoDB in Docker container `learnpath-mongo`.
- ⚠️ **Not committed to git** yet (branch `master`; PRs usually target `main`).
- ⚠️ `app/api/health` kept as an ops endpoint (public). Temp `ai-smoke` route removed.
- ⚠️ Frontend is intentionally minimal — to be redesigned.

### Known limitations / next steps

1. **Page-level auth**: `proxy.ts` only guards `/api/*`. Pages are public and rely
   on client-side 401→`/login` redirects. Harden when redesigning the frontend
   (extend the matcher or add a server check in a layout).
2. **No automated tests.** `lib/domain/*` is pure and the obvious first target for
   unit tests (assessment search, EWMA, adapt/topo-sort).
3. **Tutor chat** is request/response (no streaming). Consider streaming for UX.
4. **Lesson regeneration**: lessons are generated once and cached; there's no
   "regenerate a simpler version for review" path yet (mentioned in the original
   plan as a future nicety).
5. **Single curriculum per user assumed** in a few GET routes (latest by date).
   Multi-goal support would need UI + scoping.
6. **Model quality**: with the current small model, generated MCQs occasionally
   have weak distractors and the clarity agent can be over-strict. Prompt tuning or
   a bigger model helps.

### How to verify quickly

```bash
# Mongo + dev running, then:
curl -c jar -b jar -X POST localhost:3000/api/auth/signup -H 'content-type: application/json' -d '{"email":"a@b.com","password":"password1"}'
curl -b jar -X POST localhost:3000/api/onboarding/clarity -H 'content-type: application/json' -d '{"description":"beginner Python for pandas CSV analysis"}'
curl -b jar -X POST localhost:3000/api/assessment/start
# ...answer loop, then generate curriculum, open a lesson, etc. (see README API table)
```

### Reference docs

- `README.md` — setup + API table.
- The original plan: `/home/cryo/.claude/plans/students-move-at-sleepy-charm.md`.
- Agent memory: `dev-environment.md`, `ai-provider-wiring.md` in the project's
  `.claude/.../memory/` dir.
