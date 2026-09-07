import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BRAND_MARK, MARK_VIEWBOX } from '@api/billing/pdf/brand-mark';

/**
 * The brand mark exists twice: as artwork the web app imports, and as path
 * geometry pdf-lib can draw onto a receipt. That is a deliberate copy — the
 * API cannot import from `apps/web`, and pdf-lib draws paths rather than SVG
 * documents — so this is the thing that stops the two drifting apart.
 *
 * When it fails, the logo has been replaced and the printed letterhead is
 * still showing the old one. Copy the new `d` and fill values into
 * `brand-mark.ts`; if the new artwork is not built from plain paths, drop the
 * paths it cannot express and let the text letterhead stand on its own.
 */
const LOGO = join(__dirname, '../../web/src/assets/logo.svg');

/** Percentage channels, which is how a converted SVG writes its colours. */
const percentToRgb = (channels: readonly string[]): readonly number[] =>
  channels.map((channel) => Math.round(Number(channel) * 100) / 10_000);

const round = (channels: readonly number[]): readonly number[] =>
  channels.map((channel) => Math.round(channel * 10_000) / 10_000);

describe('brand mark', () => {
  const svg = readFileSync(LOGO, 'utf8');

  /*
   * The glyph outlines the wordmark is set from live in `<defs>` and are
   * copied nowhere: the letterhead prints the clinic's own name under the
   * mark, in its own script. What is compared is the emblem — every path the
   * artwork draws itself.
   */
  const emblem = [...svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').matchAll(/<path\b([^>]*)\/>/g)].map(
    (match) => match[1] ?? '',
  );

  const attribute = (element: string, name: string): string | undefined =>
    new RegExp(`\\s${name}="([^"]+)"`).exec(element)?.[1];

  const normalise = (path: string): string => path.trim().replace(/\s+/g, ' ');

  it('draws the same paths as the logo the web app ships', () => {
    const drawn = emblem.map((element) => normalise(attribute(element, 'd') ?? ''));

    expect(drawn).toHaveLength(BRAND_MARK.length);
    expect(BRAND_MARK.map((path) => normalise(path.d))).toEqual(drawn);
  });

  it('uses the logo’s own colours, not an approximation of them', () => {
    const colours = emblem.map((element) =>
      percentToRgb(
        [...(attribute(element, 'fill') ?? '').matchAll(/([\d.]+)%/g)].map(
          (match) => match[1] ?? '',
        ),
      ),
    );

    const used = BRAND_MARK.map((path) => round(path.fill ?? path.stroke ?? []));

    expect(used).toEqual(colours);
  });

  it('is drawn in the logo’s own coordinate space', () => {
    // The paths keep the artwork's coordinates and `mark` translates by this
    // box, so a box read wrong prints the emblem off the edge of the sheet
    // rather than failing.
    const numbers = emblem.flatMap((element) =>
      [...(attribute(element, 'd') ?? '').matchAll(/-?\d+(?:\.\d+)?/g)].map((match) =>
        Number(match[0]),
      ),
    );
    const xs = numbers.filter((_, index) => index % 2 === 0);
    const ys = numbers.filter((_, index) => index % 2 === 1);

    expect(MARK_VIEWBOX.x).toBeCloseTo(Math.min(...xs), 3);
    expect(MARK_VIEWBOX.y).toBeCloseTo(Math.min(...ys), 3);
    expect(MARK_VIEWBOX.width).toBeCloseTo(Math.max(...xs) - Math.min(...xs), 3);
    expect(MARK_VIEWBOX.height).toBeCloseTo(Math.max(...ys) - Math.min(...ys), 3);
  });
});
