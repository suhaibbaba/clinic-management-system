/**
 * Nobody knows their clinic's coordinates, but everybody can find it on a map and copy the link.
 * So the field takes what people actually have in the clipboard — a Google, Apple or OSM URL, or a
 * pair of numbers — and pulls the pin out of it.
 */
export interface Coordinates {
  readonly latitude: string;
  readonly longitude: string;
}

/** Six decimals is about 0.1 m; more is noise from a map's zoom level. */
const round = (value: number): string =>
  String(Number(value.toFixed(6)))
    // `-0` is a coordinate nobody means.
    .replace(/^-0$/, '0');

const inRange = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 90 &&
  Math.abs(longitude) <= 180;

// `@lat,lng` is Google's viewport centre and `q=`/`ll=`/`daddr=` the pinned place; OSM puts it in
// the fragment. Ordered so an explicit pin beats the viewport when a URL carries both.
const PATTERNS: readonly RegExp[] = [
  /[?&](?:q|ll|daddr|destination|sll)=(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i,
  /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
  /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
  /#map=\d+\/(-?\d{1,3}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/,
  /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
];

/**
 * A shortened link carries no coordinates at all — they are behind a redirect only the network can
 * follow — so the screen says to open it first rather than failing silently.
 */
export const isShortMapLink = (value: string): boolean =>
  /(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(value);

export function parseCoordinates(value: string): Coordinates | null {
  const text = value.trim();

  if (text === '') {
    return null;
  }

  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);

    if (!match?.[1] || !match[2]) {
      continue;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);

    if (inRange(latitude, longitude)) {
      return { latitude: round(latitude), longitude: round(longitude) };
    }
  }

  return null;
}

/** Opens the pin in whatever the reader's device treats as a map. */
export const mapsUrl = ({ latitude, longitude }: Coordinates): string =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;
