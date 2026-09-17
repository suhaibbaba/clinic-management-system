#!/usr/bin/env node
// Two files name colours: the library's defaults and this product's override. A hex anywhere else
// is a value that cannot be themed, cannot be audited, and survives a redesign by being invisible
// to it.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The token files themselves, and the places a hex is data rather than design. */
const ALLOWED = new Set([
  // The library's neutral defaults: the only colours inside the package, and none of them branded.
  "packages/ui/src/styles/base.css",
  // This product's values, in the two layers that carry them.
  "apps/web/src/theme.css",
  "apps/web/src/theme.ts",
  // A clinic picks its own colours for the painted lists, and the seed carries the defaults.
  "packages/shared/src/constants/lookups.ts",
]);

const SEARCH = [
  "apps/web/src",
  "apps/web/index.html",
  "apps/web/booking.html",
  "apps/web/public",
  "packages/ui/src",
];

const EXTENSIONS = /\.(?:tsx?|css|html|svg)$/;

// `#rrggbb`, `#rgb`, `#rrggbbaa` — plus `rgb()`/`hsl()`, the same decision spelled out.
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

async function walk(path, acc = []) {
  let entries;

  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    // A path in SEARCH may be a file rather than a directory.
    acc.push(path);
    return acc;
  }

  for (const entry of entries) {
    const child = join(path, entry.name);

    if (entry.isDirectory()) {
      await walk(child, acc);
    } else if (EXTENSIONS.test(entry.name)) {
      acc.push(child);
    }
  }

  return acc;
}

const files = [];

for (const target of SEARCH) {
  await walk(resolve(repoRoot, target), files);
}

// Three files are read before the app's CSS exists — the two entry documents' `theme-color` and
// the tab mark — so a `var()` cannot reach them. They are not exempt: the value they carry must be
// the brand blue the token file names, or this fails like any other drift.
const PINNED = new Set([
  "apps/web/index.html",
  "apps/web/booking.html",
  "apps/web/public/favicon.svg",
]);

const theme = await readFile(resolve(repoRoot, "apps/web/src/theme.css"), "utf8");
const brand = /--color-primary-600:\s*(#[0-9a-fA-F]{6})/.exec(theme)?.[1]?.toLowerCase();

if (!brand) {
  console.error("theme.css names no --color-primary-600; nothing to pin the entry documents to.");
  process.exit(1);
}

const PINNED_ALLOWED = new Set([brand, "#fff", "#ffffff"]);

const offenders = [];

for (const file of files) {
  const path = relative(repoRoot, file).split("\\").join("/");

  if (ALLOWED.has(path) || /\.test\.tsx?$/.test(path)) {
    continue;
  }

  const source = await readFile(file, "utf8");

  source.split("\n").forEach((line, index) => {
    const found = line.match(LITERAL) ?? [];
    const bad = PINNED.has(path)
      ? found.filter((value) => !PINNED_ALLOWED.has(value.toLowerCase()))
      : found;

    if (bad.length > 0) {
      offenders.push(`${path}:${index + 1}  ${line.trim().slice(0, 96)}`);
    }
  });
}

if (offenders.length > 0) {
  console.error(
    "Colours are named in packages/ui/src/styles/base.css (the library's defaults) and in a " +
      `product's theme.css/theme.ts, and nowhere else. ${offenders.length} literal(s):\n`,
  );
  console.error(offenders.join("\n"));
  process.exit(1);
}

console.log(`hex: ${files.length} files carry no colour literal outside the token files.`);
