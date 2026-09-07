#!/usr/bin/env node
/**
 * Zero static text, as a build step.
 *
 * The rule in CLAUDE.md is that no Arabic string is ever written in a
 * component: every word on screen comes from the locale files, so the language
 * toggle flips *everything* and a translator has one place to work. That rule
 * held for about as long as anyone was watching it. This is what watches it.
 *
 * Two checks, both of which fail the build:
 *
 *  1. **No Arabic in the source.** Every `.ts` and `.tsx` file under `src`,
 *     with comments stripped first — a note explaining that `الأحد` is a
 *     weekday is documentation, and rewriting it in Latin would make it worse.
 *  2. **Every locale pair agrees.** A key added to `ar.json` and forgotten in
 *     `en.json` is text that silently falls back to Arabic in an English
 *     interface, which is the same failure arriving through the other door.
 *     An English value that is *still Arabic* is caught too: that is a key
 *     somebody copied into both files and translated in neither.
 *
 * Both the app and the public booking page are checked for Arabic in their
 * source; they have separate bundles and separate locale files, and the
 * booking page is the one a patient sees. Only the app is checked for parity —
 * the booking page ships Arabic alone on purpose (it is opened from a WhatsApp
 * link by an Arabic-speaking patient and has no language switcher), so a
 * locale directory with no `en.json` is skipped rather than failed.
 *
 * **Tests and stories are excluded, deliberately.** The Arabic in them is
 * data, not interface: a patient called أحمد خالد, an item called قفازات
 * نيتريل. Latinising those would make the fixtures less like the records this
 * system actually holds, and it is the components those tests render that this
 * guard is protecting. Where a test does assert on interface text, it reads
 * the key out of `ar.json` — which is the same thing this check is for.
 *
 * Usage: node scripts/check-i18n.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = join(ROOT, 'src');

/** Every locale pair in the app: the interface, and the public booking page. */
const LOCALE_PAIRS = [join(SRC, 'i18n', 'locales'), join(SRC, 'booking', 'locales')];

/** Arabic letters. Not the punctuation — see `ALLOWED_CHARS`. */
const ARABIC_LETTER = /[ؠ-ي٠-٩ٮ-ۿ]/;

/**
 * Arabic punctuation that is typography rather than text.
 *
 * A comma between two names and an ellipsis on a truncated line are the same
 * character whatever the sentence around them says; routing them through i18n
 * would add a key nobody would ever translate differently.
 */
const ALLOWED_CHARS = /[،؛؟۔]/g;

/**
 * The escape hatch, per line rather than per file: a trailing
 *
 *   // i18n-allow: why this line is Arabic and cannot be a key
 *
 * The reason is required, and it sits on the line a reviewer is reading rather
 * than in a list at the top of this script that nobody opens. Per line and not
 * per file, so exempting the honorific a name is stripped of does not quietly
 * exempt every label added to that file afterwards.
 */
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

/**
 * Comments blanked, line numbering intact.
 *
 * Crude on purpose — this does not need to parse TypeScript, only to stop a
 * docstring that says what `غداً` means from reading as interface text. A `//`
 * inside a string literal blanks the rest of that line, which at worst hides a
 * violation rather than inventing one.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replaceAll(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

/** Every leaf key, dotted — `clinic.logo`, `lookups.lists.tooth_state`. */
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

  const arKeys = new Set(keysOf(ar));
  const enKeys = new Set(keysOf(en));

  for (const key of arKeys) {
    if (!enKeys.has(key)) {
      failures.push(`${where}/en.json  missing "${key}" — it would fall back to Arabic`);
    }
  }

  for (const key of enKeys) {
    if (!arKeys.has(key)) {
      failures.push(`${where}/ar.json  missing "${key}"`);
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
