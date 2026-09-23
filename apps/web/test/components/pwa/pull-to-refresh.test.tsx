import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@web/i18n";
import { PULL_THRESHOLD, PullToRefresh } from "@web/components/pwa/pull-to-refresh";
import * as serviceWorker from "@web/lib/service-worker";

function touch(type: string, clientY: number, target: EventTarget = document.body): void {
  const event = new Event(type, { bubbles: true });
  const touches = type === "touchend" ? [] : [{ clientY }];

  Object.defineProperty(event, "touches", { value: touches });
  act(() => void target.dispatchEvent(event));
}

/** A pull that travels `distance` after damping. */
function pull(distance: number, target?: EventTarget): void {
  touch("touchstart", 100, target);
  touch("touchmove", 100 + distance * 2, target);
}

function renderPull() {
  const client = new QueryClient();
  const refetch = vi.spyOn(client, "refetchQueries").mockResolvedValue();

  render(
    <QueryClientProvider client={client}>
      <PullToRefresh enabled />
    </QueryClientProvider>,
  );

  return { refetch };
}

describe("PullToRefresh", () => {
  beforeEach(() => {
    vi.spyOn(serviceWorker, "checkForUpdate").mockResolvedValue();
  });

  it("stays out of a browser tab, which has its own", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PullToRefresh enabled={false} />
      </QueryClientProvider>,
    );

    pull(PULL_THRESHOLD * 2);
    expect(screen.queryByTestId("pull-to-refresh")).not.toBeInTheDocument();
  });

  it("refetches what is on screen and asks for a newer build once released past the mark", async () => {
    const { refetch } = renderPull();

    pull(PULL_THRESHOLD + 4);
    expect(screen.getByTestId("pull-to-refresh")).toHaveAttribute("data-state", "armed");

    touch("touchend", 0);
    expect(screen.getByTestId("pull-to-refresh")).toHaveAttribute("data-state", "refreshing");
    expect(refetch).toHaveBeenCalledWith({ type: "active" });
    expect(serviceWorker.checkForUpdate).toHaveBeenCalled();

    await act(async () => undefined);
    expect(screen.queryByTestId("pull-to-refresh")).not.toBeInTheDocument();
  });

  it("does nothing when let go short of the mark", () => {
    const { refetch } = renderPull();

    pull(PULL_THRESHOLD - 10);
    expect(screen.getByTestId("pull-to-refresh")).toHaveAttribute("data-state", "pulling");

    touch("touchend", 0);
    expect(refetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pull-to-refresh")).not.toBeInTheDocument();
  });

  it("leaves a scrolled list to scroll", () => {
    const { refetch } = renderPull();
    const list = document.createElement("div");
    document.body.append(list);
    Object.defineProperty(list, "scrollTop", { value: 40 });

    pull(PULL_THRESHOLD * 2, list);
    touch("touchend", 0, list);

    expect(refetch).not.toHaveBeenCalled();
    list.remove();
  });

  it("leaves an open dialog alone", () => {
    const { refetch } = renderPull();
    document.body.setAttribute("data-scroll-locked", "1");

    pull(PULL_THRESHOLD * 2);
    touch("touchend", 0);

    expect(refetch).not.toHaveBeenCalled();
    document.body.removeAttribute("data-scroll-locked");
  });
});
