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

1. **Auth** — the login page submits to Server Actions (`loginAction` /
   `signupAction` in `lib/auth/actions.ts`) that set the httpOnly `session`
   cookie and `redirect()` in one round trip; the cookie write re-renders the
   root layout, so the Nav shows the identity on arrival. `POST
   /api/auth/signup|login|logout` remain as JSON equivalents for scripts/curl.
2. **Onboarding clarity** — `POST /api/onboarding/clarity {description}` repeatedly.
   `clarityAgent` judges clarity; returns a follow-up question or `done:true` with
   a synthesized `refinedTopic`+`domain`. Loop stops on `clearEnough` OR cycle ≥ 4
   (best-effort proceed). State lives on the `onboarding` doc (authoritative).
   **Resumable**: the onboarding page reads the in-progress exchanges on the
   server (`getResumableOnboarding`, unless `?new=1`), so leaving mid-clarify
   resumes the chat instead of restarting.
3. **Assessment (batch quiz)** — the page renders a resumable or completed quiz
   server-side (`readAssessmentState`); only a fresh one needs
   `POST /api/assessment/start`, which generates a whole
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
   The path is read server-side by the dashboard (`getDashboard`).
5. **Lessons (generated in the BACKGROUND)** — the learn page renders a written
   lesson straight from the server (`readLessonView`, a PURE read). An unwritten
   one renders the "writing…" notice plus `LessonPoller`, whose first
   `GET /api/lesson/[id]` enqueues: it inserts a `generating` placeholder
   `lessons` doc (the unique index dedups concurrent opens, `ensureLessonQueued`);
   the **worker** (`lib/jobs/lessonWorker.ts`, started by `instrumentation.ts`)
   claims it atomically, runs `lessonAgent`, and writes the blocks +
   `genStatus:"ready"`. The poller then calls `router.refresh()` and the page
   re-renders with the content. **Rendering must never enqueue**: pages run on
   link prefetch, so the dashboard's lesson links would otherwise start an LLM
   job for every visible lesson. Leaving the
   page doesn't stop generation, reopening doesn't double-generate, a server
   restart re-claims stale jobs, and there's a concurrency cap (3). `POST .../practice`
   grades an inline question (MCQ by key, short-answer by `answerGradeAgent`),
   updates **EWMA mastery**, reveals the explanation.

   **Practice grading is split by question type** (`publicLessonBlock`):
   - **MCQ** — the `correctKey` + `explanation` ship **with the lesson**, so the
     page grades the choice locally (`gradeMcq`, the same pure fn the route uses)
     and reveals the verdict with **no round trip**. The POST still fires, in the
     background, because the server re-grade is what moves mastery; only its
     failure surfaces (inline "Couldn't save" + retry). Trade-off: devtools
     reveals the key early — a learner can spoil their own mastery signal, not
     fake a score, since the server never trusts the client's verdict.
   - **Short answer** — nothing is revealed (`rubric`/`explanation` stay server-
     side); it waits on `answerGradeAgent` behind a bouncing-dots indicator and a
     `animate-sweep` highlight across the card.
   `rubric` is never sent to the client for any block kind.

   **Reset / Try again** — each question can be cleared and retaken. Replays are
   still graded (MCQ locally, short answer by the agent) but must NOT move
   mastery: the answer has been on screen since the first attempt. The client
   tracks a per-question `spent` flag and sends `countsTowardMastery:false`
   afterwards; the route then skips the mastery write AND the `progressEvents`
   log and reports the learner's unchanged standing. An MCQ replay skips the POST
   entirely. **Preserve this flag if you add another practice surface** — without
   it, reset is a one-click mastery inflator.
6. **Progress/adaptation** — `POST /api/progress/complete {curriculumId, lessonRef,
timeSpentMs}` finalizes the lesson's mastery and runs `adaptCurriculum`
   (deterministic): skip mastered, hoist needs-review, reorder weakest-first
   respecting the prereq DAG (for _ordering_), bump `version`. **Module gating** is
   a sliding window (`gateModuleStatuses`, `OPEN_MODULE_WINDOW = 2`): the next 2
   _incomplete_ modules are accessible plus all completed ones — NOT one-at-a-time.
   Applied at write AND at read (`getDashboard`) so existing curricula get the
   rule without a migration. `getDashboard` (`lib/data/progress.ts`) is the
   dashboard aggregate (mastery rollups, time, recommended-next).
7. **Tutor (multi-conversation)** — each topic has MANY threads. `POST /api/tutor
{message, curriculumId?, conversationId?}` starts a new thread (no id) or
   appends to one. The page server-renders the thread list and the newest
   transcript (`lib/data/tutor.ts`); switching threads calls
   `loadConversationAction` (a Server Action in `app/(app)/tutor/actions.ts`),
   and the rail re-sorts locally after a send. A conversation's
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
proxy.ts                 Cheap cookie-presence gate: 401 for /api/*, /login redirect for signed-in
                            pages. NOT the real check (it also runs on prefetches — no DB).
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
    current.ts           ⭐ getCurrentUser() (React cache(): one session+user lookup per request, shared by
                            Nav + page) and requireUserOrRedirect() for pages.
    credentials.ts       authenticate()/register(), shared by the auth actions and /api/auth/* routes.
    actions.ts           loginAction / signupAction / logoutAction (Server Actions; set cookie + redirect).
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
    grade.ts             gradeMcq + outcomeFromGrade. Shared by the assessment/practice routes
                            AND by the lesson page (client-side MCQ grading) — one grader, no drift.
    adapt.ts             orderModules (topo sort) + adaptCurriculum (reorder/status).
  server/                Route helpers bridging AI + domain + DB:
    assessmentFlow.ts    generateQuizRound + publicQuestion (hides answer) + reviewItem.
    curriculumBuild.ts   AI output → CurriculumDoc (ids, prereq mapping, mastery seeding).
    curriculumView.ts    publicCurriculum projection (ObjectId→string).
    curriculumLocate.ts  locateLesson + publicLessonBlock (ships the MCQ key+explanation for
                            instant client grading; hides everything for short answers).
  data/                  ⭐ Server-only data access layer (`import "server-only"`). What pages render from:
    topics.ts, progress.ts (getDashboard), lesson.ts (readLessonView / ensureLessonQueued),
    tutor.ts, onboarding.ts, assessment.ts. userId args are HEX STRINGS (see §6).
    types.ts             JSON-plain DTOs (ids as strings, dates as ISO) — safe to pass to client islands.
  jobs/lessonWorker.ts   ⭐ Background lesson-gen worker (atomic claim, concurrency cap, reaper).
  client/api.ts          Browser fetch helper for the remaining POSTs + the lesson poller.
instrumentation.ts       Next boot hook → starts the lesson worker (nodejs runtime only).
app/api/                 Route handlers: mutations + the lesson poller GET (see README table).
app/(app)/               Signed-in pages: login, onboarding, assessment, curriculum,
                         learn/[lessonId], dashboard, topics, tutor, account. Each page.tsx is a
                         Server Component (auth + lib/data reads); interactivity lives in
                         sibling client islands (LoginForm, PracticeBlock, LessonPoller,
                         TutorChat, OnboardingChat, AssessmentClient…). Its layout holds the
                         max-w-4xl reading container.
app/(marketing)/         The landing page (URL stays `/` — route groups aren't in the path).
                         Its layout imposes no width, so the page runs full-bleed.
  _components/           Landing-only UI; `_` keeps the folder non-routable.
    Reveal.tsx           Scroll reveal — flips `data-shown` via IntersectionObserver
                            (no setState, so no re-render and no React 19 effect-rule fight).
    AdaptivePathDemo.tsx The animated path: rows are absolutely positioned and moved by
                            translateY, so a reorder animates. Stages mirror real
                            adapt.ts/mastery.ts transitions — keep them honest.
components/              Nav.tsx (server: reads session + topics) → NavBar.tsx (markup) with the
                         TopicSwitcher / AccountMenu client islands; Markdown.tsx (no directive —
                         renders on server or client); shadcn ui/*.
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
- `listTopics` (`lib/data/topics.ts`) lists them (uses `topicListItem` +
  `summarizeCurriculum` in `curriculumView.ts`). The UI hub is `app/(app)/topics/page.tsx`.
- Topic-scoped reads (`getDashboard`, `listConversations`, tutor POST) take an
  optional `curriculumId`; `resolveCurriculum(userId, curriculumId)` in
  `curriculumLocate.ts` selects it (default = most recent). Lessons are already
  global (resolved by unique `lessonRef`), and `progress/complete` already takes
  `curriculumId`.
- **IDOR guard**: every id-scoped query includes `userId` (`{ _id, userId }`) and
  404s on miss — accepting a client-supplied id without the owner filter would let
  any user read another's topic. This is the #1 thing to preserve when adding
  topic-scoped endpoints.
- **Frontend** always passes `?id=` on dashboard/tutor views (the server page
  reads it from `searchParams`; the topic switcher changes it with
  `router.push`, and the page's `<Suspense key={id}>` shows the skeleton); "New topic" links
  to `/onboarding?new=1`, which sends `restart:true` on the first clarity message
  so it starts fresh instead of resuming an abandoned funnel. Curriculum
  generation happens at the assessment-done step (targets the just-finished
  assessment, not "latest").
- **Dashboard = the topic hub** (`app/(app)/dashboard/`): stats + recommended-
  next + the navigable learning path (clickable lessons, gating respected). The
  old separate "Path" page (`curriculum/page.tsx`) is a server `redirect()` to
  `/dashboard?id=`. `getDashboard` returns per-module lessons for this.

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
- **Rendering model (server-first).** Pages are async Server Components: they
  `await searchParams/params`, call `requireUserOrRedirect()` BEFORE any
  `<Suspense>` (so it's a real 307), then read via `lib/data/*`. Rules that bit
  or would bite:
  - Anything crossing to a `"use client"` component must be JSON-plain — use the
    `lib/data/types.ts` DTOs, never a `.lean()` doc (ObjectId/Date) or `UserDoc`
    (has `passwordHash`). Functions can't cross either: client islands import
    Server Actions directly (e.g. `AccountMenu` → `logoutAction`).
  - `redirect()`/`notFound()` throw — never inside try/catch. On routes with a
    `loading.tsx` the page is already inside a Suspense boundary, so a
    page-level redirect/notFound streams (HTTP 200 + client redirect / not-found
    UI) instead of a 307/404. The proxy gives the real 307 when there's no
    cookie at all.
  - Render must be side-effect free (link prefetch runs it). See §3.5.
  - `cache()` keys on argument identity: two `ObjectId`s for the same user are
    different keys, so cached DAL fns take the hex string.
  - `import "server-only"` is compiled by Next but the npm package isn't
    installed, so Vitest can't resolve it. Keep it to `lib/data/*`,
    `lib/auth/current.ts`, `lib/auth/actions.ts` and tutor `actions.ts` — never in
    a module `test/unit` imports (or add a Vitest alias stub first).
  - The root-layout Nav does NOT re-render on client navigation. After a
    mutation that changes what it shows (topics, mastery), call
    `router.refresh()` (lesson complete, curriculum generate do). Auth actions
    get this for free — a cookie write re-renders the tree.
  - Switching `?id=` must be a router navigation (`router.push`), not
    `window.history.pushState`: a Server Component doesn't re-render on a
    shallow URL change.
  - No `cacheComponents` / `"use cache"` yet (every route reads the session
    cookie, so there's no static shell to win; caching would also need
    `updateTag` wiring on every mutation). `mongoose`/`mongodb` are already in
    Next's default `serverExternalPackages`.
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

1. **Auth redirect status on streamed routes**: pages check auth server-side
   (`requireUserOrRedirect`) and the proxy redirects cookie-less page requests,
   but a STALE cookie on a route with `loading.tsx` gets a streamed client-side
   redirect (HTTP 200) rather than a 307 (see §6). Harmless for users; matters
   only for tooling that checks status codes.
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
