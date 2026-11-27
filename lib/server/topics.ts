/**
 * Topic (curriculum) management: rename, archive, restore and hard delete.
 * Every query carries the owner filter, so a foreign id is a plain 404.
 */
import { ObjectId } from "mongodb";
import {
  assessmentsCollection,
  blockVariantsCollection,
  chatsCollection,
  curriculaCollection,
  flashcardDecksCollection,
  flashcardsCollection,
  lessonsCollection,
  onboardingCollection,
  progressEventsCollection,
  userPrefsCollection,
} from "@/lib/db/collections";
import { notFound } from "@/lib/http";

export function parseTopicId(id: string): ObjectId {
  if (!/^[0-9a-f]{24}$/i.test(id)) throw notFound("Topic not found");
  return new ObjectId(id);
}

export async function renameTopic(userId: ObjectId, id: ObjectId, title: string) {
  const curricula = await curriculaCollection();
  const updated = await curricula.updateOne({ _id: id, userId }, { $set: { title, updatedAt: new Date() } });
  if (!updated.matchedCount) throw notFound("Topic not found");
}

/** Archive is idempotent: an already archived topic keeps its original archivedAt. */
export async function setTopicArchived(userId: ObjectId, id: ObjectId, archived: boolean) {
  const curricula = await curriculaCollection();
  if (!(await curricula.exists({ _id: id, userId }))) throw notFound("Topic not found");
  if (archived) {
    await curricula.updateOne(
      { _id: id, userId, archivedAt: null },
      { $set: { archivedAt: new Date() } },
    );
  } else {
    await curricula.updateOne({ _id: id, userId }, { $unset: { archivedAt: "" } });
  }
}

/**
 * Remove a topic and everything tied to it.
 *
 * The curriculum goes first: background workers and in-request generators
 * locate their lesson through it, so nothing new can be queued or written once
 * it is gone. The lesson docs go next (queued jobs are lesson docs in
 * `generating` state, and workers save with a filter on the doc and its claim,
 * never an upsert, so an in-flight result simply matches nothing). If a later
 * step fails, what remains is unreachable because the curriculum is gone.
 *
 * The onboarding and assessment that produced the topic are removed too, unless
 * another curriculum still hangs off the same assessment.
 */
export async function deleteTopic(userId: ObjectId, id: ObjectId) {
  const curricula = await curriculaCollection();
  const curriculum = await curricula.findOneAndDelete({ _id: id, userId }).lean();
  if (!curriculum) throw notFound("Topic not found");

  const scope = { userId, curriculumId: id };
  const [lessons, variants, decks, cards, chats, events, prefs] = await Promise.all([
    lessonsCollection(),
    blockVariantsCollection(),
    flashcardDecksCollection(),
    flashcardsCollection(),
    chatsCollection(),
    progressEventsCollection(),
    userPrefsCollection(),
  ]);
  await Promise.all([
    lessons.deleteMany(scope),
    variants.deleteMany(scope),
    decks.deleteMany(scope),
    cards.deleteMany(scope),
    chats.deleteMany(scope),
    events.deleteMany(scope),
    prefs.updateOne(
      { userId },
      { $pull: { pinnedLessons: { curriculumId: id }, recentLessons: { curriculumId: id } } },
    ),
    removeFunnel(userId, curriculum.assessmentId),
  ]);
}

async function removeFunnel(userId: ObjectId, assessmentId: ObjectId) {
  const curricula = await curriculaCollection();
  if (await curricula.exists({ userId, assessmentId })) return;
  const assessments = await assessmentsCollection();
  const assessment = await assessments.findOneAndDelete({ _id: assessmentId, userId }).lean();
  if (!assessment) return;
  const { onboardingId } = assessment;
  if (await assessments.exists({ userId, onboardingId })) return;
  await (await onboardingCollection()).deleteOne({ _id: onboardingId, userId });
}
