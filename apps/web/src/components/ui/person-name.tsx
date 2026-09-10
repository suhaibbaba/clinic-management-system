import { bothNames, personName, type PersonName as Name } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

export interface PersonNameProps {
  /** A staff or clinic name. Patient names are a plain string — see below. */
  readonly name: Name | null | undefined;
  readonly className?: string | undefined;
  /** Rendered when there is no name at all — a waiting-list entry with no doctor. */
  readonly fallback?: string | undefined;
  readonly showBoth?: boolean | undefined;
}

// One component rather than a language ternary at forty call sites. The fallback is the migration:
// a clinic part-way through filling in Arabic must not get a blank calendar.
export function PersonName({
  name,
  className,
  fallback = '—',
  showBoth = false,
}: PersonNameProps): JSX.Element {
  const { i18n } = useTranslation();
  const resolved = personName(name, i18n.language);

  return (
    <span
      className={className}
      {...(showBoth && name && resolved !== '' && { title: bothNames(name) })}
    >
      {resolved === '' ? fallback : resolved}
    </span>
  );
}

// Returns a function rather than a value, so one call covers a list — forty rows would otherwise
// need forty hooks.
export function usePersonName(): (name: Name | null | undefined) => string {
  const { i18n } = useTranslation();

  return (name) => personName(name, i18n.language);
}
