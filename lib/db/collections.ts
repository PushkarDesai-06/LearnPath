/**
 * Mongoose schemas + compiled models, plus accessor functions.
 *
 * The accessor functions (`usersCollection()` etc.) keep their historical names
 * but now return the corresponding **Mongoose model** after ensuring the
 * connection is open. Reads in the codebase use `.lean()` to return plain
 * objects (matching `lib/db/models.ts` interfaces) — so we get Mongoose for
 * connection management, schema-declared indexes, and write-time validation,
 * but NOT document hydration / instance methods / virtuals on read results.
 *
 * Every subdocument field is declared explicitly: in strict mode (the default)
 * Mongoose silently drops fields absent from the schema on write, which would
 * cause hard-to-spot data loss (e.g. assessment answers added after grading).
 */
import mongoose, { Schema, type Model } from "mongoose";
import { connectMongoose } from "@/lib/db/client";
import type {
  AssessmentDoc,
  ChatDoc,
  CurriculumDoc,
  LessonDoc,
  OnboardingDoc,
  ProgressEventDoc,
  SessionDoc,
  UserDoc,
} from "@/lib/db/models";

const subOpts = { _id: false } as const;

// --- shared subdocuments ---------------------------------------------------

const clarityExchangeSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    at: { type: Date, required: true },
  },
  subOpts,
);

const assessmentQuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    round: { type: Number, required: true },
    levelIdx: { type: Number, required: true },
    topic: { type: String, required: true },
    prompt: { type: String, required: true },
    type: { type: String, enum: ["mcq", "short"], required: true },
    choices: { type: [String], default: undefined },
    correctKey: { type: String },
    rubric: { type: String },
    answer: { type: String },
    correct: { type: Boolean },
    confidence: { type: Number },
    askedAt: { type: Date, required: true },
  },
  subOpts,
);

const topicMasterySchema = new Schema(
  { topic: { type: String, required: true }, score: { type: Number, required: true } },
  subOpts,
);

const assessmentResultSchema = new Schema(
  {
    estimatedLevel: { type: String, required: true },
    score: { type: Number, default: 0 },
    perTopicMastery: { type: [topicMasterySchema], default: [] },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
  },
  subOpts,
);

const curriculumLessonSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    objectives: { type: [String], default: [] },
    order: { type: Number, required: true },
    estMinutes: { type: Number, required: true },
    difficultyLevel: { type: String, required: true },
    topics: { type: [String], default: [] },
    contentGenerated: { type: Boolean, default: false },
    status: { type: String, required: true },
    masteryScore: { type: Number, default: 0 },
  },
  subOpts,
);

const curriculumModuleSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    order: { type: Number, required: true },
    prerequisites: { type: [String], default: [] },
    status: { type: String, required: true },
    lessons: { type: [curriculumLessonSchema], default: [] },
  },
  subOpts,
);

const lessonBlockSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["text", "code", "analogy", "example", "practice"],
      required: true,
    },
    markdown: { type: String },
    language: { type: String },
    code: { type: String },
    caption: { type: String },
    questionId: { type: String },
    prompt: { type: String },
    type: { type: String, enum: ["mcq", "short"] },
    choices: { type: [String], default: undefined },
    correctKey: { type: String },
    rubric: { type: String },
    explanation: { type: String },
  },
  subOpts,
);

const chatMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    at: { type: Date, required: true },
  },
  subOpts,
);

// --- top-level collections -------------------------------------------------

const userSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});

const sessionSchema = new Schema<SessionDoc>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  tokenId: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true },
  // TTL index: the document is removed once expiresAt passes.
  expiresAt: { type: Date, required: true, expires: 0 },
  userAgent: { type: String },
});

const onboardingSchema = new Schema<OnboardingDoc>({
  userId: { type: Schema.Types.ObjectId, required: true },
  rawDescription: { type: String, required: true },
  refinedTopic: { type: String },
  domain: { type: String },
  clarity: {
    clearEnough: { type: Boolean, required: true },
    cycle: { type: Number, required: true },
    maxCycles: { type: Number, required: true },
    exchanges: { type: [clarityExchangeSchema], default: [] },
  },
  status: { type: String, required: true },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});
onboardingSchema.index({ userId: 1, status: 1 });

const assessmentSchema = new Schema<AssessmentDoc>({
  userId: { type: Schema.Types.ObjectId, required: true },
  onboardingId: { type: Schema.Types.ObjectId, required: true },
  domain: { type: String, required: true },
  refinedTopic: { type: String, required: true },
  state: { type: String, required: true },
  levels: { type: [String], default: [] },
  rounds: { type: Number, default: 1 },
  questions: { type: [assessmentQuestionSchema], default: [] },
  result: { type: assessmentResultSchema, default: undefined },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});
assessmentSchema.index({ userId: 1, state: 1 });

const curriculumSchema = new Schema<CurriculumDoc>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  assessmentId: { type: Schema.Types.ObjectId, required: true },
  domain: { type: String, required: true },
  title: { type: String, required: true },
  modules: { type: [curriculumModuleSchema], default: [] },
  version: { type: Number, default: 1 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});

const lessonSchema = new Schema<LessonDoc>({
  userId: { type: Schema.Types.ObjectId, required: true },
  curriculumId: { type: Schema.Types.ObjectId, required: true },
  lessonRef: { type: String, required: true },
  title: { type: String, required: true },
  blocks: { type: [lessonBlockSchema], default: [] },
  generatedAt: { type: Date, required: true },
  model: { type: String, default: "" },
  genStatus: { type: String, default: "ready" },
  genError: { type: String },
  claimedAt: { type: Date, default: null },
});
lessonSchema.index({ userId: 1, curriculumId: 1, lessonRef: 1 }, { unique: true });
// Worker scans for lessons awaiting generation.
lessonSchema.index({ genStatus: 1, claimedAt: 1 });

const progressEventSchema = new Schema<ProgressEventDoc>({
  userId: { type: Schema.Types.ObjectId, required: true },
  curriculumId: { type: Schema.Types.ObjectId, required: true },
  lessonRef: { type: String },
  type: { type: String, required: true },
  topics: { type: [String], default: undefined },
  correct: { type: Boolean },
  score: { type: Number },
  timeSpentMs: { type: Number },
  at: { type: Date, required: true },
});
progressEventSchema.index({ userId: 1, at: -1 });
progressEventSchema.index({ userId: 1, curriculumId: 1 });

const chatSchema = new Schema<ChatDoc>({
  userId: { type: Schema.Types.ObjectId, required: true },
  curriculumId: { type: Schema.Types.ObjectId, required: true },
  lessonRef: { type: String, default: null }, // context tag only (not identity)
  title: { type: String, default: "New conversation" },
  messages: { type: [chatMessageSchema], default: [] },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});
// A topic can have many conversations now — list them newest-first.
// NOTE: the old UNIQUE (userId, curriculumId, lessonRef) index must be dropped
// from any existing DB (Mongoose won't drop it). See scripts/drop-chat-unique.js.
chatSchema.index({ userId: 1, curriculumId: 1, updatedAt: -1 });

// --- model registration (HMR-safe) ----------------------------------------
// `mongoose.models.X || mongoose.model(...)` avoids OverwriteModelError when
// Next dev re-imports this module on hot reload. The collection name is pinned
// explicitly (3rd arg) so Mongoose's auto-pluralization doesn't rename them —
// keeping the exact original collection names (e.g. `onboarding`, `curricula`,
// `progressEvents`, not Mongoose's `onboardings`/`curriculums`/`progressevents`).

function model<T>(
  name: string,
  schema: Schema<T>,
  collection: string,
): Model<T> {
  return (
    (mongoose.models[name] as Model<T> | undefined) ??
    mongoose.model<T>(name, schema, collection)
  );
}

const User = model<UserDoc>("User", userSchema, "users");
const Session = model<SessionDoc>("Session", sessionSchema, "sessions");
const Onboarding = model<OnboardingDoc>(
  "Onboarding",
  onboardingSchema,
  "onboarding",
);
const Assessment = model<AssessmentDoc>(
  "Assessment",
  assessmentSchema,
  "assessments",
);
const Curriculum = model<CurriculumDoc>(
  "Curriculum",
  curriculumSchema,
  "curricula",
);
const Lesson = model<LessonDoc>("Lesson", lessonSchema, "lessons");
const ProgressEvent = model<ProgressEventDoc>(
  "ProgressEvent",
  progressEventSchema,
  "progressEvents",
);
const Chat = model<ChatDoc>("Chat", chatSchema, "chats");

// --- accessors (ensure connection, return the model) -----------------------

async function ready<T>(m: Model<T>): Promise<Model<T>> {
  await connectMongoose();
  return m;
}

export const usersCollection = () => ready(User);
export const sessionsCollection = () => ready(Session);
export const onboardingCollection = () => ready(Onboarding);
export const assessmentsCollection = () => ready(Assessment);
export const curriculaCollection = () => ready(Curriculum);
export const lessonsCollection = () => ready(Lesson);
export const progressEventsCollection = () => ready(ProgressEvent);
export const chatsCollection = () => ready(Chat);
