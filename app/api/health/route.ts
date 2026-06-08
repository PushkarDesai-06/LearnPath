// Lightweight ops health check — verifies the Mongoose connection works.
import mongoose from "mongoose";
import { connectMongoose } from "@/lib/db/client";
import { handler, json } from "@/lib/http";

export const GET = handler(async () => {
  await connectMongoose();
  const db = mongoose.connection.db;
  const ping = await db?.admin().ping();
  return json({ ok: ping?.ok === 1, db: db?.databaseName ?? null });
});
