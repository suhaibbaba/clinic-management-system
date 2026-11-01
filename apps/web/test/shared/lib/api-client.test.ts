import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, restoreSession } from "@web/shared/lib/api-client";
import { NetworkError } from "@web/shared/lib/api-error";
import { authTokens } from "@web/shared/lib/auth-tokens";

const reply = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const answers = (...responses: (Response | Error)[]) => {
  const queue = [...responses];

  return vi.fn(() => {
    const next = queue.shift();

    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next ?? reply(500));
  });
};

describe("the session through an API outage", () => {
  const ended = vi.fn();
  let stopListening: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    authTokens.clear();
    ended.mockClear();
    stopListening = authTokens.onSessionEnded(ended);
  });

  afterEach(() => {
    stopListening();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("signs out when the refresh cookie is refused", async () => {
    const fetch = answers(reply(401));
    vi.stubGlobal("fetch", fetch);

    await expect(restoreSession()).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("waits out a restarting API instead of signing out on start-up", async () => {
    vi.stubGlobal(
      "fetch",
      answers(
        reply(502),
        new TypeError("connection refused"),
        reply(200, { accessToken: "fresh" }),
      ),
    );

    const restored = restoreSession();
    await vi.runAllTimersAsync();

    await expect(restored).resolves.toBe(true);
    expect(authTokens.get()).toBe("fresh");
  });

  it("keeps the session when the refresh cannot reach the API mid-session", async () => {
    authTokens.set("expired");
    vi.stubGlobal("fetch", answers(reply(401), reply(503)));

    await expect(apiRequest("/patients")).rejects.toBeInstanceOf(NetworkError);
    expect(ended).not.toHaveBeenCalled();
    expect(authTokens.get()).toBe("expired");
  });

  it("ends the session when the refresh is refused mid-session", async () => {
    authTokens.set("expired");
    vi.stubGlobal("fetch", answers(reply(401), reply(401)));

    await expect(apiRequest("/patients")).rejects.toMatchObject({ statusCode: 401 });
    expect(ended).toHaveBeenCalledTimes(1);
  });
});
