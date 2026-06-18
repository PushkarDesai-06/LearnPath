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
| Framework  | **Next.js 16.2.9** (App Router) + React 19                                              | Pre-existing scaffold. NOT older Next — see §6.                                                                                               |
| DB         | **MongoDB** via **Mongoose** (ODM)                                                      | Schemas/models in `lib/db/collections.ts`; TS interfaces in `lib/db/models.ts`. Reads use `.lean()` (plain objects, no hydration). See §5/§7. |
| Auth       | **email + password** (bcryptjs) + JWT cookie (`jose`) + revocable `sessions` collection | Sessions are server-side revocable (delete doc = logout); TTL index expires them.                                                             |
| AI         | **`@openai/agents` v0.11** pointed at an OpenAI-compatible endpoint                     | User asked for "Gemini via the OpenAI Agents SDK," base URL + model in env. Code is **provider-agnostic**.                                    |
| Validation | **zod v4**                                                                              | Request bodies AND AI structured outputs.                                                                                                     |
| Frontend   | **shadcn/ui** (radix-nova, neutral base) + Tailwind v4                                  | Components in `components/ui/*` (shadcn CLI-managed); `cn()` in `lib/utils.ts`. Theme is CSS-variable driven — see Accent below.              |

**Markdown:** LLM markdown (lesson text/analogy/example blocks, tutor replies,
practice explanations) renders via `components/Markdown.tsx` (`react-markdown` +
`remark-gfm` + the Tailwind typography `prose` plugin). Raw HTML is escaped (safe
for model output). The structured `code` lesson block stays a `<pre>` (not markdown).

**Accent color (one knob):** `app/globals.css` defines `--brand` /
`--brand-foreground` at the top of `:root` (and `.dark`); `--primary` is wired to
them, so changing those two values recolors actions/links/highlights app-wide.
Default = the shadcn neutral theme. shadcn config is in `components.json`.

**Build scope was phased**: backend first → functional frontend → shadcn redesign.
Add components with `npx shadcn@latest add <name>` (never hand-write into
`components/ui/`).

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
   **Resumable**: `GET /api/onboarding` returns the in-progress exchanges; the
   onboarding page reloads them on mount (unless `?new=1`), so leaving mid-clarify
   resumes the chat instead of restarting.
3. **Assessment (batch quiz)** — `POST /api/assessment/start` generates a whole
   quiz (8 MCQs across difficulty bands, ONE `quizGenAgent` call) and returns the
   **answer-stripped** questions; it's resumable and reports a completed one
   instead of restarting. `POST /api/assessment/submit {assessmentId, answers[]}`
   grades the whole batch server-side, returns a **score**, `estimatedLevel`, and
   a **review** (with correct answers revealed). A second refinement round is
   appended only when band results are **non-monotonic** (passed harder, failed
   easier → looks like guessing). Logic in `domain/assessment.ts`; round 1 always
   yields a complete result (no half-finished state). Each question also has an
   **"I don't know"** option (sentinel `"__idk__"` in the UI) that grades as
   incorrect — no special backend handling, it just never matches a choice.
4. **Curriculum** — `POST /api/curriculum/generate` runs `curriculumAgent` from the
   assessment result, then `buildCurriculumDoc` assigns ids/order, maps prereq
   titles→ids, and **seeds lesson mastery** from assessment (topics ≥0.8 →
   pre-`mastered`/skipped). `adaptCurriculum` normalizes statuses/ordering.
   `GET /api/curriculum` returns the current path.
5. **Lessons (generated in the BACKGROUND)** — `GET /api/lesson/[id]` is
   non-blocking: on first open it inserts a `generating` placeholder `lessons`
   doc (the unique index dedups concurrent opens) and returns `{status:"generating"}`;
   the **worker** (`lib/jobs/lessonWorker.ts`, started by `instrumentation.ts`)
   claims it atomically, runs `lessonAgent`, and writes the **answer-stripped**
   blocks + `genStatus:"ready"`. The lesson page **polls** until ready. Leaving the
   page doesn't stop generation, reopening doesn't double-generate, a server
   restart re-claims stale jobs, and there's a concurrency cap (3). `POST .../practice`
   grades an inline question (MCQ by key, short-answer by `answerGradeAgent`),
   updates **EWMA mastery**, reveals the explanation.
6. **Progress/adaptation** — `POST /api/progress/complete {curriculumId, lessonRef,
timeSpentMs}` finalizes the lesson's mastery and runs `adaptCurriculum`
   (deterministic): skip mastered, hoist needs-review, reorder weakest-first
   respecting the prereq DAG (for _ordering_), bump `version`. **Module gating** is
   a sliding window (`gateModuleStatuses`, `OPEN_MODULE_WINDOW = 2`): the next 2
   _incomplete_ modules are accessible plus all completed ones — NOT one-at-a-time.
   Applied at write AND at read (`GET /api/curriculum`, `GET /api/progress`) so
   existing curricula get the rule without a migration. `GET /api/progress` is the
   dashboard aggregate (mastery rollups, time, recommended-next).
7. **Tutor (multi-conversation)** — each topic has MANY threads. `POST /api/tutor
{message, curriculumId?, conversationId?}` starts a new thread (no id) or
   appends to one; `GET /api/tutor?conversationId=` loads a thread;
   `GET /api/tutor/conversations?curriculumId=` lists them. A conversation's
   identity is its `_id`; `lessonRef` is only a context tag. (The old per-scope
   UNIQUE chats index was replaced; if upgrading an existing DB, drop that index
   manually — Mongoose won't.) **Grounding**: relevant topic
   material (curriculum outline + lesson excerpts via keyword search,
   `lib/ai/tools/topicLookup.ts`, scoped to userId+curriculumId) is INJECTED into
   the prompt each turn. The same retrieval is also a defined Agents-SDK tool
   (`makeTopicLookupTool`) but NOT attached to the live agent — the current model
   (NVIDIA llama over Chat Completions) HANGS when a tool is present, so grounding
   uses injection, not model-driven function calls. Re-attach the tool with a
   tool-reliable model.

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
    runAgent.ts          ⭐ runAgent(agent, input): runs the agent — its zod outputType makes the SDK
                            return a parsed, schema-valid object — and retries once with a corrective nudge.
    schemas.ts           All zod schemas for agent outputs (used as outputType; flat/shallow on purpose).
    agents/              clarity, assessment(quizGen), grading, curriculum, lesson, tutor.
  domain/                PURE logic (no I/O), unit-testable:
    assessment.ts        Batch-quiz scoring: band accuracy, contiguous-pass level estimate,
                            non-monotonic "needs another round" check, result computation.
    mastery.ts           EWMA update + lesson/module status transitions + thresholds.
    adapt.ts             orderModules (topo sort) + adaptCurriculum (reorder/status).
  server/                Route helpers bridging AI + domain + DB:
    assessmentFlow.ts    generateQuizRound + publicQuestion (hides answer) + reviewItem.
    curriculumBuild.ts   AI output → CurriculumDoc (ids, prereq mapping, mastery seeding).
    curriculumView.ts    publicCurriculum projection (ObjectId→string).
    curriculumLocate.ts  locateLesson + publicLessonBlock (hides correctKey/rubric/explanation).
    grade.ts             gradeMcq + outcomeFromGrade (shared by assessment & practice).
  jobs/lessonWorker.ts   ⭐ Background lesson-gen worker (atomic claim, concurrency cap, reaper).
  client/api.ts          Browser fetch helper (throws ApiClientError with status).
instrumentation.ts       Next boot hook → starts the lesson worker (nodejs runtime only).
app/api/                 18 route handlers (see README table).
app/                     Client pages: page, login, onboarding, assessment, curriculum,
                         learn/[lessonId], dashboard, tutor.
components/              Nav.tsx + ui.tsx (Button/Card/Badge/Spinner/ProgressBar/ErrorText).
test/                    Vitest: unit/ (pure domain/server/auth/http logic) + integration/
                         (live-LLM agent tests, self-skip without GEMINI_API_KEY).
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
- **Frontend** always passes `?id=` on dashboard/tutor views; "New topic" links
  to `/onboarding?new=1`, which sends `restart:true` on the first clarity message
  so it starts fresh instead of resuming an abandoned funnel. Curriculum
  generation happens at the assessment-done step (targets the just-finished
  assessment, not "latest").
- **Dashboard = the topic hub** (`app/dashboard/page.tsx`): stats + recommended-
  next + the navigable learning path (clickable lessons, gating respected). The
  old separate "Path" page (`app/curriculum/page.tsx`) now just redirects to
  `/dashboard?id=`. `GET /api/progress` returns per-module lessons for this.

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
- **If `npm run dev` prints `✓ Ready` then exits silently** (or with a
  `Module not found: Can't resolve '@openai/agents-core'` from inside instrumentation):
  the installed `node_modules` is partially corrupted. **Fix:** `rm -rf node_modules
  && npm ci`. Root cause was a stray `bun.lock` from an earlier `bun install` that
  produced incomplete extracts (missing `.mjs` and `.d.ts` files in several
  packages). `bun.lock` has been removed; **stick to one package manager** (npm
  here — `package-lock.json` is authoritative). On Next 16.2.7 this failure was
  silent; 16.2.9 surfaces the underlying Turbopack resolve error first, which is
  why the package was bumped.

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
- **Structured output uses the SDK's strict `outputType`.** Each agent passes its
  zod schema as `outputType`, so the SDK sends it as a strict `json_schema`
  `response_format` and returns a parsed, schema-valid object (`result.finalOutput`);
  `runAgent` only adds one corrective retry. Keep schemas flat/shallow — deep shapes
  drift more. (Verified live on NVIDIA/Llama-3.3-70b, incl. nested curriculum and the
  lesson `.refine()`.)
- Strict mode makes every schema field required, and models fill inapplicable ones
  with explicit **`null`**; the SDK parses with no null-stripping, so optional fields
  use **`.nullish()`** (not `.optional()`) or parsing throws — affects `claritySchema`
  and `lessonBlockBase` (`lessonWorker` drops those nulls before storing a `LessonBlock`).
  When adding agents, ask the model to ALWAYS populate best-effort fields so
  cap-fallbacks aren't empty.
- **Constrained-decoding latency is prompt-sensitive.** With strict `outputType` on
  this provider, a system prompt that elicits prose reasoning can make the same
  tiny-output agent 10-25× slower (one clarity rewrite went 166s → ~20s with no
  schema/logic change). Keep agent prompts field-oriented, and measure per-agent
  latency — correctness ("schema-valid") and speed are independent.
- **All-optional schemas hide empty output.** zod strips unknown keys, so a block
  like `{kind:"text"}` (content under a wrong/absent field) passed as an EMPTY
  block. The lesson schema (`lessonBlockSchema`) now `.refine`s content per `kind`
  so empty/misnamed blocks FAIL → trigger the corrective retry. The lesson GET also
  re-enqueues a stored-but-content-less lesson, so old empty lessons self-heal on
  reopen. Apply the same "require the content field" rule to any new content schema.
- The current model is `meta/llama-3.3-70b-instruct`. Prompts are tuned for it; a
  stronger model improves content quality with **no code changes** (just change
  `GEMINI_MODEL`).

---

## 8. Current state

- ✅ All 18 API routes + 7 pages implemented. `tsc`, `eslint`, `next build` all clean.
- ✅ Automated tests (Vitest): 59 unit tests over `lib/domain/*`, `server/*`, `auth`,
  and `http`; 5 live-LLM integration tests over the agents. `npm test` (unit, fast) /
  `npm run test:integration` (live, slow).
- ✅ Every feature verified end-to-end against the live model via curl.
- ✅ Dev server runs (`npm run dev`); MongoDB in Docker container `learnpath-mongo`.
- ⚠️ `app/api/health` kept as an ops endpoint (public). Temp `ai-smoke` route removed.
- ⚠️ `npm audit` reports 2 moderate vulns — both are postcss-inside-Next
  (XSS via unescaped `</style>` in stringified CSS output). `npm audit fix` only
  resolves them by downgrading Next to 9.x, which we won't do. Acceptable: this is
  build-time CSS stringification, not a runtime risk in our app.

### Known limitations / next steps

1. **Page-level auth**: `proxy.ts` only guards `/api/*`. Pages are public and rely
   on client-side 401→`/login` redirects. Harden when redesigning the frontend
   (extend the matcher or add a server check in a layout).
2. **Test coverage gaps.** Unit tests cover `lib/domain/*`, `server/*`, `auth`, and
   `http`; live-LLM integration tests cover the agents. NOT yet covered: the
   `app/api/**` route handlers (e2e), the DB layer, `auth/session` (JWT), and the
   tutor agent (needs a DB-seeded topic). Route/e2e tests against a seeded Mongo are
   the next target.
3. **Tutor chat** is request/response (no streaming). Consider streaming for UX.
4. **Lesson regeneration**: lessons are generated once and cached; there's no
   "regenerate a simpler version for review" path yet (mentioned in the original
   plan as a future nicety).
5. **Clarity-prompt latency under strict `outputType`** (see §7): a prompt that
   elicits prose reasoning can make constrained decoding very slow on this provider.
   Keep agent prompts field-oriented and watch per-agent latency when editing prompts.
   (Multi-topic support, once listed here as a gap, is now implemented — see §5.)
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
