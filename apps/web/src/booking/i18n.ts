import ar from '@web/booking/locales/ar.json';

type Dictionary = { readonly [key: string]: string | Dictionary };

const DICTIONARIES: Record<string, Dictionary> = { ar };

export const BOOKING_LANGUAGE = 'ar';

// A missing key returns the key: a screen reading `otp.resendIn` is reported in a minute, where a
// blank space ships.
export function t(key: string, vars?: Record<string, string | number>): string {
  const value = key
    .split('.')
    .reduce<string | Dictionary | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      DICTIONARIES[BOOKING_LANGUAGE],
    );

  if (typeof value !== 'string') {
    return key;
  }

  if (!vars) {
    return value;
  }

  return value.replaceAll(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
