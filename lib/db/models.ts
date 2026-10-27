/**
 * Shared TypeScript shapes for every MongoDB collection.
 *
 * These mirror the documents we store; `_id` is always an ObjectId. We use the
 * raw driver (not an ODM), so these interfaces are the single source of truth
 * for document structure across the codebase.
 */
import type { ObjectId } from "mongodb";

export type DifficultyLevel =
  | "novice"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  "novice",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

// ---------------------------------------------------------------------------
// users / sessions
// ---------------------------------------------------------------------------

export interface UserDoc {
  _id: ObjectId;
  email: string; // lowercased, unique
  passwordHash: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDoc {
  _id: ObjectId;
  userId: ObjectId;
  tokenId: string; // random uuid, matches the `sid` claim in the JWT; unique
  createdAt: Date;
  expiresAt: Date; // TTL index auto-expires the doc
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// onboarding (clarity loop)
// ---------------------------------------------------------------------------

export type OnboardingStatus =
  | "clarifying"
  | "ready"
  | "assessing"
  | "curriculum_ready"
  | "learning";

export interface ClarityExchange {
  role: "user" | "assistant";
  text: string;
  at: Date;
}

export interface OnboardingDoc {
  _id: ObjectId;
  userId: ObjectId;
  rawDescription: string;
  refinedTopic?: string;
  domain?: string;
  clarity: {
    clearEnough: boolean;
    cycle: number;
    maxCycles: number;
    exchanges: ClarityExchange[];
  };
  status: OnboardingStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// assessments (adaptive intake)
// ---------------------------------------------------------------------------

export type QuestionType = "mcq" | "short";

export interface AssessmentQuestion {
  id: string;
  round: number; // which quiz round this question belongs to (1, 2, ...)
  levelIdx: number;
  topic: string;
  prompt: string;
  type: QuestionType; // always "mcq" in the batch quiz
  choices?: string[];
  correctKey?: string; // for mcq (index as string, e.g. "0")
  rubric?: string; // reserved (short-answer grading)
  answer?: string; // the learner's submitted choice
  correct?: boolean;
  confidence?: number; // reserved
  askedAt: Date;
}

export interface TopicMastery {
  topic: string;
  score: number; // 0..1
}

export interface AssessmentResult {
  estimatedLevel: DifficultyLevel;
  score: number; // 0..1 overall fraction correct
  perTopicMastery: TopicMastery[];
  strengths: string[];
  gaps: string[];
}

/**
 * The assessment is now a BATCH quiz: a set of MCQs generated up front and
 * graded all at once on submit (no per-question checking). A second round is
 * offered only when round 1 looks noisy (see domain/assessment.ts).
 */
export interface AssessmentDoc {
  _id: ObjectId;
  userId: ObjectId;
  onboardingId: ObjectId;
  domain: string;
  refinedTopic: string;
  state: "in_progress" | "complete";
  levels: DifficultyLevel[];
  rounds: number; // how many quiz rounds generated so far (1 or 2)
  questions: AssessmentQuestion[];
  result?: AssessmentResult;
  createdAt: Date;
  updatedAt: Date;
  curriculumClaimToken?: string | null;
  curriculumClaimedAt?: Date | null;
}

// ---------------------------------------------------------------------------
// curricula
// ---------------------------------------------------------------------------

export type LessonStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "mastered"
  | "needs_review";

export type ModuleStatus = "locked" | "available" | "in_progress" | "completed";

export interface CurriculumLesson {
  id: string;
  title: string;
  objectives: string[];
  order: number;
  estMinutes: number;
  difficultyLevel: DifficultyLevel;
  topics: string[];
  contentGenerated: boolean;
  status: LessonStatus;
  masteryScore: number; // 0..1 EWMA
  /** First counted attempts, stored atomically with the mastery they produced. */
  practiceAttempts?: PracticeAttempt[];
  completion?: { at: Date; timeSpentMs?: number };
}

export interface PracticeAttempt {
  questionId: string;
  correct: boolean;
  score: number;
  at: Date;
}

export interface CurriculumModule {
  id: string;
  title: string;
  summary: string;
  order: number;
  prerequisites: string[]; // module ids
  status: ModuleStatus;
  lessons: CurriculumLesson[];
}

export interface CurriculumDoc {
  _id: ObjectId;
  userId: ObjectId;
  assessmentId: ObjectId;
  domain: string;
  title: string;
  modules: CurriculumModule[];
  version: number;
  /** Write revision, separate from the user-visible adaptation version. */
  revision?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// lessons (generated content, split out to keep curricula small)
// ---------------------------------------------------------------------------

export type LessonBlockKind =
  | "text"
  | "code"
  | "analogy"
  | "example"
  | "practice"
  | "interactive";

/** Second-pass generation state of an `interactive` block's artifact. */
export type ArtifactStatus = "pending" | "ready" | "failed";

/**
 * A flat block shape (rather than a discriminated union) so the AI structured
 * output stays simple and Gemini-friendly. `kind` selects which fields apply.
 */
export interface LessonBlock {
  kind: LessonBlockKind;
  markdown?: string; // text | analogy | example
  language?: string; // code
  code?: string; // code
  caption?: string; // code
  // practice fields:
  questionId?: string;
  prompt?: string;
  type?: QuestionType;
  choices?: string[];
  correctKey?: string;
  rubric?: string;
  explanation?: string;
  // Stable address for every non-practice block written since block variants
  // shipped (older lessons are addressed by position, see lib/domain/variants).
  blockId?: string;
  // interactive fields (artifact HTML is written later by the artifact worker):
  spec?: string; // the lesson agent's brief for the artifact
  artifactStatus?: ArtifactStatus;
  artifactHtml?: string; // body fragment; wrapped by buildArtifactDocument
  artifactError?: string;
}

export type LessonGenStatus = "generating" | "ready" | "failed";

export interface LessonDoc {
  _id: ObjectId;
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonRef: string; // matches CurriculumLesson.id
  title: string;
  blocks: LessonBlock[]; // empty until generated
  generatedAt: Date;
  model: string;
  // Background generation state. A doc is created as `generating` (empty blocks)
  // the moment a lesson is first opened; the worker fills it in. The unique
  // (userId, curriculumId, lessonRef) index makes that placeholder insert the
  // dedup point — only one generation runs per lesson.
  genStatus: LessonGenStatus;
  genError?: string;
  claimedAt?: Date | null; // worker claim timestamp (for the stale-claim reaper)
  claimToken?: string | null;
  generationAttempts?: number;
  failedAt?: Date | null;
  // Artifact job (lib/jobs/artifactWorker.ts): set to "pending" when the lesson
  // is saved with interactive blocks, "done" once each has been attempted.
  artifactsStatus?: "pending" | "done";
  artifactClaimedAt?: Date | null;
  artifactClaimToken?: string | null;
  artifactAttempts?: number;
}

// ---------------------------------------------------------------------------
// progressEvents (append-only activity log)
// ---------------------------------------------------------------------------

export type ProgressEventType =
  | "lesson_started"
  | "lesson_completed"
  | "practice_answered"
  | "quiz_answered"
  | "review_triggered"
  | "curriculum_reordered"
  | "block_variant_requested";

export interface ProgressEventDoc {
  _id: ObjectId;
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonRef?: string;
  type: ProgressEventType;
  topics?: string[];
  correct?: boolean;
  score?: number;
  timeSpentMs?: number;
  at: Date;
}

// ---------------------------------------------------------------------------
// chats (Socratic tutor history)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: Date;
}

/**
 * One tutor conversation thread. Identity is `_id` (the conversationId) — a
 * topic can have MANY conversations. `lessonRef` is just a context tag for where
 * the thread was started, NOT part of the conversation's identity.
 */
export interface ChatDoc {
  _id: ObjectId;
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonRef?: string | null; // context tag: lesson the thread was started from
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// blockVariants ("explain it differently" rewrites of one lesson block)
// ---------------------------------------------------------------------------

export type VariantStyle = "simpler" | "analogy" | "example" | "walkthrough";
export type VariantGenStatus = "generating" | "ready" | "failed";

/**
 * One rewrite of one block in one style. Identity is (userId, curriculumId,
 * lessonRef, blockKey, style), enforced by a unique index, which is also the
 * dedup point for concurrent requests. Kept out of the lesson doc because that
 * doc is re-read by every lesson and demo poll.
 */
export interface BlockVariantDoc {
  _id: ObjectId;
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonRef: string;
  blockKey: string;
  style: VariantStyle;
  status: VariantGenStatus;
  markdown?: string;
  error?: string;
  claimToken?: string | null;
  claimedAt?: Date | null;
  attempts: number;
  model?: string;
  createdAt: Date;
  updatedAt: Date;
}
