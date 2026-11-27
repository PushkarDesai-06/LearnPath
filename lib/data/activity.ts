/**
 * Activity for the heatmap and streak: one topic's progress events bucketed into
 * the learner's calendar days. Pure read.
 */
import "server-only";
import { ObjectId } from "mongodb";
import { progressEventsCollection } from "@/lib/db/collections";
import type { ProgressEventType } from "@/lib/db/models";
import { buildActivity, type ActivityKind } from "@/lib/domain/activity";
import type { ActivityData } from "@/lib/data/types";

/** Finishing a lesson is a lesson; any graded answer is an answer. Everything else is not study. */
const KIND_BY_TYPE: Partial<Record<ProgressEventType, ActivityKind>> = {
  lesson_completed: "lesson",
  practice_answered: "answer",
  quiz_answered: "answer",
};

export async function getActivity(
  userId: string,
  curriculumId: string,
  timeZone: string,
): Promise<ActivityData> {
  const events = await progressEventsCollection();
  const rows = await events
    .find(
      {
        userId: new ObjectId(userId),
        curriculumId: new ObjectId(curriculumId),
        type: { $in: Object.keys(KIND_BY_TYPE) as ProgressEventType[] },
      },
      { at: 1, type: 1 },
    )
    .sort({ at: 1 })
    .lean();
  return buildActivity(
    rows.map((row) => ({ at: row.at, kind: KIND_BY_TYPE[row.type]! })),
    timeZone,
  );
}
