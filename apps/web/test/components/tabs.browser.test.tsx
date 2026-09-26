import { Tabs } from "@clinic/ui";
import { render, screen } from "@testing-library/react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import "@web/i18n";

const TABS = [
  { id: "chart", label: "patients.tabs.chart" },
  { id: "visits", label: "patients.tabs.visits" },
  { id: "billing", label: "patients.tabs.billing" },
] as const;

// iOS draws a scroll indicator inside a scrolling strip's bottom edge; it must run under the pills.
describe("a strip of tabs", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  const renderTabs = () =>
    render(
      <Tabs
        data-testid="strip"
        label="patients.tabs.label"
        tabs={TABS}
        value="chart"
        onChange={() => undefined}
      />,
    );

  it("leaves room under the pills for the scroll indicator on a phone", async () => {
    await page.viewport(390, 800);
    renderTabs();

    expect(getComputedStyle(screen.getByTestId("strip")).paddingBottom).toBe("8px");
  });

  it("needs no such room once the pills wrap", async () => {
    await page.viewport(1024, 800);
    renderTabs();

    expect(getComputedStyle(screen.getByTestId("strip")).paddingBottom).toBe("0px");
  });
});
