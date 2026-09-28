#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1 ? fallback : Number(process.argv[index + 1]);
};

const LIMIT_KB = arg("limit", 100);
const TARGET_KB = arg("target", 80);

const kb = (bytes) => bytes / 1024;

async function main() {
  let html;

  try {
    html = await readFile(join(dist, "booking.html"), "utf8");
  } catch {
    console.error(
      "booking.html is missing from dist/. Run `pnpm --filter @clinic/web build` first.",
    );
    process.exit(1);
  }

  const references = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(([, path]) => path);

  if (references.length === 0) {
    console.error("No JavaScript found in booking.html — the entry may have been renamed.");
    process.exit(1);
  }

  let total = 0;
  const rows = [];

  for (const reference of [...new Set(references)]) {
    const file = join(dist, reference.replace(/^\//, ""));
    const gzipped = gzipSync(readFileSync(file)).length;

    total += gzipped;
    rows.push([reference, gzipped]);
  }

  for (const [reference, gzipped] of rows.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kb(gzipped).toFixed(1).padStart(7)} KB gz  ${reference}`);
  }

  console.log(`  ${"─".repeat(7)}`);
  console.log(
    `  ${kb(total).toFixed(1).padStart(7)} KB gz  total (target ${TARGET_KB}, limit ${LIMIT_KB})`,
  );

  if (kb(total) > LIMIT_KB) {
    console.error(
      `\nThe booking bundle is ${kb(total).toFixed(1)} KB gzipped, over the ${LIMIT_KB} KB limit.\n` +
        "Something heavy reached the public page — check the newest import under src/booking.",
    );
    process.exit(1);
  }

  if (kb(total) > TARGET_KB) {
    console.warn(
      `\nOver the ${TARGET_KB} KB target (still under the ${LIMIT_KB} KB limit). Worth a look before it becomes a habit.`,
    );
  }
}

await main();
