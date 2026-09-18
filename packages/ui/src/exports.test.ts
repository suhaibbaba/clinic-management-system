import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(__dirname, "..");

const exportsMap = (): Record<string, string | null> =>
  (
    JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
      exports: Record<string, string | null>;
    }
  ).exports;

function sourceFiles(directory: string): string[] {
  return readdirSync(join(PACKAGE_ROOT, "src", directory), { withFileTypes: true }).flatMap(
    (entry) =>
      entry.isDirectory()
        ? sourceFiles(`${directory}/${entry.name}`).map((nested) => nested)
        : /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")
          ? [`${directory}/${entry.name}`]
          : [],
  );
}

const specificity = (key: string): number => key.indexOf("*");

// Node picks the pattern with the longest literal prefix, then the longest suffix; a literal key
// beats every pattern. Mirrored here so the test fails for the same reason a runtime import would.
function resolve(specifier: string, map: Record<string, string | null>): string | null {
  if (specifier in map) {
    return map[specifier] ?? null;
  }

  const patterns = Object.keys(map)
    .filter((key) => key.includes("*"))
    .sort((a, b) => specificity(b) - specificity(a) || b.length - a.length);

  for (const key of patterns) {
    const [prefix, suffix = ""] = key.split("*");

    if (specifier.startsWith(prefix!) && specifier.endsWith(suffix)) {
      const target = map[key];
      const star = specifier.slice(prefix!.length, specifier.length - suffix.length);

      return target === null || target === undefined ? null : target.replace("*", star);
    }
  }

  return null;
}

describe("the exports map and the source tree agree", () => {
  it("resolves every component and helper to a file that exists", () => {
    const map = exportsMap();

    const unreachable = [...sourceFiles("components"), ...sourceFiles("lib")].filter((file) => {
      const specifier = `./${file.replace(/\.tsx?$/, "")}`;
      const target = resolve(specifier, map);

      return target === null || !existsSync(join(PACKAGE_ROOT, target));
    });

    expect(unreachable).toEqual([]);
  });

  it("points every literal entry at a file that exists", () => {
    const map = exportsMap();

    const dangling = Object.entries(map)
      .filter(([key, target]) => !key.includes("*") && target !== null)
      .filter(([, target]) => !existsSync(join(PACKAGE_ROOT, target!)));

    expect(dangling.map(([key]) => key)).toEqual([]);
  });

  it("keeps tests out of the public surface", () => {
    const map = exportsMap();

    expect(resolve("./lib/cn.test", map)).toBeNull();
    expect(resolve("./components/icon.test", map)).toBeNull();
  });
});
