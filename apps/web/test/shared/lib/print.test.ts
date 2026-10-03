import { describe, expect, it } from "vitest";
import { PAGE_MARK, TOTAL_MARK } from "@web/shared/constants/print";
import { printPageCss } from "@web/shared/lib/print";

const css = printPageCss({
  name: 'عيادة "النور"',
  title: "كشف الرواتب",
  printed: "طُبع في 4 Oct 2026 · 10:30 AM",
  page: `صفحة ${PAGE_MARK} من ${TOTAL_MARK}`,
});

describe("print page marks", () => {
  it("numbers every page with the browser's own counters", () => {
    expect(css).toContain('content: "صفحة " counter(page) " من " counter(pages) "";');
  });

  it("puts the clinic and when it was printed on two lines of the footer", () => {
    expect(css).toContain(
      '@bottom-right { content: "عيادة \\"النور\\"\\A طُبع في 4 Oct 2026 · 10:30 AM"; }',
    );
  });

  it("repeats the clinic and the title from the second page on, not on the first", () => {
    expect(css).toContain('@top-left { content: "كشف الرواتب"; }');
    expect(css).toMatch(
      /@page :first \{\s+@top-right \{ content: none; \}\s+@top-left \{ content: none; \}/,
    );
  });
});
