import { Button, Input } from "@clinic/ui";
import { render } from "vitest-browser-react";
import { describe, expect, it } from "vitest";

// jsdom returns an empty string for a custom property and never lays anything out, so every
// assertion here is one the other project cannot make.
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const pixels = (value: string): number => Number.parseFloat(value);

describe("the type scale, as the browser computes it", () => {
  it("measures the root at the browser's own default", () => {
    expect(pixels(getComputedStyle(document.documentElement).fontSize)).toBe(16);
  });

  it.each([
    ["--text-micro", 12],
    ["--text-meta", 13],
    ["--text-label", 14],
    ["--text-value", 15],
    ["--text-section", 16],
    ["--text-heading", 18],
    ["--text-title", 22],
    ["--text-field", 16],
  ])("resolves %s to %ipx", (name, expected) => {
    const element = document.createElement("span");
    element.style.fontSize = `var(${name})`;
    document.body.append(element);

    expect(pixels(getComputedStyle(element).fontSize)).toBe(expected);

    element.remove();
  });

  it("puts nothing carrying content below 12px", () => {
    const sizes = ["--text-micro", "--text-meta", "--text-label", "--text-value"].map((name) => {
      const element = document.createElement("span");
      element.style.fontSize = `var(${name})`;
      document.body.append(element);
      const size = pixels(getComputedStyle(element).fontSize);
      element.remove();
      return size;
    });

    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });
});

describe("a control's height is a token, not a value of its own", () => {
  const measure = (testId: string): DOMRect => {
    const element = document.querySelector(`[data-testid="${testId}"]`);

    if (!(element instanceof HTMLElement)) {
      throw new Error(`nothing carries data-testid="${testId}"`);
    }

    return element.getBoundingClientRect();
  };

  // `render` resolves once React has committed, so it is awaited before anything
  // is measured — an unawaited one measures an element that is not there yet.
  it("draws a button at --control-h", async () => {
    await render(<Button data-testid="probe">حفظ</Button>);

    expect(measure("probe").height).toBe(pixels(token("--control-h")));
  });

  it("draws a field at the same height as a button", async () => {
    await render(
      <>
        <Button data-testid="button">حفظ</Button>
        <Input data-testid="field" aria-label="الاسم" />
      </>,
    );

    expect(measure("field").height).toBe(measure("button").height);
  });
});
