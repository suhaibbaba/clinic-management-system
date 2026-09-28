import { AUTH_ERROR } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { ApiError, errorMessageKey } from "@web/shared/lib/api-error";

describe("errors read by code", () => {
  it("tells a locked sign-in apart from a plain rate limit", () => {
    expect(errorMessageKey(new ApiError(429, { message: AUTH_ERROR.LOCKED }))).toBe(
      "errors.auth.locked",
    );
    expect(
      errorMessageKey(new ApiError(429, { message: "ThrottlerException: Too Many Requests" })),
    ).toBe("errors.tooMany");
  });

  it("reads a refused sign-in code as its own message", () => {
    expect(errorMessageKey(new ApiError(401, { message: AUTH_ERROR.CODE_INVALID }))).toBe(
      "errors.auth.codeInvalid",
    );
  });
});
