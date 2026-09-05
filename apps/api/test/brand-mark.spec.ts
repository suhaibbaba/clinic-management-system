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
 * still showing the old one. Copy the new `d`, fill and stroke values into
 * `brand-mark.ts`; if the new artwork is not built from plain paths, drop the
 * paths it cannot express and let the text letterhead stand on its own.
 */
const LOGO = join(__dirname, '../../web/src/assets/logo.svg');

const hexToRgb = (hex: string): [number, number, number] => {
  const value = parseInt(hex.replace('#', ''), 16);

  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
};

const round = (channels: readonly number[]): readonly number[] =>
  channels.map((channel) => Math.round(channel * 1000) / 1000);

describe('brand mark', () => {
  const svg = readFileSync(LOGO, 'utf8');

  it('draws the same paths as the logo the web app ships', () => {
    const drawn = [...svg.matchAll(/\sd="([^"]+)"/g)].map((match) =>
      match[1]?.replace(/\s+/g, ' '),
    );

    expect(drawn).toHaveLength(BRAND_MARK.length);
    expect(BRAND_MARK.map((path) => path.d.replace(/\s+/g, ' '))).toEqual(drawn);
  });

  it('uses the logo’s own colours, not an approximation of them', () => {
    const colours = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map((match) =>
      round(hexToRgb(match[1] ?? '')),
    );

    const used = BRAND_MARK.flatMap((path) =>
      [path.fill, path.stroke]
        .filter((channels): channels is readonly [number, number, number] => channels !== undefined)
        .map(round),
    );

    expect(used).toEqual(colours);
  });

  it('is drawn in the logo’s own coordinate space', () => {
    // Scaling is `size / viewBox`, so a viewBox read wrong would silently
    // print the mark at the wrong size rather than fail.
    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);

    expect(viewBox?.[1]).toBe(String(MARK_VIEWBOX));
    expect(viewBox?.[2]).toBe(String(MARK_VIEWBOX));
  });
});
