/**
 * Plain, JSON-serializable shapes returned by the data layer (`lib/data/*`).
 *
 * Everything here is safe to pass from a Server Component to a Client
 * Component: ids are hex strings, dates are ISO strings, no ObjectIds. Client
 * islands `import type` from this file; it has no runtime code.
 */

export interface CurriculumSummary {
  modulesTotal: number;
  modulesCompleted: number;
  lessonsTotal: number;
  lessonsMastered: number;
  lessonsNeedingReview: number;
  overallMastery: number;
}

export interface TopicListItem {
  id: string;
  title: string;
  domain: string;
  version: number;
  createdAt: string;
  summary: CurriculumSummary;
}

export interface InProgressFunnel {
  onboardingId: string;
  topic: string;
  status: string;
  /** Where the learner should continue. */
  next: "onboarding" | "assessment";
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardLesson {
  id: string;
  title: string;
  status: string;
  difficultyLevel: string;
  estMinutes: number;
  masteryScore: number;
  /** Content already written. */
  generated: boolean;
}

export interface DashboardModule {
  id: string;
  title: string;
  summary: string;
  status: string;
  lessonsTotal: number;
  lessonsMastered: number;
  mastery: number;
  lessons: DashboardLesson[];
}

export interface RecommendedNext {
  reason: "needs_review" | "weakest_available";
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  generated: boolean;
  masteryScore: number;
}

export type DashboardData =
  | { hasCurriculum: false }
  | {
      hasCurriculum: true;
      curriculumId: string;
      title: string;
      version: number;
      summary: CurriculumSummary & { totalTimeMs: number };
      modules: DashboardModule[];
      recommendedNext: RecommendedNext | null;
    };

// ── Lessons ─────────────────────────────────────────────────────────────────

export interface LessonBlockDTO {
  kind: "text" | "code" | "analogy" | "example" | "practice";
  markdown?: string;
  language?: string;
  code?: string;
  caption?: string;
  questionId?: string;
  prompt?: string;
  type?: "mcq" | "short";
  choices?: string[] | null;
  /**
   * MCQ practice only — the key and explanation ride along with the lesson so
   * the page can grade a choice and reveal the answer with no round trip.
   * Short-answer blocks never carry these (see `publicLessonBlock`).
   */
  correctKey?: string | null;
  explanation?: string | null;
}

export interface LessonDTO {
  id: string;
  curriculumId: string;
  title: string;
  blocks: LessonBlockDTO[];
}

export type LessonView =
  | { status: "ready"; lesson: LessonDTO }
  | { status: "generating"; curriculumId: string };

// ── Tutor ───────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export interface ChatMessageDTO {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationDTO {
  conversationId: string;
  title: string;
  messages: ChatMessageDTO[];
}

// ── Onboarding ──────────────────────────────────────────────────────────────

export interface OnboardingResume {
  id: string;
  status: string;
  refinedTopic: string | null;
  cycle: number;
  maxCycles: number;
  exchanges: { role: "user" | "assistant"; text: string }[];
}

// ── Assessment ──────────────────────────────────────────────────────────────

export interface PublicQuestion {
  id: string;
  round: number;
  prompt: string;
  type: string;
  choices: string[] | null;
  topic: string;
  level: number;
}

export interface ReviewItem {
  id: string;
  prompt: string;
  choices: string[] | null;
  topic: string;
  level: number;
  yourAnswer: string | null;
  correctKey: string | null;
  correct: boolean | null;
}

export type AssessmentState =
  | { kind: "no_onboarding" }
  | {
      kind: "complete";
      assessmentId: string;
      score: number;
      estimatedLevel: string;
      review: ReviewItem[];
    }
  | { kind: "in_progress"; assessmentId: string; questions: PublicQuestion[] }
  | { kind: "fresh" };
