import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { themeVariables } from "@clinic/ui/theme";
import { describe, expect, it } from "vitest";
import { abuObaidTheme } from "@web/theme";

const SRC = join(__dirname, "..", "src");
const UI_SRC = join(__dirname, "..", "..", "..", "packages", "ui", "src");
const THEME_CSS = readFileSync(join(SRC, "theme.css"), "utf8");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      sourceFiles(path, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(path);
    }
  }

  return acc;
}

const FILES = [
  ...sourceFiles(SRC).map((path) => ({ path: path.slice(SRC.length + 1), source: "" })),
  ...sourceFiles(UI_SRC).map((path) => ({
    path: join("@clinic/ui", path.slice(UI_SRC.length + 1)),
    source: "",
  })),
]
  .map((file) => ({
    ...file,
    source: readFileSync(
      file.path.startsWith("@clinic/ui")
        ? join(UI_SRC, file.path.slice("@clinic/ui".length + 1))
        : join(SRC, file.path),
      "utf8",
    ),
  }))
  .filter((file) => file.path !== "theme.ts");

describe("design tokens", () => {
  it("has files to check", () => {
    expect(FILES.length).toBeGreaterThan(30);
    expect(FILES.filter((file) => file.path.startsWith("@clinic/ui")).length).toBeGreaterThan(30);
  });

  it("gives theme.ts the values theme.css compiles", () => {
    const drifted = Object.entries(themeVariables(abuObaidTheme)).filter(([name, value]) => {
      const declared = new RegExp(`^\\s*${name}:\\s*(.+?);\\s*(?:/\\*.*)?$`, "m").exec(THEME_CSS);

      return declared?.[1]?.trim() !== value;
    });

    expect(drifted).toEqual([]);
  });

  it("gives theme.css no override theme.ts is missing", () => {
    const typed = new Set(Object.keys(themeVariables(abuObaidTheme)));
    const overridden = [
      ...THEME_CSS.matchAll(/^\s*(--(?:color|shadow|radius|text|control)-[a-z0-9-]+):/gm),
    ]
      .map((match) => match[1] ?? "")
      .filter((name) => !name.startsWith("--color-tooth-") && !name.startsWith("--color-chart-"))
      .filter(
        (name) =>
          !name.startsWith("--color-banner-") &&
          !name.startsWith("--color-note-") &&
          !name.startsWith("--color-paper"),
      );

    expect(overridden.filter((name) => !typed.has(name))).toEqual([]);
  });

  it("uses no stock Tailwind palette class", () => {
    const stock =
      /\b(?:[a-z-]+:)?(?:text|bg|border|ring|divide|placeholder|fill|stroke|outline|from|via|to)-(?:gray|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand|white|black)(?:-\d{2,3})?\b/;

    const offenders = FILES.filter((file) => stock.test(file.source)).map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it("sets no colour through an inline style", () => {
    const inlineColour = /style=\{\{[^}]*\b(?:color|backgroundColor|borderColor|fill|stroke)\b/s;

    const offenders = FILES.filter((file) => inlineColour.test(file.source))
      .map((file) => file.path)
      .filter((path) => path !== join("components", "patients", "chart", "tooth-swatch.tsx"));

    expect(offenders).toEqual([]);
  });
});
