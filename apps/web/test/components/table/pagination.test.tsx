import { Table } from "@clinic/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@web/i18n";
import ar from "@web/i18n/locales/ar.json";

function setViewport(isMobile: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isMobile && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function renderPager(page = 1, totalPages = 9, perPage?: number) {
  const onPageChange = vi.fn();
  render(
    <Table
      columns={[{ key: "name", header: "common.name", primary: true, render: (row) => row.name }]}
      rows={[{ id: "1", name: "row" }]}
      rowKey={(row) => row.id}
      pagination={{
        page,
        totalPages,
        onPageChange,
        ...(perPage !== undefined && { perPage, onPerPageChange: () => undefined }),
      }}
      data-testid="list"
    />,
  );
  return onPageChange;
}

const pageField = (): HTMLInputElement =>
  screen.getByRole("textbox", { name: ar.pagination.pageOf.replace("{{totalPages}}", "9") });

afterEach(() => vi.unstubAllGlobals());

describe("Pagination on a phone", () => {
  it("draws arrows around the current page and the page count, with no numbered pages", () => {
    setViewport(true);
    renderPager(3);

    expect(pageField()).toHaveValue("3");
    expect(screen.getByTestId("list-pagination-nav-page-field-count")).toHaveTextContent("9");
    expect(screen.queryByTestId("list-pagination-page-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: ar.pagination.previous })).toBeEnabled();
    expect(screen.getByRole("button", { name: ar.pagination.next })).toBeEnabled();
  });

  it("keeps the page size on the same row, named but without the words beside it", () => {
    setViewport(true);
    renderPager(1, 9, 10);

    expect(screen.getByRole("combobox", { name: ar.pagination.perPage })).toHaveTextContent("10");
    expect(screen.getByText(ar.pagination.perPage)).toHaveClass("sr-only");
  });

  it("goes to a typed page on Enter, reading Arabic-Indic digits", async () => {
    setViewport(true);
    const onPageChange = renderPager();

    await userEvent.clear(pageField());
    await userEvent.type(pageField(), "٧{Enter}");

    expect(onPageChange).toHaveBeenCalledWith(7);
  });

  it("snaps a page that does not exist back to the current one", async () => {
    setViewport(true);
    const onPageChange = renderPager(2);

    await userEvent.clear(pageField());
    await userEvent.type(pageField(), "40");
    await userEvent.tab();

    expect(onPageChange).not.toHaveBeenCalled();
    expect(pageField()).toHaveValue("2");
  });
});

describe("Pagination on a wide screen", () => {
  it("names the pages and does not count the records", () => {
    setViewport(false);
    renderPager();

    expect(screen.getByTestId("list-pagination-page-1")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("list-pagination-total")).not.toBeInTheDocument();
  });
});
