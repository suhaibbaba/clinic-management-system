import { expect, test, type Page } from '@playwright/test';

import { SEED_ACCOUNTS } from '../../scripts/qa/screens.mjs';

// jsdom has no layout, so the claim that an image cannot move the page under it can only be
// settled by a browser that lays one out. Every image here is served slowly on purpose: an image
// that has already arrived shifts nothing whatever the markup says.

/** Google's "good" threshold. A page that reserves its boxes scores 0. */
const CLS_BUDGET = 0.1;

async function watchLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        // A shift the user caused by typing or clicking is not the page moving under them.
        if (!entry.hadRecentInput) {
          (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

const cls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __cls: number }).__cls);

// So the figure is attributable to the images and not to everything else the session did on the
// way here — a list arriving, a tab swapping — which is a different bug with a different fix.
const resetShift = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as { __cls: number }).__cls = 0;
  });

async function signIn(page: Page, role: keyof typeof SEED_ACCOUNTS): Promise<void> {
  const { identifier, password } = SEED_ACCOUNTS[role];

  await page.goto('/login');
  await page.locator('#identifier').fill(identifier);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
}

// The grid needs a patient who actually has images. A freshly seeded database has none — nothing
// uploads bytes to object storage during a seed — so this skips rather than pretending to pass.
async function openImaging(page: Page): Promise<void> {
  await page.goto('/patients');
  await page.waitForTimeout(1500);

  const row = page.locator('[data-row]').first();
  test.skip((await row.count()) === 0, 'no seeded patient');

  // The row's own action where it has one, the row itself where it does not — the two shapes this
  // table renders. Never any control: the phone number in the row is a `tel:` link.
  const opener = row.locator('button').first();

  await ((await opener.count()) > 0 ? opener : row).click();
  await page.waitForTimeout(1500);

  const { pathname } = new URL(page.url());
  test.skip(pathname === '/patients', 'the list did not open a file');

  await page.goto(`${pathname}?tab=attachments`);
  await page.waitForTimeout(1200);

  test.skip(
    (await page.locator('main [data-img-box]').count()) === 0,
    'no attachments on this patient',
  );
}

/** The rendered size of every reserved image box under `scope`, in document order. */
const boxes = (page: Page, scope = ''): Promise<{ width: number; height: number }[]> =>
  page.evaluate(
    (selector: string) =>
      [...document.querySelectorAll(`${selector}[data-img-box]`)].map((element) => {
        const { width, height } = element.getBoundingClientRect();

        return { width: Math.round(width), height: Math.round(height) };
      }),
    scope,
  );

test.describe('images do not move the page', () => {
  test('the sign-in screen holds its shape while the logo loads', async ({ page }) => {
    await watchLayoutShift(page);
    await page.goto('/login');

    const before = await boxes(page);
    await page.waitForTimeout(2500);

    expect(await boxes(page)).toEqual(before);
    expect(await cls(page)).toBeLessThan(CLS_BUDGET);
  });

  test('the rail holds its shape while the logo loads', async ({ page }) => {
    await watchLayoutShift(page);
    await signIn(page, 'admin');
    await page.waitForTimeout(2500);

    expect(await cls(page)).toBeLessThan(CLS_BUDGET);
  });

  test('a grid of X-rays reserves every tile before any of them arrives', async ({ page }) => {
    await watchLayoutShift(page);
    await signIn(page, 'doctor');

    await openImaging(page);

    // Scoped to the page, not the chrome: the rail's logo is a fixed box, not a ratio one.
    const reserved = await boxes(page, 'main ');
    expect(reserved.length).toBeGreaterThan(1);
    for (const tile of reserved) {
      expect(Math.abs(tile.width - tile.height)).toBeLessThanOrEqual(1);
    }

    await resetShift(page);
    await page.waitForTimeout(3000);

    expect(await boxes(page, 'main ')).toEqual(reserved);
    expect(await cls(page)).toBeLessThan(CLS_BUDGET);
  });

  // A ratio box takes its width from the column and derives its height, so the tiles have to stay
  // square through a resize rather than only at the width they were first drawn at.
  test('a ratio tile keeps its shape as its column resizes', async ({ page }) => {
    await signIn(page, 'doctor');

    await openImaging(page);

    const widths: number[] = [];

    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);

      const [tile] = await boxes(page, 'main ');
      expect(tile).toBeDefined();
      expect(Math.abs(tile!.width - tile!.height)).toBeLessThanOrEqual(1);
      widths.push(tile!.width);
    }

    // And it really did resize, or the assertion above proves nothing.
    expect(new Set(widths).size).toBeGreaterThan(1);
  });
});
