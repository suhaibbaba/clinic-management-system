#!/usr/bin/env node
// Signs in as every role and walks `scripts/qa/screens.mjs` at three viewports in both languages,
// flagging what a browser measures better than an eye: overflow, small targets, clipped text.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import {
  LANGUAGES,
  PUBLIC_SCREENS,
  ROLES,
  SEED_ACCOUNTS,
  VIEWPORTS,
  screensFor,
} from './qa/screens.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BASE_URL = process.env['QA_BASE_URL'] ?? 'http://127.0.0.1:5173';
const API_URL = process.env['QA_API_URL'] ?? 'http://127.0.0.1:3000';
const OUT_DIR = resolve(repoRoot, process.env['QA_OUT'] ?? 'qa/screens');

const pick = (name, all) => {
  const raw = process.env[name];
  if (!raw) return all;
  const wanted = raw.split(',').map((value) => value.trim());
  return all.filter((value) => wanted.includes(typeof value === 'string' ? value : value.id));
};

const langs = pick('QA_LANGS', LANGUAGES);
const viewports = pick('QA_VIEWPORTS', VIEWPORTS);
const roles = pick('QA_ROLES', [...ROLES]);
const screenFilter = process.env['QA_SCREENS'] ?? '';

const launchOptions = process.env['QA_CHROMIUM']
  ? { executablePath: process.env['QA_CHROMIUM'] }
  : {};

const dictionaries = {
  ar: JSON.parse(await readText(join(repoRoot, 'apps/web/src/i18n/locales/ar.json'))),
  en: JSON.parse(await readText(join(repoRoot, 'apps/web/src/i18n/locales/en.json'))),
  booking: JSON.parse(await readText(join(repoRoot, 'apps/web/src/booking/locales/ar.json'))),
};

async function readText(path) {
  const { readFile } = await import('node:fs/promises');
  return readFile(path, 'utf8');
}

/** `t('patients.create')` against a plain dictionary — no i18next in a script. */
function t(lang, key) {
  const value = key
    .split('.')
    .reduce(
      (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
      dictionaries[lang],
    );

  if (typeof value !== 'string') {
    throw new Error(`No ${lang} string for "${key}" — the QA catalogue is out of date`);
  }

  return value;
}

const labelPrefix = (lang, key) => t(lang, key).split('{{')[0].trim();

// Runs in the page and reports geometry, never opinions, so a finding is provably true of the
// rendered document.
const AUDIT = () => {
  const results = {
    overflow: null,
    smallTargets: [],
    clipped: [],
    physical: [],
    tightLines: [],
    baselines: [],
  };
  const root = document.documentElement;
  const viewportWidth = root.clientWidth;

  // `fontBoundingBox*` is what the loaded face declares: Plex Arabic inks about 1.23× its size
  // where Inter inks 1.18×, which is why Latin line heights clip Arabic.
  const ruler = document.createElement('canvas').getContext('2d');
  const inkHeight = (style, text) => {
    ruler.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = ruler.measureText(text);
    return metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
  };
  const ascent = (style, text) => {
    ruler.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return ruler.measureText(text).fontBoundingBoxAscent;
  };
  const lineBox = (style, text) =>
    style.lineHeight === 'normal' ? inkHeight(style, text) : parseFloat(style.lineHeight);

  if (root.scrollWidth > viewportWidth + 1) {
    // Name the widest thing sticking out, or the sweep reports "the page is
    // 40px too wide" with nowhere to go and looking for it takes an hour.
    const culprits = [];
    for (const element of document.querySelectorAll('body *')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const overhang =
        document.dir === 'rtl' ? Math.round(-rect.left) : Math.round(rect.right - viewportWidth);
      if (overhang > 1) {
        culprits.push({
          selector: describe(element),
          overhang,
        });
      }
    }
    culprits.sort((a, b) => b.overhang - a.overhang);
    results.overflow = {
      scrollWidth: root.scrollWidth,
      viewportWidth,
      culprits: culprits.slice(0, 5),
    };
  }

  const interactive = document.querySelectorAll(
    'a[href], button, [role="button"], [role="tab"], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
  );

  for (const element of interactive) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (element.closest('[hidden]') !== null) continue;
    // A visually hidden control is 1px on purpose, and reporting them buried the targets that are
    // genuinely too small.
    if (isScreenReaderOnly(element)) continue;
    // Inline links inside a paragraph are text, not targets: WCAG 2.5.8
    // exempts them, and flagging every one of them would bury the buttons.
    if (element.tagName === 'A' && getComputedStyle(element).display === 'inline') continue;

    // A hit area on a pseudo-element counts: `getBoundingClientRect` cannot see `PhoneLink`'s
    // `::after`, so it is asked for directly.
    const after = getComputedStyle(element, '::after');
    const hitHeight = Math.max(
      rect.height,
      after.content !== 'none' && after.position === 'absolute' ? parseFloat(after.height) || 0 : 0,
    );

    if (hitHeight < 44 || rect.width < 44) {
      results.smallTargets.push({
        selector: describe(element),
        width: Math.round(rect.width),
        height: Math.round(hitHeight),
        text: (element.textContent ?? '').trim().slice(0, 40),
      });
    }
  }

  for (const element of document.querySelectorAll('body *')) {
    const style = getComputedStyle(element);
    const hidden = style.overflowY === 'hidden' || style.overflow === 'hidden';
    const hasOwnText = [...element.childNodes].some(
      (node) => node.nodeType === 3 && (node.textContent ?? '').trim().length > 0,
    );
    // Text anywhere inside, because the box that clips is rarely the one holding the words — an
    // appointment block has no text node of its own.
    const holdsText = (element.textContent ?? '').trim().length > 0;

    if (
      hidden &&
      holdsText &&
      !isScreenReaderOnly(element) &&
      !isClamped(element) &&
      element.scrollHeight > element.clientHeight + 1
    ) {
      results.clipped.push({
        selector: describe(element),
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        text: (element.textContent ?? '').trim().slice(0, 40),
      });
    }

    if (
      (style.textAlign === 'left' || style.textAlign === 'right') &&
      hasOwnText &&
      element.getAttribute('dir') === null
    ) {
      results.physical.push({ selector: describe(element), textAlign: style.textAlign });
    }

    // The same mistake one step earlier: nothing clipped yet, but the glyphs already exceed their
    // line box.
    if (hasOwnText && !isScreenReaderOnly(element) && style.display !== 'none') {
      const rect = element.getBoundingClientRect();
      const text = (element.textContent ?? '').trim();

      if (rect.height > 0 && text.length > 0) {
        const ink = inkHeight(style, text);
        const line = lineBox(style, text);

        if (line + 0.5 < ink) {
          results.tightLines.push({
            selector: describe(element),
            fontSize: Math.round(parseFloat(style.fontSize) * 100) / 100,
            lineHeight: Math.round(line * 100) / 100,
            ink: Math.round(ink * 100) / 100,
            text: text.slice(0, 40),
          });
        }
      }
    }
  }

  // A label and its value on two baselines: neither check above sees it, since nothing overflows.
  // Measured between the two first baselines.
  for (const list of document.querySelectorAll('dl')) {
    for (const term of list.querySelectorAll('dt')) {
      const value = term.nextElementSibling;
      if (!value || value.tagName !== 'DD') continue;

      const firstBaseline = (element) => {
        const style = getComputedStyle(element);
        const text = (element.textContent ?? '').trim() || 'x';
        const rect = element.getBoundingClientRect();
        const halfLeading = (lineBox(style, text) - inkHeight(style, text)) / 2;
        return (
          rect.top +
          parseFloat(style.borderTopWidth) +
          parseFloat(style.paddingTop) +
          halfLeading +
          ascent(style, text)
        );
      };

      // A pair the layout has already put on two lines — a wrapped value, a
      // card narrow enough to stack — has no shared baseline to hold to.
      if (Math.abs(term.getBoundingClientRect().top - value.getBoundingClientRect().top) > 1) {
        continue;
      }

      const drift = Math.round((firstBaseline(term) - firstBaseline(value)) * 100) / 100;

      if (Math.abs(drift) > 1.5) {
        results.baselines.push({
          selector: describe(list),
          drift,
          text: `${(term.textContent ?? '').trim().slice(0, 20)} / ${(value.textContent ?? '')
            .trim()
            .slice(0, 20)}`,
        });
      }
    }
  }

  /** A clamp is deliberate clipping: two lines, then an ellipsis. */
  function isClamped(element) {
    return getComputedStyle(element).webkitLineClamp !== 'none';
  }

  /** `sr-only`: a 1px clipped box, which is the point of it. */
  function isScreenReaderOnly(element) {
    return (
      element.classList.contains('sr-only') ||
      element.closest('.sr-only') !== null ||
      getComputedStyle(element).clipPath === 'inset(50%)'
    );
  }

  function describe(element) {
    const id = element.id ? `#${element.id}` : '';
    const cls =
      typeof element.className === 'string' && element.className
        ? `.${element.className.trim().split(/\s+/).slice(0, 4).join('.')}`
        : '';
    return `${element.tagName.toLowerCase()}${id}${cls}`.slice(0, 160);
  }

  return results;
};

/** Signs in through the real form, which is also a test of the login screen. */
async function signIn(page, role, lang) {
  const { identifier, password } = SEED_ACCOUNTS[role];

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(t(lang, 'auth.identifier')).fill(identifier);
  await page.getByLabel(t(lang, 'auth.password')).fill(password);
  await page.getByRole('button', { name: t(lang, 'auth.submit') }).click();
  await page.waitForURL(/\/(dashboard|patients|appointments|labs|inventory)/, { timeout: 20_000 });
}

async function runSteps(page, steps, lang) {
  for (const step of steps ?? []) {
    if (step.wait) {
      await page.waitForTimeout(step.wait);
      continue;
    }

    if (step.fill) {
      const field = page.locator(step.fill.selector).first();

      if ((await field.count()) === 0) {
        return `step skipped: no field matched ${step.fill.selector}`;
      }

      await field.fill(step.fill.value);
      continue;
    }

    const locator = stepLocator(page, step, lang);

    if (locator) {
      if ((await locator.count()) === 0) {
        return `step skipped: nothing matched ${JSON.stringify(step)}`;
      }

      // A step that cannot be performed is a finding, not a crash: abandoning at screen 34 of 450
      // leaves the rest unlooked at.
      try {
        await locator.first().click({ timeout: 5_000 });
      } catch {
        return `step failed: could not click ${JSON.stringify(step)}`;
      }
    }
  }

  return null;
}

function stepLocator(page, step, lang) {
  if (step.click) return page.getByRole('button', { name: t(lang, step.click) });
  if (step.clickTab) return page.getByRole('tab', { name: t(lang, step.clickTab) });
  if (step.clickRadio) return page.getByRole('radio', { name: t(lang, step.clickRadio) });
  if (step.clickSubmit) return page.locator('button[type="submit"]');
  if (step.clickSelector) return page.locator(step.clickSelector);
  if (step.clickLabelPrefix) {
    const prefix = labelPrefix(step.lang ?? lang, step.clickLabelPrefix);
    return page.locator(`[aria-label^="${prefix}"]`);
  }
  if (step.firstRow) {
    // Both shapes of `Table` carry it: a row on a desktop, a card on a phone.
    return page.locator('[data-row]');
  }
  return null;
}

async function seededIds() {
  const login = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(SEED_ACCOUNTS.admin),
  });

  if (!login.ok) {
    throw new Error(`Cannot sign in to ${API_URL} — is the API running and seeded?`);
  }

  const { accessToken } = await login.json();
  const get = async (path) => {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return response.ok ? response.json() : { items: [] };
  };

  const patients = await get('/patients?page=1&limit=100');
  const labs = await get('/labs?page=1&limit=1');
  const doctors = await get('/doctors?page=1&limit=1');
  const longest = [...patients.items].sort((a, b) => b.fullName.length - a.fullName.length)[0];
  // File 00001 is the seed's fullest record; whichever patient was created last is eight empty
  // states.
  const richest = patients.items.find((patient) => patient.fileNumber === '00001');

  return {
    patientId: richest?.id ?? patients.items[0]?.id ?? '',
    // The truncation cases live or die on one very long name, which the
    // development seed carries on purpose.
    longNamePatientId: longest?.id ?? patients.items[0]?.id ?? '',
    labId: labs.items[0]?.id ?? '',
    // Nothing filled `:doctorId`, so those screens resolved to the list and were swept under their
    // own names.
    doctorId: doctors.items[0]?.id ?? '',
  };
}

const fill = (path, ids) => path.replace(/:(\w+)/g, (_, name) => ids[name] ?? '');

// Its own context: the session is an httpOnly cookie, so "signed out" means a context without it,
// not a page that has not asked.
async function captureAnonymous(browser, screen, { lang, viewport, ids, out }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: lang === 'ar' ? 'ar-SY' : 'en-GB',
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });

  await context.addInitScript(
    (value) => window.localStorage.setItem('clinic.language', value),
    lang,
  );

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
  });

  const dir = join(out, lang, viewport.id, 'anonymous');
  await mkdir(dir, { recursive: true });

  await page.goto(`${BASE_URL}${fill(screen.path, ids)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const note = await runSteps(page, screen.steps, lang);
  await page.waitForTimeout(300);

  const audit = await page.evaluate(AUDIT);
  const file = join(dir, `${screen.id}.png`);
  await page.screenshot({ path: file, fullPage: true });

  await context.close();

  return {
    screen: screen.id,
    lang,
    viewport: viewport.id,
    role: 'anonymous',
    file: file.replace(`${repoRoot}/`, ''),
    note,
    consoleErrors: [...new Set(consoleErrors)],
    ...audit,
  };
}

async function main() {
  const ids = await seededIds();

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch(launchOptions);
  const findings = [];
  let shots = 0;

  for (const lang of langs) {
    for (const viewport of viewports) {
      for (const role of roles) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: lang === 'ar' ? 'ar-SY' : 'en-GB',
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        });

        // The app reads its language from storage before the first paint, so
        // the choice has to be there before the document is.
        await context.addInitScript(
          (value) => window.localStorage.setItem('clinic.language', value),
          lang,
        );

        const page = await context.newPage();
        const consoleErrors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
        });

        await signIn(page, role, lang);

        for (const screen of screensFor(role, viewport.id)) {
          if (screenFilter && !screen.id.includes(screenFilter)) continue;

          // `/login` answers a signed-in visitor with a redirect, so the login screen was filed
          // under its own name with a picture of the dashboard.
          if (screen.anonymous === true) {
            if (role !== roles[0]) continue;

            findings.push(
              await captureAnonymous(browser, screen, { lang, viewport, ids, out: OUT_DIR }),
            );
            shots += 1;
            process.stdout.write(`${lang}/${viewport.id}/anonymous/${screen.id}\n`);
            continue;
          }

          const name = `${screen.id}`;
          const dir = join(OUT_DIR, lang, viewport.id, role);
          await mkdir(dir, { recursive: true });

          consoleErrors.length = 0;
          await page.goto(`${BASE_URL}${fill(screen.path, ids)}`, {
            waitUntil: 'domcontentloaded',
          });
          // A fixed pause beats networkidle here: the app polls nothing and never idles twice the
          // same way.
          await page.waitForTimeout(1200);
          const note = await runSteps(page, screen.steps, lang);
          await page.waitForTimeout(300);

          const audit = await page.evaluate(AUDIT);
          const file = join(dir, `${name}.png`);
          await page.screenshot({ path: file, fullPage: true });
          shots += 1;

          findings.push({
            screen: screen.id,
            lang,
            viewport: viewport.id,
            role,
            file: file.replace(`${repoRoot}/`, ''),
            note,
            consoleErrors: [...new Set(consoleErrors)],
            ...audit,
          });

          process.stdout.write(
            `${lang}/${viewport.id}/${role}/${name}${audit.overflow ? '  ⟵ overflows' : ''}\n`,
          );
        }

        // The public booking page is Arabic-only by design, so it is swept once rather than per
        // role or language.
        if (role === roles[0] && lang === 'ar') {
          const dir = join(OUT_DIR, lang, viewport.id, 'public');
          await mkdir(dir, { recursive: true });

          for (const screen of PUBLIC_SCREENS) {
            if (screenFilter && !screen.id.includes(screenFilter)) continue;

            const anonymous = await context.newPage();
            await anonymous.goto(`${BASE_URL}${screen.path}`, { waitUntil: 'domcontentloaded' });
            await anonymous.waitForTimeout(1500);
            const note = await runSteps(anonymous, screen.steps, 'booking');
            await anonymous.waitForTimeout(400);

            const audit = await anonymous.evaluate(AUDIT);
            const file = join(dir, `${screen.id}.png`);
            await anonymous.screenshot({ path: file, fullPage: true });
            shots += 1;

            findings.push({
              screen: screen.id,
              lang,
              viewport: viewport.id,
              role: 'public',
              file: file.replace(`${repoRoot}/`, ''),
              note,
              consoleErrors: [],
              ...audit,
            });

            process.stdout.write(`${lang}/${viewport.id}/public/${screen.id}\n`);
            await anonymous.close();
          }
        }

        await context.close();
      }
    }
  }

  await browser.close();

  await writeFile(join(OUT_DIR, 'report.json'), `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
  await writeFile(join(OUT_DIR, 'report.md'), summarise(findings, shots), 'utf8');

  const overflowing = findings.filter((finding) => finding.overflow);
  process.stdout.write(
    `\n${shots} screenshots → ${OUT_DIR}\n` +
      `${overflowing.length} screens scroll horizontally, ` +
      `${findings.filter((f) => f.smallTargets.length).length} carry a target under 44px, ` +
      `${findings.filter((f) => f.clipped.length).length} clip their own text, ` +
      `${findings.filter((f) => f.tightLines.length).length} set text on a line too short for ` +
      `it, ${findings.filter((f) => f.baselines.length).length} put a label off its value's ` +
      `baseline.\n` +
      `Report: ${join(OUT_DIR, 'report.md')}\n`,
  );
}

function summarise(findings, shots) {
  const lines = [
    '# Visual QA sweep',
    '',
    `${shots} screenshots — ${langs.map((l) => l).join(', ')} × ` +
      `${viewports.map((v) => v.id).join(', ')} × ${roles.join(', ')}.`,
    '',
    '## Horizontal overflow',
    '',
  ];

  const overflow = findings.filter((finding) => finding.overflow);
  lines.push(
    overflow.length === 0
      ? 'None.'
      : [
          '| screen | lang | viewport | role | overhang | widest culprit |',
          '| --- | --- | --- | --- | --- | --- |',
        ]
          .concat(
            overflow.map(
              (f) =>
                `| ${f.screen} | ${f.lang} | ${f.viewport} | ${f.role} | ` +
                `${f.overflow.scrollWidth - f.overflow.viewportWidth}px | ` +
                `${f.overflow.culprits[0]?.selector ?? '—'} |`,
            ),
          )
          .join('\n'),
  );

  lines.push('', '## Tap targets under 44px', '');
  const targets = new Map();
  for (const finding of findings) {
    for (const target of finding.smallTargets) {
      const key = `${target.selector}|${target.width}x${target.height}`;
      const seen = targets.get(key) ?? { ...target, screens: new Set() };
      seen.screens.add(`${finding.screen}@${finding.viewport}`);
      targets.set(key, seen);
    }
  }
  lines.push(
    targets.size === 0
      ? 'None.'
      : ['| element | size | seen on |', '| --- | --- | --- |']
          .concat(
            [...targets.values()]
              .sort((a, b) => a.height * a.width - b.height * b.width)
              .slice(0, 40)
              .map(
                (target) =>
                  `| \`${target.selector}\` | ${target.width}×${target.height} | ` +
                  `${[...target.screens].slice(0, 4).join(', ')} |`,
              ),
          )
          .join('\n'),
  );

  lines.push('', '## Text clipped by its own box', '');
  const clipped = findings.filter((finding) => finding.clipped.length > 0);
  lines.push(
    clipped.length === 0
      ? 'None.'
      : [
          '| screen | lang | viewport | element | box | content |',
          '| --- | --- | --- | --- | --- | --- |',
        ]
          .concat(
            clipped.flatMap((finding) =>
              finding.clipped
                .slice(0, 3)
                .map(
                  (entry) =>
                    `| ${finding.screen} | ${finding.lang} | ${finding.viewport} | ` +
                    `\`${entry.selector}\` | ${entry.clientHeight}px vs ${entry.scrollHeight}px | ` +
                    `${entry.text.replace(/\|/g, '\\|')} |`,
                ),
            ),
          )
          .join('\n'),
  );

  lines.push('', '## Line boxes smaller than the text in them', '');
  const tight = new Map();
  for (const finding of findings) {
    for (const entry of finding.tightLines ?? []) {
      const key = `${entry.selector}|${entry.fontSize}|${entry.lineHeight}`;
      const seen = tight.get(key) ?? { ...entry, screens: new Set() };
      seen.screens.add(`${finding.screen}@${finding.lang}/${finding.viewport}`);
      tight.set(key, seen);
    }
  }
  lines.push(
    tight.size === 0
      ? 'None.'
      : ['| element | size | line | ink | seen on |', '| --- | --- | --- | --- | --- |']
          .concat(
            [...tight.values()]
              .sort((a, b) => b.ink - b.lineHeight - (a.ink - a.lineHeight))
              .slice(0, 40)
              .map(
                (entry) =>
                  `| \`${entry.selector}\` | ${entry.fontSize}px | ${entry.lineHeight}px | ` +
                  `${entry.ink}px | ${[...entry.screens].slice(0, 4).join(', ')} |`,
              ),
          )
          .join('\n'),
  );

  lines.push('', '## Labels off the baseline of their value', '');
  const drifted = new Map();
  for (const finding of findings) {
    for (const entry of finding.baselines ?? []) {
      const key = `${entry.selector}|${entry.drift}`;
      const seen = drifted.get(key) ?? { ...entry, screens: new Set() };
      seen.screens.add(`${finding.screen}@${finding.lang}/${finding.viewport}`);
      drifted.set(key, seen);
    }
  }
  lines.push(
    drifted.size === 0
      ? 'None.'
      : ['| element | drift | seen on |', '| --- | --- | --- |']
          .concat(
            [...drifted.values()]
              .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
              .slice(0, 40)
              .map(
                (entry) =>
                  `| \`${entry.selector}\` | ${entry.drift}px | ` +
                  `${[...entry.screens].slice(0, 4).join(', ')} |`,
              ),
          )
          .join('\n'),
  );

  lines.push('', '## Console errors', '');
  const noisy = findings.filter((finding) => finding.consoleErrors.length > 0);
  lines.push(
    noisy.length === 0
      ? 'None.'
      : noisy
          .map(
            (finding) =>
              `- ${finding.screen} (${finding.lang}/${finding.viewport}/${finding.role}): ${finding.consoleErrors[0]}`,
          )
          .join('\n'),
  );

  lines.push('', '## Steps that found nothing to click', '');
  const skipped = findings.filter((finding) => finding.note);
  lines.push(
    skipped.length === 0
      ? 'None.'
      : skipped
          .map(
            (finding) =>
              `- ${finding.screen} (${finding.lang}/${finding.viewport}/${finding.role}): ${finding.note}`,
          )
          .join('\n'),
  );

  return `${lines.join('\n')}\n`;
}

await main();
