import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sources(path);
    }

    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
  });
}

// The header's own margin is measured in `page-spacing.browser.test.tsx`; this is the sweep across
// every page, which needs the sources rather than a render.
describe("page spacing", () => {
  it("spaces every page's sections the same way", () => {
    const offenders = sources(join(SRC, "features"))
      .filter((path) => readFileSync(path, "utf8").includes("<PageHeader"))
      .filter((path) => {
        const lines = readFileSync(path, "utf8").split("\n");
        const at = lines.findIndex((line) => line.includes("<PageHeader"));
        const wrapper = lines
          .slice(Math.max(0, at - 5), at)
          .reverse()
          .find((line) => {
            const text = line.trim();

            return text.startsWith("<div") || text === "<>" || text.startsWith("<section");
          });

        return !wrapper?.includes("flex flex-col gap-5");
      })
      .map((path) => path.slice(SRC.length + 1));

    expect(offenders).toEqual([]);
  });
});
