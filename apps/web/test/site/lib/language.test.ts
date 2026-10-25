import { describe, expect, it } from "vitest";
import { languageFlag } from "@web/site/lib/language";

describe("language flags", () => {
  it("flies the clinic's own flag for Arabic when it is an Arabic-speaking country", () => {
    expect(languageFlag("ar", "JO")).toBe("JO");
    expect(languageFlag("ar", "PS")).toBe("PS");
  });

  it("falls back to the default flag for Arabic elsewhere", () => {
    expect(languageFlag("ar", "DE")).toBe("PS");
    expect(languageFlag("ar", "XX")).toBe("PS");
  });

  it("uses the British flag for English", () => {
    expect(languageFlag("en", "JO")).toBe("GB");
  });
});
