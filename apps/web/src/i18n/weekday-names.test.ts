import { describe, expect, it } from 'vitest';

import ar from '@web/i18n/locales/ar.json';
import en from '@web/i18n/locales/en.json';

// Arabic has no three-letter abbreviation — CLDR's `short` weekday is its `long` one — so a day is
// shortened by dropping the article, never by cutting the word. `اثن` and `ثلا` are not words.
const WEEKDAYS = [
  ['sun', '0'],
  ['mon', '1'],
  ['tue', '2'],
  ['wed', '3'],
  ['thu', '4'],
  ['fri', '5'],
  ['sat', '6'],
] as const;

const DEFINITE_ARTICLE = 'ال';

describe('weekday names', () => {
  it.each(WEEKDAYS)(
    'the Arabic short form of %s is the full name without its article',
    (key, index) => {
      const full = ar.schedule.weekday[index];
      const short = ar.dashboard.calendar.weekday[key];

      expect(full.startsWith(DEFINITE_ARTICLE)).toBe(true);
      expect(short).toBe(full.slice(DEFINITE_ARTICLE.length));
    },
  );

  it.each(WEEKDAYS)('the English short form of %s is the first three letters', (key, index) => {
    const full = en.schedule.weekday[index];

    expect(en.dashboard.calendar.weekday[key]).toBe(full.slice(0, 3));
  });
});
