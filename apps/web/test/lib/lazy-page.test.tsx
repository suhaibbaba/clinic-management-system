import { render, screen } from "@testing-library/react";
import { Suspense, type JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageErrorBoundary } from "@web/components/page-error-boundary";
import "@web/i18n";
import ar from "@web/i18n/locales/ar.json";
import { lazyPage } from "@web/lib/lazy-page";

// Safari's "Importing a module script failed" left a white page: a page's code that no longer
// loads, with nothing to catch it.
describe("a page whose code fails to load", () => {
  const reload = vi.fn();
  const original = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, reload },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: original });
    vi.restoreAllMocks();
  });

  const failing = (): Promise<{ default: () => JSX.Element }> =>
    Promise.reject(new TypeError("Importing a module script failed."));

  const mount = (Page: ReturnType<typeof lazyPage>): void => {
    render(
      <PageErrorBoundary>
        <Suspense fallback={<p>loading</p>}>
          <Page />
        </Suspense>
      </PageErrorBoundary>,
    );
  };

  it("reloads once to fetch the current files", async () => {
    mount(lazyPage(failing));

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("page-failed")).toBeNull();
  });

  it("offers a reload, not a white page, when the reload did not help", async () => {
    sessionStorage.setItem("lazy-page-reloaded", "1");
    mount(lazyPage(failing));

    expect(await screen.findByText(ar.errors.pageFailed.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ar.common.reload })).toBeVisible();
    expect(reload).not.toHaveBeenCalled();
  });

  it("clears the flag once a page loads, so a later deploy can reload again", async () => {
    sessionStorage.setItem("lazy-page-reloaded", "1");
    mount(lazyPage(async () => ({ default: () => <p>chart</p> })));

    expect(await screen.findByText("chart")).toBeInTheDocument();
    expect(sessionStorage.getItem("lazy-page-reloaded")).toBeNull();
  });

  it("catches a page that throws while it renders", async () => {
    const Broken = (): JSX.Element => {
      throw new Error("boom");
    };
    render(
      <PageErrorBoundary>
        <Broken />
      </PageErrorBoundary>,
    );

    expect(await screen.findByTestId("page-failed")).toBeInTheDocument();
  });
});
