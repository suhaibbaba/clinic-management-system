import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cn, FONT_SIZE_KEYS, LEADING_KEYS, RADIUS_KEYS } from "@ui/lib/cn";

const theme = readFileSync(join(__dirname, "..", "styles", "base.css"), "utf8");

const tokensOf = (prefix: string): string[] => [
  ...new Set(
    [...theme.matchAll(new RegExp(`^\\s*--${prefix}-([a-z0-9-]+):`, "gm"))]
      .map((match) => match[1] ?? "")
      .filter((name) => !name.endsWith("--line-height")),
  ),
];

describe("cn", () => {
  it("keeps a text colour and a text size together", () => {
    const result = cn("bg-neutral-900 text-ink-inverse", "text-value");

    expect(result).toContain("text-ink-inverse");
    expect(result).toContain("text-value");
  });

  it.each(FONT_SIZE_KEYS)("treats text-%s as a size, not a colour", (size) => {
    expect(cn(`text-ink-muted text-${size}`)).toContain("text-ink-muted");
    expect(cn(`text-ink-muted text-${size}`)).toContain(`text-${size}`);
  });

  it("lets a caller override the radius a component sets", () => {
    expect(cn("skeleton rounded-pill", "rounded-card")).toContain("rounded-card");
    expect(cn("skeleton rounded-pill", "rounded-card")).not.toContain("rounded-pill");
  });

  it("still lets one size win over another", () => {
    expect(cn("text-label", "text-kpi")).toBe("text-kpi");
  });

  it("still resolves ordinary conflicts, so an override works", () => {
    expect(cn("w-full", "w-64")).toBe("w-64");
    expect(cn("text-ink", "text-ink-muted")).toBe("text-ink-muted");
  });

  it.each([
    ["text", FONT_SIZE_KEYS],
    ["leading", LEADING_KEYS],
    ["radius", RADIUS_KEYS],
  ])("registers every %s token base.css names", (prefix, registered) => {
    expect([...registered].sort()).toEqual(tokensOf(prefix as string).sort());
  });
});
