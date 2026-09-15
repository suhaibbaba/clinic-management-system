import { describe, expect, it } from 'vitest';

import { isShortMapLink, mapsUrl, parseCoordinates } from '@clinic/shared';

const NABLUS = { latitude: '32.221', longitude: '35.254444' };

describe('parseCoordinates', () => {
  it.each([
    ['a plain pair', '32.221, 35.254444'],
    ['a pair separated by a space', '32.221 35.254444'],
    ['a Google place URL', 'https://www.google.com/maps/@32.221,35.254444,17z'],
    ['a Google query URL', 'https://maps.google.com/?q=32.221,35.254444'],
    ['a Google data URL', 'https://www.google.com/maps/place/X/data=!3d32.221!4d35.254444'],
    ['an Apple Maps URL', 'https://maps.apple.com/?ll=32.221,35.254444&z=17'],
    ['an OpenStreetMap URL', 'https://www.openstreetmap.org/#map=17/32.221/35.254444'],
  ])('reads %s', (_name, input) => {
    expect(parseCoordinates(input)).toEqual(NABLUS);
  });

  // A URL carrying both a pin and a viewport centre must yield the pin.
  it('prefers the pinned place over the viewport centre', () => {
    const url = 'https://www.google.com/maps/place/X/@31.9,35.2,17z/data=!3d32.221!4d35.254444';

    expect(parseCoordinates(url)).toEqual(NABLUS);
  });

  it.each([
    ['nothing', ''],
    ['an address', 'شارع رفيديا، نابلس'],
    ['a latitude out of range', '132.221, 35.254444'],
    ['a longitude out of range', '32.221, 235.254444'],
    ['a shortened link, which hides them behind a redirect', 'https://maps.app.goo.gl/abc123'],
  ])('refuses %s', (_name, input) => {
    expect(parseCoordinates(input)).toBeNull();
  });

  it('rounds to the six decimals the column holds', () => {
    expect(parseCoordinates('32.22100049, 35.2544441234')).toEqual({
      latitude: '32.221',
      longitude: '35.254444',
    });
  });

  it('names a shortened link, so the screen can say why it cannot read it', () => {
    expect(isShortMapLink('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(isShortMapLink('https://maps.google.com/?q=32.2,35.2')).toBe(false);
  });

  it('builds a link that opens the pin', () => {
    expect(mapsUrl(NABLUS)).toBe('https://www.google.com/maps?q=32.221,35.254444');
  });
});
