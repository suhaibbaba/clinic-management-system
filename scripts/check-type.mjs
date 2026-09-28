#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWED = new Set(["packages/ui/src/styles/base.css", "apps/web/src/index.css"]);

const SEARCH = ["apps/web/src", "packages/ui/src", "packages/shared/src"];

const EXTENSIONS = /\.(?:tsx?|css)$/;

const SIZE_NAMES = "micro|meta|label|value|section|heading|title|field|kpi";

const RULES = [
  {
    pattern: /\btext-\[[^\]]*\]/g,
    say: "an arbitrary font size",
  },
  {
    pattern:
      /\bleading-(?!(?:$|["'\s}])|(?:micro|meta|label|value|section|heading|title|field|kpi)\b)[a-z0-9[\]().-]+/g,
    say: "a line height off the scale",
  },
  {
    pattern: /(?:^|[^-\w])(?:font-size|fontSize|line-height|lineHeight)\s*[:=]\s*(?!var\()/g,
    say: "a hardcoded font-size or line-height",
  },
  {
    pattern: new RegExp(`\\btext-(?:nav|display)\\b|--text-(?:nav|display)\\b`, "g"),
    say: "a retired type token",
  },
];

async function walk(path, acc = []) {
  let entries;

  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
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

const offenders = [];

for (const file of files) {
  const path = relative(repoRoot, file).split("\\").join("/");

  if (ALLOWED.has(path) || /\.test\.tsx?$/.test(path)) {
    continue;
  }

  const source = await readFile(file, "utf8");

  source.split("\n").forEach((line, index) => {
    if (/check-type-disable-next-line/.test(source.split("\n")[index - 1] ?? "")) {
      return;
    }

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;

      if (rule.pattern.test(line)) {
        offenders.push(`${path}:${index + 1}  ${rule.say}\n    ${line.trim().slice(0, 100)}`);
      }
    }
  });
}

if (offenders.length > 0) {
  console.error(
    "Type sizes are named in packages/ui/src/styles/base.css and nowhere else: use `text-" +
      `{${SIZE_NAMES}}\`, and \`leading-{…}\` where a line height is set on its own. ` +
      `${offenders.length} value(s):\n`,
  );
  console.error(offenders.join("\n"));
  process.exit(1);
}

console.log(`type: ${files.length} files carry no font size outside the token file.`);
