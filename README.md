# LearnPath

**An adaptive learning platform that builds a curriculum around what you already know — and rebuilds it as you learn.**

A learner describes a goal in plain language. LearnPath clarifies it, diagnoses their
level with a generated diagnostic, authors a prerequisite-ordered curriculum, teaches it
with interactive lessons, and continuously reorders the path from measured mastery — with
a Socratic tutor grounded in the learner's own material alongside it.

<sub>Next.js 16 (App Router, RSC) · React 19 · MongoDB + Mongoose · OpenAI Agents SDK · Zod · Tailwind v4 + shadcn/ui · Vitest</sub>

---

## The core idea: the model writes, the system decides

Most "AI tutor" implementations hand the whole loop to the model — including what to teach
next. LearnPath draws a hard line through the middle:

| Concern | Owner | Where |
| --- | --- | --- |
| Authoring questions, lessons, explanations, tutoring | **LLM** | `lib/ai/agents/*` |
| Judging a free-text answer (verdict + confidence) | **LLM** | `lib/ai/agents/grading.ts` |
| Mastery, ordering, gating, what comes next | **Deterministic code** | `lib/domain/*` |

Everything in `lib/domain/` is pure, synchronous, I/O-free, and unit-tested. A model may
*judge* an answer, but it never computes a mastery score and never decides what comes next:
`runAnswerGradeAgent()` returns only `{ correct, confidence }`, and deterministic code turns
that into a number (`outcomeFromGrade` → `updateMastery`) and then into an ordering. That
boundary is what makes adaptation reproducible — the same events always produce the same
path, and swapping models changes prose quality, not pedagogy.

**Three consequences worth knowing about:**

- **Adaptation is a pure function.** `adaptCurriculum()` takes a curriculum and returns a
  reordered one — skip mastered, hoist needs-review, sort weakest-first, all respecting the
  module prerequisite DAG via topological sort. No I/O, no model call, fully testable.
- **One grader, no drift.** `gradeMcq()` runs on the server (authoritative, moves mastery)
  *and* in the browser (instant feedback, zero round-trip) — the same function, so the two
  verdicts cannot diverge.
- **The model is a replaceable component.** Provider config is a base URL + model name. It
  currently runs on NVIDIA's Llama 3.3 70B gateway; Gemini or any OpenAI-compatible endpoint
  works without a code change.

---

## Architecture

### Request model: server-first, thin mutation surface

Pages are async React Server Components that authenticate and read through a `server-only`
data access layer. They do **not** fetch their own data over HTTP. What remains in
`app/api/` is the mutation surface plus one poller GET — roughly a dozen endpoints instead
of one per view.

```mermaid
flowchart TD
  B["Browser"] --> P["proxy.ts<br/>cheap cookie gate"]
  P --> RSC

  subgraph app["app/ — delivery"]
    direction TB
    RSC["Server Components<br/>requireUserOrRedirect()"]
    ISL["client islands"]
    API["app/api/*<br/>mutations + poller GET"]
    SA["Server Actions"]
  end

  subgraph core["lib/ — application core"]
    direction TB
    DAL["lib/data/*<br/>server-only reads"]
    SRV["lib/server/*<br/>composition"]
    DOM["lib/domain/*<br/>pure logic, no I/O"]
    AI["lib/ai/*<br/>Agents SDK"]
  end

  W["lib/jobs<br/>lesson worker"]
  M[("MongoDB")]

  RSC -->|"JSON-plain DTOs"| ISL
  RSC --> DAL
  ISL -->|"mutations"| API
  ISL -->|"auth, thread load"| SA
  API --> SRV
  SA --> SRV
  SRV --> DOM
  SRV --> AI
  DAL --> M
  SRV --> M
  W --> AI
  W --> M
```

Layers, innermost outward:

```
lib/domain/    Pure logic. No I/O and no model calls — it imports document *types*
                 only, never the database itself. Unit-tested.
                 assessment · mastery (EWMA) · grade · adapt (topo sort)
lib/server/    Composition: AI output → domain rules → DB shape.
                 assessmentFlow · curriculumBuild · curriculumLocate · curriculumView
lib/data/      server-only reads that pages render from. Returns JSON-plain DTOs.
lib/ai/        Agents SDK: provider, runAgent (strict outputType + one corrective retry),
                 zod schemas, eight agents (clarity, quizGen, grading, curriculum, lesson,
                 artifact, variant, tutor)
lib/db/        Mongoose connection (cached on globalThis, HMR-safe), schemas, TS interfaces
lib/auth/      bcrypt + jose JWT + server-revocable sessions; requireUser() is the real check
lib/jobs/      Background lesson worker (atomic claim, concurrency cap, stale reaper)
```

The dependency rule is one-directional: `domain` depends on nothing but types; `server`
composes `domain` + `ai` + `db`; `data` and `app/api` sit on top. `proxy.ts` is only a
cheap cookie-presence gate (it runs on prefetches, so it never touches the DB) —
`requireUser()` / `requireUserOrRedirect()` are the authoritative checks.

### The learner pipeline

```mermaid
flowchart TD
  A["Sign up"] --> B["Onboarding<br/><i>clarity loop, ≤4 cycles</i>"]
  B -->|"refined topic + domain"| C["Diagnostic<br/><i>8 MCQs over 5 bands, one call</i>"]
  C -->|"estimated level + per-topic mastery"| D["Curriculum<br/><i>modules → lessons, prereq DAG</i>"]
  D -->|"seeds mastery ≥0.8 → pre-mastered"| E["Lesson + inline practice"]
  E -->|"EWMA update"| F["adaptCurriculum()<br/><i>reorder · skip · revisit</i>"]
  F --> E
  E --> G["Dashboard<br/><i>rollups, recommended next</i>"]
  E -.-> H["Socratic tutor<br/><i>grounded in this topic</i>"]
```

**Diagnostic.** Eight MCQs spread across five difficulty bands, generated in a single call
and graded as a batch. The level estimate is the highest *contiguously passed* band, which
rejects lucky hits on hard questions. A second round is appended only when results are
non-monotonic (a harder band passed while an easier one failed — the signature of guessing),
so the common case finishes in one round with no half-finished state. Every question carries
an explicit "I don't know" option, which grades as incorrect rather than polluting the
signal with a coin flip.

**Mastery.** Exponentially weighted moving average per lesson, `0.5·outcome + 0.5·prior`,
seeded from the diagnostic rather than from zero. `≥0.8` marks mastered, `<0.4` marks
needs-review.

**Adaptation.** Deterministic, run on every lesson completion: skip mastered, hoist
needs-review, reorder weakest-first within prerequisite constraints, bump the curriculum
version. Module access is a sliding window — the next two incomplete modules plus everything
already completed — applied at both write and read, so existing curricula pick up the rule
without a migration.

Direct lesson URLs render a locked state outside that window. Generation, retries,
practice, and completion enforce the same rule on the server; practice and completion
recheck it when retrying a concurrent progress update.

### Lesson generation is a job, not a request

Authoring a lesson takes tens of seconds. Blocking a request on it would be a bad page and
a worse prefetch story, so generation is queued and the page polls.

```mermaid
sequenceDiagram
  participant U as Learner
  participant Pg as Lesson page — RSC
  participant API as GET /api/lesson/:id
  participant DB as MongoDB
  participant W as lessonWorker

  U->>Pg: open lesson
  Pg->>DB: readLessonView() — pure read
  DB-->>Pg: not written yet
  Pg-->>U: "writing…" + LessonPoller
  Pg->>API: poll (first call enqueues)
  API->>DB: insert a "generating" placeholder<br/>(unique index dedups concurrent opens)
  W->>DB: claim atomically (cap 3 in flight)
  W->>W: lessonAgent → blocks
  W->>DB: write blocks + genStatus "ready"
  API-->>Pg: ready
  Pg->>Pg: router.refresh() → content renders
```

**Rendering must never enqueue.** Link prefetch executes Server Components, so a dashboard
listing twenty lessons would otherwise fire twenty LLM jobs on hover. The page read is
strictly pure; only the poller's explicit GET enqueues. The result is that leaving the page
doesn't cancel generation, reopening doesn't duplicate it, and a server restart re-claims
jobs whose worker died mid-flight (claims older than five minutes are reaped).

A lesson may also carry one optional **interactive block**: the lesson agent writes only a
short spec, and a second worker (`artifactWorker`) builds the HTML demo afterwards. The
lesson is readable immediately; the block shows a placeholder until its demo is ready and
disappears if building it fails. Demos run in a CSP-sandboxed, opaque-origin iframe with no
network or storage access.

**Explain it differently.** Text, analogy, example and code blocks carry an "Explain
differently" menu (simpler, another analogy, worked example; code gets a line-by-line
walkthrough). A rewrite covers one block, so practice ids and mastery credit are never
disturbed, and it runs inside the learner's POST rather than as a job: the reply is one
short markdown block, and only a click can start it. Rewrites live in their own
`blockVariants` collection, where a unique (user, topic, lesson, block, style) index
makes the first insert the only writer, a claim token fences late saves, and a failed or
abandoned record is taken over until three attempts are used. Learners get 30 new
rewrites per rolling 24 hours. A rewrite never moves mastery; it only logs a
`block_variant_requested` event.

**Flashcards.** At the end of a lesson, "Make flashcards" turns its prose and code (never
its practice questions) into 6 to 10 short cards. Generation follows the same pattern
as rewrites: inside the POST, one `flashcardDecks` record per lesson as the dedup point,
a fenced claim, three attempts, and 20 lessons per rolling 24 hours. Each card is its own
`flashcards` document carrying its schedule, so `/flashcards?id=` can pull everything due
across a topic. Reviews are graded Again / Hard / Good / Easy and rescheduled by a
simplified SM-2 in `lib/domain/flashcards.ts` (pure, so the page previews each button's
interval with the same function the route saves with). They are self-graded, so they
never move mastery. A topic exports as a tab-separated file Anki imports directly.

### Practice grading, split by question type

- **Multiple choice** ships its `correctKey` and `explanation` with the lesson, so the
  browser grades locally and reveals the verdict with no round trip. The POST still fires in
  the background, because the *server* re-grade is what moves mastery; only its failure
  surfaces. The trade-off is deliberate: devtools reveals the key early, which lets a learner
  spoil their own mastery signal — but never fake a score, since the server never trusts the
  client's verdict.
- **Short answer** reveals nothing. The rubric and explanation stay server-side and the
  answer is graded by an agent.

`rubric` is never sent to the client for any block kind.

**Retakes don't inflate mastery.** First counted attempts are stored with the
lesson's mastery in one atomic curriculum update. Reloading, concurrent POSTs,
and retrying a failed save cannot count the same question twice. The client can
request practice-only grading with `countsTowardMastery: false`; the server's
persisted receipt decides whether a counted attempt is still available. Progress
events use stable IDs so retrying also repairs interrupted event logging.

### Tutor grounding

Each topic holds many conversation threads, keyed by `_id`. Relevant material — the
curriculum outline plus lesson excerpts found by keyword search, scoped to
`userId + curriculumId` — is injected into the prompt every turn.

The same retrieval also exists as a proper Agents SDK tool, but it is **not** attached to
the live agent: the current model hangs when a tool is present over Chat Completions. Point
`GEMINI_MODEL` at a tool-reliable model and the tool can be re-attached in place of
injection.

### Data model

| Collection | Holds |
| --- | --- |
| `users` | email (unique, lowercased), password hash |
| `sessions` | server-revocable session records; TTL index expires them, deleting the doc is logout |
| `onboarding` | clarity loop state: raw description, refined topic, domain, exchanges |
| `assessments` | bands, rounds, questions (with the learner's answers) + computed result |
| `curricula` | modules → lessons, prerequisites, status, mastery scores, version |
| `lessons` | generated content blocks (flat tagged shape; `kind` selects fields) |
| `progressEvents` | append-only log — powers dashboard time and history |
| `chats` | one tutor thread each; many per topic |
| `blockVariants` | "explain differently" rewrites, one per (lesson block, style) |
| `flashcardDecks` | one generation record per lesson's flashcards (dedup, claim, attempts) |
| `flashcards` | one card each, with its review schedule (`due`, interval, ease, reps, lapses) |

A learner can study **several topics at once** — one topic is one curriculum, and nothing is
one-at-a-time. Topic-scoped reads accept an optional `curriculumId` and default to the most
recent.

**Every id-scoped query is filtered by owner** (`{ _id, userId }`) and 404s on a miss.
Accepting a client-supplied id without that filter would let any user read another's topic;
it is the single most important invariant to preserve when adding topic-scoped endpoints.

---

## Quickstart

**Prerequisites:** Node, Docker (for local MongoDB), and an API key for any
OpenAI-compatible model endpoint.

```bash
npm install                  # npm only — package-lock.json is authoritative
cp .env.example .env.local   # fill SESSION_SECRET + GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

`npm run dev` auto-starts MongoDB for you: a `predev` hook launches the `learnpath-mongo`
container (`mongo:7`, port 27017). The hook skips itself when `MONGODB_URI` points
somewhere non-local, such as Atlas.

<details>
<summary><b>Environment variables</b></summary>

| Variable | Notes |
| --- | --- |
| `MONGODB_URI` | No database path — `MONGODB_DB` is passed separately |
| `MONGODB_DB` | Defaults to `learnpath` |
| `SESSION_SECRET` | Signs the session JWT: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `GEMINI_API_KEY` | Any OpenAI-compatible provider — the `GEMINI_*` names are historical |
| `GEMINI_BASE_URL` | **The API root only** (ends at `/v1`). Do not include `/chat/completions`; the SDK appends it — a wrong base gives a `404` from the doubled path |
| `GEMINI_MODEL` | e.g. `gemini-2.5-flash`, `meta/llama-3.3-70b-instruct` |

</details>

<details>
<summary><b>Troubleshooting</b></summary>

- **Docker needs `sudo`?** You'll be prompted each run. Fix it once with
  `sudo usermod -aG docker $USER`, then re-login. To start Mongo manually instead:
  `docker run -d --name learnpath-mongo -p 27017:27017 mongo:7`.
- **`npm run dev` exits silently after `✓ Ready`**, or `Module not found: Can't resolve
  '@openai/agents-core'` — `node_modules` is partially extracted. Fix:
  `rm -rf node_modules && npm ci`. Use npm only in this repo.

</details>

---

## API

Auth is an httpOnly session cookie; protected routes call `requireUser()`. Test with
`curl -c jar -b jar`.

Pages don't consume these for their data — they're Server Components reading through
`lib/data/*`. What's here is the mutation surface, the lesson poller's GET, and JSON auth
for scripts (the app itself signs in through Server Actions).

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` · `/login` · `/logout` | Email + password (JSON, for scripts; the UI uses Server Actions) |
| `POST` | `/api/onboarding/clarity` | Clarity loop — repeat until `done`; `restart:true` starts a new topic |
| `POST` | `/api/assessment/start` | Generate a fresh diagnostic, or report the resumable/completed one |
| `POST` | `/api/assessment/submit` | Grade the batch → score, level, review, optional refinement round |
| `POST` | `/api/curriculum/generate` | Build the path for the required `assessmentId`; concurrent requests are deduplicated |
| `GET` | `/api/lesson/[id]` | Lesson content or generation/failure status; enqueues only unwritten lessons |
| `POST` | `/api/lesson/[id]` | Explicit retry of a failed lesson, with cooldown and a three-attempt limit |
| `POST` | `/api/lesson/[id]/practice` | Grade inline practice → mastery |
| `GET` | `/api/lesson/[id]/artifact/[blockId]` | An interactive block's demo as a standalone HTML document, served with a `sandbox allow-scripts` CSP for the lesson page's iframe |
| `POST` | `/api/lesson/[id]/blocks/[blockKey]/variants` | Rewrite one block in a `style`; returns the rewrite, or `generating` while another request writes it. 429 past the daily limit |
| `POST` | `/api/lesson/[id]/flashcards` | Make the lesson's flashcards; returns the card count, or `generating` while another request writes them. 429 past the daily limit |
| `POST` | `/api/flashcards/[cardId]/review` | Grade a review (`again`/`hard`/`good`/`easy`) and reschedule the card |
| `DELETE` | `/api/flashcards/[cardId]` | Remove a card |
| `GET` | `/api/flashcards/export?id=` | A topic's cards as an Anki import file |
| `POST` | `/api/progress/complete` | Finalize a lesson and run adaptation |
| `POST` | `/api/tutor` | Socratic tutor — new thread, or continue with `conversationId` |
| `GET` | `/api/health` | Ops check (public) |

Topic-scoped endpoints take an optional `curriculumId` (query or body) and default to the
most recent topic.

---

## Testing

Database regressions run separately from the live-LLM tests. Point
`RELIABILITY_TEST_DB_URI` at a disposable MongoDB server, then run
`npm run test:database`. The suite creates and removes its own randomly named
test database; it never loads `.env.local` or calls an AI provider. It covers
concurrent progress writes, generation claims, retry limits, and module access.

```bash
npm test                   # unit tests, fast and deterministic
npm run test:integration   # live-LLM agent tests (slow; self-skips without GEMINI_API_KEY)
npm run test:all           # both
```

Vitest. The unit suite covers `lib/domain/*`, `lib/server/*`, auth, and the HTTP layer —
everything that decides what a learner sees. Integration tests exercise the agents against a
real endpoint. Route handlers, the DB layer, and session JWT handling are not yet covered;
route-level tests against a seeded Mongo are the next target.

---

## Frontend

Server Components render every page; interactivity lives in small client islands
(`LoginForm`, `PracticeBlock`, `LessonPoller`, `TutorChat`, `OnboardingChat`,
`AssessmentClient`). Anything crossing that boundary must be JSON-plain — the DTOs in
`lib/data/types.ts` exist for exactly that.

UI is shadcn/ui on Tailwind v4. Add components with `npx shadcn@latest add <name>`; never
hand-write into `components/ui/`. Model-authored markdown renders through
`components/Markdown.tsx` with raw HTML escaped.

**Accent color is one knob.** `app/globals.css` defines `--brand` / `--brand-foreground` at
the top of `:root` (and `.dark`), and `--primary` is wired to them — change those two values
to recolor actions, links, and highlights app-wide.

---

## Scripts

`npm run dev` · `build` · `start` · `lint` · `test` · `test:integration` · `test:all` · `test:watch`

---

## Further reading

- **`summary.md`** — architecture deep-dive, per-module code map, AI integration gotchas,
  known limitations.
- **`AGENTS.md`** — required reading before writing code. This is Next.js 16: `params` and
  `searchParams` are Promises, middleware is `proxy.ts`, and several conventions differ from
  older App Router code.
