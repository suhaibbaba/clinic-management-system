import { render } from "vitest-browser-react";
import { describe, expect, it } from "vitest";
import "@web/i18n";

// The claim is that a rise and a fall are told apart by more than a minus sign. A class name cannot
// say that — only the colour a browser actually resolves can.
const ink = (testId: string): string => {
  const element = document.querySelector(`[data-testid="${testId}"]`);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`nothing carries data-testid="${testId}"`);
  }

  return getComputedStyle(element).color;
};

describe("a stock movement reads as a rise or a fall", () => {
  it("colours the two differently, and neither as the body text", async () => {
    await render(
      <>
        <span data-testid="body" className="text-ink">
          ١٢٣
        </span>
        <span data-testid="bought" className="font-medium text-success-900">
          +5
        </span>
        <span data-testid="used" className="font-medium text-danger-600">
          -2
        </span>
      </>,
    );

    expect(ink("bought")).not.toBe(ink("used"));
    expect(ink("bought")).not.toBe(ink("body"));
    expect(ink("used")).not.toBe(ink("body"));
  });
});
