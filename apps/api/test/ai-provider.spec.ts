import { AI_ERROR_CODE } from "@clinic/shared";
import OpenAI from "openai";
import { classify } from "@api/ai/openai-chat.provider";
import { envSchema } from "@api/config/env.schema";

const apiError = (status: number, code?: string): Error =>
  OpenAI.APIError.generate(status, { error: { message: "x", code } }, "x", new Headers());

describe("a provider failure", () => {
  it.each([
    ["a rejected key", apiError(401), AI_ERROR_CODE.PROVIDER_REJECTED],
    ["a forbidden key", apiError(403), AI_ERROR_CODE.PROVIDER_REJECTED],
    ["a rate limit", apiError(429), AI_ERROR_CODE.PROVIDER_QUOTA],
    ["an exhausted quota", apiError(400, "insufficient_quota"), AI_ERROR_CODE.PROVIDER_QUOTA],
    ["a server error", apiError(503), AI_ERROR_CODE.PROVIDER_UNAVAILABLE],
    ["a timeout", new OpenAI.APIConnectionTimeoutError(), AI_ERROR_CODE.PROVIDER_UNAVAILABLE],
    ["anything else", new Error("x"), AI_ERROR_CODE.PROVIDER_UNAVAILABLE],
  ])("reads %s as its own code", (_name, error, code) => {
    expect(classify(error)).toBe(code);
  });
});

// Chat Completions answers 400 to function tools with any reasoning effort but `none`.
describe("the reasoning effort", () => {
  const base = {
    DATABASE_URL: "postgres://x",
    JWT_SECRET: "x".repeat(32),
    STORAGE_ENDPOINT: "http://x",
    STORAGE_BUCKET: "x",
    STORAGE_ACCESS_KEY_ID: "x",
    STORAGE_SECRET_ACCESS_KEY: "x",
  };

  it("defaults to none", () => {
    expect(envSchema.parse(base).AI_REASONING_EFFORT).toBe("none");
  });

  it.each(["low", "medium"])("refuses to boot on %s", (effort) => {
    expect(envSchema.safeParse({ ...base, AI_REASONING_EFFORT: effort }).success).toBe(false);
  });
});
