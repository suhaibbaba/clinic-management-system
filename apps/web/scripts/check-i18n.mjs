#!/usr/bin/env node
// Fails the build on Arabic in `src` (comments stripped first) and on a key present in one locale
// file and not the other. Plurals compare by base key, each side against its own CLDR categories.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = join(ROOT, 'src');

const LOCALE_PAIRS = [join(SRC, 'i18n', 'locales'), join(SRC, 'booking', 'locales')];

/** Arabic letters. Not the punctuation — see `ALLOWED_CHARS`. */
const ARABIC_LETTER = /[ؠ-ي٠-٩ٮ-ۿ]/;

// Typography rather than text: a comma between names is the same character whatever the sentence,
// and no key would ever translate differently.
const ALLOWED_CHARS = /[،؛؟۔]/g;

// The escape hatch is a trailing `// i18n-allow: reason` — per line, so exempting one honorific
// does not exempt the file.
const PRAGMA = /\/\/\s*i18n-allow:\s*\S/;

const failures = [];

function sources(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return sources(path);
    }

    // Tests and stories carry Arabic *data*, which is the point of them.
    return /\.tsx?$/.test(entry) && !/\.(test|stories)\.tsx?$/.test(entry) ? [path] : [];
  });
}

// Crude on purpose: a `//` inside a string blanks the rest of that line, which hides a violation
// rather than inventing one.
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replaceAll(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

// From `Intl.PluralRules`, so the list cannot drift from what i18next selects at runtime — it reads
// the same data.
const PLURAL_CATEGORIES = Object.fromEntries(
  ['ar', 'en'].map((language) => [
    language,
    new Set(new Intl.PluralRules(language).resolvedOptions().pluralCategories),
  ]),
);

const SUFFIX = /_(zero|one|two|few|many|other)$/;

const baseKey = (key) => key.replace(SUFFIX, '');

function keysOf(value, prefix = '') {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

function checkLiterals() {
  for (const path of sources(SRC)) {
    const relativePath = relative(ROOT, path).replaceAll('\\', '/');
    const raw = readFileSync(path, 'utf8').split('\n');
    const lines = withoutComments(raw.join('\n')).split('\n');

    for (const [index, line] of lines.entries()) {
      if (PRAGMA.test(raw[index] ?? '')) {
        continue;
      }

      if (ARABIC_LETTER.test(line.replaceAll(ALLOWED_CHARS, ''))) {
        failures.push(`${relativePath}:${index + 1}  Arabic text outside the locale files`);
        failures.push(`    ${line.trim().slice(0, 100)}`);
      }
    }
  }
}

function checkParity(locales) {
  const where = relative(ROOT, locales).replaceAll('\\', '/');

  if (!existsSync(join(locales, 'en.json'))) {
    return;
  }

  const ar = JSON.parse(readFileSync(join(locales, 'ar.json'), 'utf8'));
  const en = JSON.parse(readFileSync(join(locales, 'en.json'), 'utf8'));

  const arKeys = keysOf(ar);
  const enKeys = keysOf(en);

  const arBases = new Set(arKeys.map(baseKey));
  const enBases = new Set(enKeys.map(baseKey));

  for (const key of arBases) {
    if (!enBases.has(key)) {
      failures.push(`${where}/en.json  missing "${key}" — it would fall back to Arabic`);
    }
  }

  for (const key of enBases) {
    if (!arBases.has(key)) {
      failures.push(`${where}/ar.json  missing "${key}"`);
    }
  }

  for (const [language, keys] of [
    ['ar', arKeys],
    ['en', enKeys],
  ]) {
    const families = new Set(keys.filter((key) => SUFFIX.test(key)).map(baseKey));

    for (const family of families) {
      for (const category of PLURAL_CATEGORIES[language]) {
        if (!keys.includes(`${family}_${category}`)) {
          failures.push(`${where}/${language}.json  missing "${family}_${category}"`);
        }
      }
    }
  }

  // An English value still in Arabic is a key somebody added to both files and
  // translated in neither, which the parity check alone cannot see.
  const untranslated = keysOf(en).filter((key) => {
    const value = key.split('.').reduce((node, part) => node?.[part], en);

    return typeof value === 'string' && ARABIC_LETTER.test(value);
  });

  for (const key of untranslated) {
    failures.push(`${where}/en.json  "${key}" is still Arabic`);
  }
}

checkLiterals();
for (const locales of LOCALE_PAIRS) {
  checkParity(locales);
}

if (failures.length > 0) {
  console.error('Static text found. Every word on screen comes from the locale files.\n');
  console.error(failures.join('\n'));
  console.error(`\n${failures.length} problem(s).`);
  process.exit(1);
}

console.log('i18n: no static Arabic outside the locale files, and both locales agree.');
