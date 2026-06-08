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
  levelIdx: number;
  topic: string;
  prompt: string;
  type: QuestionType;
  choices?: string[];
  correctKey?: string; // for mcq (index as string, e.g. "0")
  rubric?: string; // for short-answer grading
  answer?: string;
  correct?: boolean;
  confidence?: number; // grader 0..1
  askedAt: Date;
}

export interface TopicMastery {
  topic: string;
  score: number; // 0..1
}

export interface AssessmentResult {
  estimatedLevel: DifficultyLevel;
  perTopicMastery: TopicMastery[];
  strengths: string[];
  gaps: string[];
}

export interface AssessmentDoc {
  _id: ObjectId;
  userId: ObjectId;
  onboardingId: ObjectId;
  domain: string;
  refinedTopic: string;
  state: "in_progress" | "complete";
  levels: DifficultyLevel[];
  lowIdx: number;
  highIdx: number;
  currentLevelIdx: number;
  pendingConfirm: boolean; // mid-flight confirming question before committing a boundary flip
  questionCap: number;
  askedTopics: string[];
  questions: AssessmentQuestion[];
  result?: AssessmentResult;
  createdAt: Date;
  updatedAt: Date;
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
  | "practice";

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
}

export interface LessonDoc {
  _id: ObjectId;
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonRef: string; // matches CurriculumLesson.id
  title: string;
  blocks: LessonBlock[];
  generatedAt: Date;
  model: string;
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
  | "curriculum_reordered";

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

export interface ChatDoc {
  _id: ObjectId;
  userId: ObjectId;
  curriculumId: ObjectId;
  lessonRef?: string | null; // null = the general (non-lesson) conversation
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}
