import { PageHeader } from "@clinic/ui";
import { render } from "vitest-browser-react";
import { describe, expect, it } from "vitest";
import "@web/i18n";

// A header that carries its own margin is counted twice wherever the page already spaces its
// sections, which is how one screen ended up 36px below its title and another 16px. Asserted as a
// measurement: a class name is not a margin, and only a browser resolves one.
describe("a page header brings no outer spacing of its own", () => {
  it("measures zero margin on every side", async () => {
    await render(<PageHeader data-testid="header" title="patients.title" />);

    const header = document.querySelector('[data-testid="header"]');

    if (!(header instanceof HTMLElement)) {
      throw new Error("the header did not render");
    }

    const style = getComputedStyle(header);

    expect(style.marginTop).toBe("0px");
    expect(style.marginBottom).toBe("0px");
    expect(style.marginInlineStart).toBe("0px");
    expect(style.marginInlineEnd).toBe("0px");
  });
});
