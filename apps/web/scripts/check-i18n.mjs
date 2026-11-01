#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const SRC = join(ROOT, "src");
const UI_SRC = join(ROOT, "..", "..", "packages", "ui", "src");
const SHARED_SRC = join(ROOT, "..", "..", "packages", "shared", "src");

const LOCALE_PAIRS = [
  join(SRC, "i18n", "locales"),
  join(SRC, "booking", "locales"),
  join(SRC, "site", "locales"),
  join(SRC, "vendor", "locales"),
];

const ARABIC_LETTER = /[ؠ-ي٠-٩ٮ-ۿ]/;

const ALLOWED_CHARS = /[،؛؟۔]/g;

// The escape hatch is a trailing `// i18n-allow: reason` — per line, so exempting one honorific
const PRAGMA = /\/\/\s*i18n-allow:\s*\S/;

const failures = [];

function sources(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return sources(path);
    }

    return /\.tsx?$/.test(entry) && !/\.(test|stories)\.tsx?$/.test(entry) ? [path] : [];
  });
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replaceAll(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

const LANGUAGE_CODES = [
  ...readFileSync(join(SHARED_SRC, "locale", "languages.ts"), "utf8").matchAll(
    /code: "([a-z]{2,3})"/g,
  ),
].map((match) => match[1]);

const pluralCategories = (language) =>
  new Set(new Intl.PluralRules(language).resolvedOptions().pluralCategories);

const ARABIC_SCRIPT = new Set(["ar"]);

const SUFFIX = /_(zero|one|two|few|many|other)$/;

const baseKey = (key) => key.replace(SUFFIX, "");

function keysOf(value, prefix = "") {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function checkLiterals() {
  for (const path of [...sources(SRC), ...sources(UI_SRC)]) {
    const relativePath = relative(ROOT, path).replaceAll("\\", "/");
    const raw = readFileSync(path, "utf8").split("\n");
    const lines = withoutComments(raw.join("\n")).split("\n");

    for (const [index, line] of lines.entries()) {
      if (PRAGMA.test(raw[index] ?? "")) {
        continue;
      }

      if (ARABIC_LETTER.test(line.replaceAll(ALLOWED_CHARS, ""))) {
        failures.push(`${relativePath}:${index + 1}  Arabic text outside the locale files`);
        failures.push(`    ${line.trim().slice(0, 100)}`);
      }
    }
  }
}

function checkParity(locales) {
  const where = relative(ROOT, locales).replaceAll("\\", "/");
  const languages = readdirSync(locales)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.replace(/\.json$/, ""));

  for (const language of LANGUAGE_CODES) {
    if (!languages.includes(language)) {
      failures.push(
        `${where}/${language}.json  missing — every language in LANGUAGE_DEFINITIONS needs one`,
      );
    }
  }

  const read = (language) => JSON.parse(readFileSync(join(locales, `${language}.json`), "utf8"));
  const reference = read("ar");
  const referenceBases = new Set(keysOf(reference).map(baseKey));

  for (const language of languages) {
    const strings = read(language);
    const keys = keysOf(strings);
    const bases = new Set(keys.map(baseKey));

    if (language !== "ar") {
      for (const key of referenceBases) {
        if (!bases.has(key)) {
          failures.push(`${where}/${language}.json  missing "${key}"`);
        }
      }

      for (const key of bases) {
        if (!referenceBases.has(key)) {
          failures.push(`${where}/ar.json  missing "${key}" (present in ${language}.json)`);
        }
      }
    }

    const families = new Set(keys.filter((key) => SUFFIX.test(key)).map(baseKey));

    for (const family of families) {
      for (const category of pluralCategories(language)) {
        if (!keys.includes(`${family}_${category}`)) {
          failures.push(`${where}/${language}.json  missing "${family}_${category}"`);
        }
      }
    }

    if (ARABIC_SCRIPT.has(language)) {
      continue;
    }

    for (const key of keys) {
      const value = key.split(".").reduce((node, part) => node?.[part], strings);

      if (typeof value === "string" && ARABIC_LETTER.test(value)) {
        failures.push(`${where}/${language}.json  "${key}" is still Arabic`);
      }
    }
  }
}

const BUILT_ELSEWHERE = ["assistant.view.columns.", "assistant.view.stats.", "assistant.topics."];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function checkUsage() {
  const locales = join(SRC, "i18n", "locales");
  const where = relative(ROOT, locales).replaceAll("\\", "/");
  const en = JSON.parse(readFileSync(join(locales, "en.json"), "utf8"));
  const source = [...sources(SRC), ...sources(UI_SRC), ...sources(SHARED_SRC)]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  const built = [
    ...[...source.matchAll(/[`"']([A-Za-z][\w-]*(?:\.[\w-]+)+)\.(?:\$\{|[`"']\s*\+)/g)].map(
      (match) => ({ prefix: `${match[1]}.`, deep: true }),
    ),
    ...[...source.matchAll(/\bt\(\s*`([A-Za-z][\w-]*)\.\$\{[^}]*\}`/g)].map((match) => ({
      prefix: `${match[1]}.`,
      deep: false,
    })),
  ];

  for (const key of keysOf(en)) {
    const base = baseKey(key);

    if (new RegExp(`["'\`]${escape(base)}["'\`]`).test(source)) {
      continue;
    }
    if (BUILT_ELSEWHERE.some((prefix) => base.startsWith(prefix))) {
      continue;
    }
    if (
      built.some(
        ({ prefix, deep }) =>
          base.startsWith(prefix) && (deep || !base.slice(prefix.length).includes(".")),
      )
    ) {
      continue;
    }

    failures.push(`${where}/*.json  "${key}" is used nowhere — remove it from every locale`);
  }
}

checkLiterals();
checkUsage();
for (const locales of LOCALE_PAIRS) {
  checkParity(locales);
}

if (failures.length > 0) {
  console.error("Static text found. Every word on screen comes from the locale files.\n");
  console.error(failures.join("\n"));
  console.error(`\n${failures.length} problem(s).`);
  process.exit(1);
}

console.log(
  "i18n: no static Arabic outside the locale files, every locale agrees, and every key is used.",
);
