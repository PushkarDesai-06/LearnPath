/**
 * Mongoose connection singleton.
 *
 * Next.js dev mode re-evaluates modules on HMR, which would otherwise open a new
 * connection on every change. We cache the connection promise on `globalThis` so
 * a single connection is reused across reloads.
 *
 * NOTE: the URI (`mongodb://host:port`) carries no database path, so we pass
 * `dbName` explicitly — otherwise Mongoose defaults to the `test` database.
 */
import mongoose from "mongoose";
import { env } from "@/lib/env";

const globalForMongoose = globalThis as unknown as {
  _mongoosePromise?: Promise<typeof mongoose>;
};

export function connectMongoose(): Promise<typeof mongoose> {
  if (!globalForMongoose._mongoosePromise) {
    globalForMongoose._mongoosePromise = mongoose.connect(env.mongodbUri, {
      dbName: env.mongodbDb,
    });
  }
  return globalForMongoose._mongoosePromise;
}
