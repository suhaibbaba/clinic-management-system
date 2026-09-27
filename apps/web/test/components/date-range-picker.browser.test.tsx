import { DateRangePicker } from "@clinic/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@web/i18n";

// The value is a truncating LTR island; an `inline-block` with `overflow: hidden` sits on its own
// bottom edge, which lifted the dates above the middle of the field.
describe("a date range field", () => {
  it("centres the chosen dates in the field", () => {
    render(
      <DateRangePicker
        id="range"
        data-testid="range"
        label="Period"
        value={{ from: "2026-06-28", to: "" }}
        onChange={() => undefined}
      />,
    );

    const field = screen.getByTestId("range").getBoundingClientRect();
    const dates = screen.getByText(/28\/06\/2026/).getBoundingClientRect();
    const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

    expect(Math.abs(middle(dates) - middle(field))).toBeLessThanOrEqual(1);
  });
});
