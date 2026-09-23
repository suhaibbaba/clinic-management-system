import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeRegistration extends EventTarget {
  installing: (EventTarget & { state: string }) | null = null;
  update = vi.fn(async () => undefined);
}

async function load() {
  vi.resetModules();
  return import("@web/lib/service-worker");
}

function controlled(controller: object | null): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { controller },
  });
}

describe("service worker updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    controlled({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("asks for a newer build the moment the app opens", async () => {
    const { watchRegistration } = await load();
    const registration = new FakeRegistration();

    watchRegistration(registration as unknown as ServiceWorkerRegistration);

    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("says a newer build is installing, and stops saying so if it fails", async () => {
    const { watchRegistration, isUpdating, subscribeUpdating } = await load();
    const registration = new FakeRegistration();
    const listener = vi.fn();
    subscribeUpdating(listener);
    watchRegistration(registration as unknown as ServiceWorkerRegistration);

    const installing = Object.assign(new EventTarget(), { state: "installing" });
    registration.installing = installing;
    registration.dispatchEvent(new Event("updatefound"));
    expect(isUpdating()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    installing.state = "redundant";
    installing.dispatchEvent(new Event("statechange"));
    expect(isUpdating()).toBe(false);
  });

  it("announces nothing on the first install, which replaces nothing", async () => {
    controlled(null);
    const { watchRegistration, isUpdating } = await load();
    const registration = new FakeRegistration();
    watchRegistration(registration as unknown as ServiceWorkerRegistration);

    registration.dispatchEvent(new Event("updatefound"));
    expect(isUpdating()).toBe(false);
  });

  it("checks again when a home-screen app is reopened", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { watchRegistration } = await load();
    const registration = new FakeRegistration();
    watchRegistration(registration as unknown as ServiceWorkerRegistration);

    vi.advanceTimersByTime(2 * 60 * 1000);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it("waits out the poll before re-checking a browser tab", async () => {
    const { watchRegistration } = await load();
    const registration = new FakeRegistration();
    watchRegistration(registration as unknown as ServiceWorkerRegistration);

    vi.advanceTimersByTime(2 * 60 * 1000);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("swallows an unreachable server", async () => {
    const { watchRegistration, checkForUpdate } = await load();
    const registration = new FakeRegistration();
    registration.update.mockRejectedValue(new Error("offline"));
    watchRegistration(registration as unknown as ServiceWorkerRegistration);

    await expect(checkForUpdate()).resolves.toBeUndefined();
  });
});
