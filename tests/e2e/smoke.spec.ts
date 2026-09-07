import { expect, test, type Page } from '@playwright/test';

// The same catalogue the visual sweep walks — one list, two consumers.
import { ROLES, SCREENS, SEED_ACCOUNTS } from '../../scripts/qa/screens.mjs';

/**
 * The smoke run.
 *
 * Three questions per screen, all of them the kind that only a real browser
 * can answer:
 *
 *   1. does it render at all, for the role that is entitled to it?
 *   2. is the document laid out in the direction the language asks for?
 *   3. does it fit the viewport, or does the page scroll sideways?
 *
 * Number 3 is the one worth having in CI. Horizontal scroll at 390px is the
 * single most common way this app breaks on a phone — one `w-` on a table, one
 * unwrapped row of chips — and it is invisible on the desktop everybody
 * develops on.
 */

interface Session {
  readonly lang: 'ar' | 'en';
  readonly dir: 'rtl' | 'ltr';
}

/** The language is stored, and read before the first paint. */
async function useLanguage(page: Page, lang: string): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('clinic.language', value);
  }, lang);
}

async function signIn(page: Page, role: keyof typeof SEED_ACCOUNTS): Promise<void> {
  const { identifier, password } = SEED_ACCOUNTS[role];

  await page.goto('/login');
  await page.locator('#identifier').fill(identifier);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
}

/** True when the document itself scrolls sideways — never correct here. */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
}

// `phone-ar` is the narrow Arabic pass; anything else runs English on desktop.
const session = (project: string): Session =>
  project === 'phone-ar' ? { lang: 'ar', dir: 'rtl' } : { lang: 'en', dir: 'ltr' };

for (const role of ROLES) {
  test.describe(`${role}`, () => {
    // Every screen this role may reach by typing its address. States behind a
    // click — drawers, modals, open menus — belong to the visual sweep; this
    // is the part that has to stay fast enough to run on every pull request.
    const reachable = SCREENS.filter(
      (screen) =>
        screen.anonymous !== true && screen.roles.includes(role) && screen.steps === undefined,
    );

    for (const screen of reachable) {
      test(`${screen.id} renders and fits`, async ({ page }, testInfo) => {
        const { lang, dir } = session(testInfo.project.name);

        await useLanguage(page, lang);
        await signIn(page, role);

        // The catalogue's two parameterised paths need a real record; the
        // first row of each list is as good as any and always seeded.
        const path = await resolvePath(page, screen.path);
        await page.goto(path);

        // Something has to have painted: every screen in this app draws either
        // a heading or a table, and an error boundary draws neither.
        await expect(page.locator('main')).toBeVisible();
        await page.waitForTimeout(1000);

        expect(await page.getAttribute('html', 'dir')).toBe(dir);
        expect(await scrollsSideways(page), `${screen.id} scrolls horizontally`).toBe(false);
      });
    }
  });
}

/**
 * `/patients/:patientId` → an address a signed-in role can actually open.
 *
 * Read out of the app rather than out of the API: the access token is held in
 * memory and never handed to a request context, so the honest way to find a
 * record is the way a user finds one — open the list and pick the first row.
 */
async function resolvePath(page: Page, path: string): Promise<string> {
  if (!path.includes(':')) {
    return path;
  }

  const listPath = path.startsWith('/patients') ? '/patients' : '/labs?tab=directory';
  await page.goto(listPath);
  await page.waitForTimeout(1500);

  const row = page.locator('tbody tr[role="button"], [data-row-card], [data-entity-card]').first();

  if ((await row.count()) === 0) {
    test.skip(true, `no seeded row behind ${path}`);
  }

  await row.click();
  await page.waitForTimeout(1000);

  const opened = new URL(page.url()).pathname;

  test.skip(opened === listPath.split('?')[0], `${listPath} did not open a record`);

  return opened;
}
