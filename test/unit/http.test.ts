import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  readJson,
  json,
  handler,
} from "@/lib/http";

function jsonRequest(body: string) {
  return new Request("http://test.local/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("ApiError + factory helpers", () => {
  it("carries status, message and optional details", () => {
    const err = new ApiError(418, "teapot", { hint: "short and stout" });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(418);
    expect(err.message).toBe("teapot");
    expect(err.details).toEqual({ hint: "short and stout" });
  });

  it("each helper maps to the right status code", () => {
    expect(badRequest("x").status).toBe(400);
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
    expect(conflict("dupe").status).toBe(409);
  });
});

describe("readJson", () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it("parses and validates a well-formed body", async () => {
    const data = await readJson(
      jsonRequest(JSON.stringify({ name: "Ada", age: 36 })),
      schema,
    );
    expect(data).toEqual({ name: "Ada", age: 36 });
  });

  it("throws ApiError(400) on schema validation failure", async () => {
    await expect(
      readJson(jsonRequest(JSON.stringify({ name: "Ada" })), schema),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws ApiError(400) on malformed JSON", async () => {
    await expect(readJson(jsonRequest("{not json"), schema)).rejects.toMatchObject(
      { status: 400 },
    );
  });
});

describe("json + handler envelopes", () => {
  it("json() builds a response with the given status and body", async () => {
    const res = json({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("handler turns a thrown ApiError into its status + message", async () => {
    const route = handler(async () => {
      throw notFound("missing");
    });
    const res = await route(jsonRequest("{}"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "missing" });
  });

  it("handler maps an unexpected error to 500", async () => {
    const route = handler(async () => {
      throw new Error("boom");
    });
    const res = await route(jsonRequest("{}"));
    expect(res.status).toBe(500);
  });

  it("handler passes through a successful response", async () => {
    const route = handler(async () => json({ hello: "world" }));
    const res = await route(jsonRequest("{}"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
  });
});
