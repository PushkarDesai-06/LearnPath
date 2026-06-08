/**
 * Small helpers for JSON route handlers: consistent response envelopes, zod
 * body parsing, and an error type that maps to HTTP status codes.
 */
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, details);
export const unauthorized = (message = "Not authenticated") =>
  new ApiError(401, message);
export const forbidden = (message = "Forbidden") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.status },
    );
  }
  console.error("Unhandled route error:", error);
  const message =
    error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Parse and validate a JSON request body against a zod schema. Throws an
 * ApiError(400) on malformed JSON or validation failure.
 */
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw badRequest("Invalid request body", result.error.issues);
  }
  return result.data;
}

/**
 * Wrap an async route handler so any thrown ApiError (or unexpected error) is
 * turned into a JSON response with the right status code.
 */
export function handler<Args extends unknown[]>(
  fn: (request: Request, ...args: Args) => Promise<NextResponse>,
): (request: Request, ...args: Args) => Promise<NextResponse> {
  return async (request, ...args) => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
