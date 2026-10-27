import type { ObjectId } from "mongodb";
import { curriculaCollection } from "@/lib/db/collections";
import type { CurriculumDoc } from "@/lib/db/models";
import { conflict, notFound } from "@/lib/http";

/**
 * Compare-and-swap one curriculum. The synchronous callback may run again on a
 * newer snapshot: keep AI calls and event writes outside it. Works on standalone
 * MongoDB as the receipt and resulting progress share one atomic document write.
 */
export async function mutateCurriculum<T>(
  userId: ObjectId,
  curriculumId: ObjectId,
  mutate: (doc: CurriculumDoc) => { value: T; changed: boolean },
): Promise<T> {
  const curricula = await curriculaCollection();
  for (let attempt = 0; attempt < 8; attempt++) {
    const doc = await curricula.findOne({ _id: curriculumId, userId }).lean();
    if (!doc) throw notFound("Curriculum not found");
    const revision = doc.revision;
    const result = mutate(doc);
    if (!result.changed) return result.value;
    const saved = await curricula.collection.updateOne(
      { _id: curriculumId, userId, revision: revision ?? { $exists: false } },
      {
        $set: { modules: doc.modules, version: doc.version, updatedAt: new Date() },
        $inc: { revision: 1 },
      },
    );
    if (saved.matchedCount === 1) return result.value;
  }
  throw conflict("Your progress changed while saving. Please retry.");
}
