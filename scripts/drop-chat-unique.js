/**
 * One-time migration: drop the old UNIQUE index on the `chats` collection.
 *
 * The tutor used to allow exactly one conversation per (user, curriculum,
 * lessonRef), enforced by a unique index. Conversations are now first-class
 * (many per topic), so that unique index must be removed — Mongoose only ever
 * CREATES indexes, never drops them, so a stale unique index would throw E11000
 * when starting a second conversation for a topic.
 *
 * Run once against any pre-existing database:
 *   MONGODB_URI=mongodb://localhost:27017 MONGODB_DB=learnpath node scripts/drop-chat-unique.js
 */
const { MongoClient } = require("mongodb");

(async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB || "learnpath";
  const client = new MongoClient(uri);
  await client.connect();
  const chats = client.db(dbName).collection("chats");

  const indexes = await chats.indexes();
  const stale = indexes.find(
    (i) =>
      i.unique &&
      i.key &&
      i.key.userId === 1 &&
      i.key.curriculumId === 1 &&
      i.key.lessonRef === 1,
  );
  if (stale) {
    await chats.dropIndex(stale.name);
    console.log(`Dropped stale unique index: ${stale.name}`);
  } else {
    console.log("No stale unique chats index found — nothing to do.");
  }
  await client.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
