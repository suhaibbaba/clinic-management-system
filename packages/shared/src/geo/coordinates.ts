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

const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';

const PATTERNS: readonly RegExp[] = [
  new RegExp(`[?&](?:q|ll|daddr|destination|sll)=${NUMBER}\\s*,\\s*${NUMBER}`, 'i'),
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
  new RegExp(`/maps/(?:search|dir|place)/${NUMBER}\\s*,\\s*\\+?\\s*${NUMBER}`),
  new RegExp(`@${NUMBER},${NUMBER}`),
  new RegExp(`#map=\\d+/${NUMBER}/${NUMBER}`),
  new RegExp(`^\\s*${NUMBER}\\s*[,\\s]\\s*${NUMBER}\\s*$`),
];

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
