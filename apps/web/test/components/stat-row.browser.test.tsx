import { StatCard, StatRow } from "@clinic/ui";
import { render, screen } from "@testing-library/react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import "@web/i18n";

// Two cards on a narrow phone cut a label chip to "Open ord…". It now wraps once, at the label's
// own line height rather than the one-line pill's.
describe("a stat card's label chip", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it("wraps a long label onto a second line, readable and whole", async () => {
    await page.viewport(375, 800);
    render(
      <div className="px-4">
        <StatRow>
          <StatCard
            data-testid="due"
            icon="money"
            label="إجمالي المبلغ المستحق لجميع المختبرات"
            value="9966"
          />
          <StatCard data-testid="open" icon="clock" label="الطلبات المفتوحة حالياً" value="4" />
        </StatRow>
      </div>,
    );

    const chip = screen.getByTestId("due-label");
    const words = chip.querySelector("[data-part='badge-label']");

    if (!(words instanceof HTMLElement)) {
      throw new Error("the chip has no label");
    }

    const lineHeight = parseFloat(getComputedStyle(words).lineHeight);
    const lines = Math.round(words.getBoundingClientRect().height / lineHeight);

    expect(lineHeight).toBeGreaterThan(parseFloat(getComputedStyle(words).fontSize));
    expect(lines).toBe(2);
    expect(words.scrollHeight).toBeLessThanOrEqual(words.clientHeight + 1);
    expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
      screen.getByTestId("due").getBoundingClientRect().right,
    );
  });

  it("stays the one-line pill when the label fits", async () => {
    await page.viewport(1280, 800);
    render(
      <StatRow>
        <StatCard data-testid="open" icon="clock" label="Open orders" value="4" />
      </StatRow>,
    );

    const chip = screen.getByTestId("open-label");
    const pill = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--control-h-sm"),
    );

    expect(chip.getBoundingClientRect().height).toBeCloseTo(pill, 0);
  });
});
