import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = __dirname;
const UI = join(SRC, "..", "..", "..", "packages", "ui", "src", "components");

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sources(path);
    }

    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
  });
}

// A page header that carries its own margin is counted twice wherever the page already spaces its
// sections, which is how one screen ended up 36px below its title and another 16px.
describe("page spacing", () => {
  it("leaves the header's outer spacing to the page", () => {
    const header = readFileSync(join(UI, "page-header.tsx"), "utf8");
    const outer = header.slice(0, header.indexOf("{hosted &&"));

    expect(outer).not.toMatch(/\bm[btxy]?-[\d.]+/);
  });

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
