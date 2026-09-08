import { bothNames, personName, type PersonName as Name } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

export interface PersonNameProps {
  /** A staff or clinic name. Patient names are a plain string — see below. */
  readonly name: Name | null | undefined;
  readonly className?: string | undefined;
  /** Rendered when there is no name at all — a waiting-list entry with no doctor. */
  readonly fallback?: string | undefined;
  /**
   * Puts both spellings in a `title`, so somebody looking at an Arabic screen
   * can hover a name and read how it is written on a letterhead. Off by
   * default: a tooltip on every name in a table is noise.
   */
  readonly showBoth?: boolean | undefined;
}

/**
 * A staff or clinic name, in the reader's language.
 *
 * **One component, used everywhere a name is drawn** — the user menu, the
 * doctors list, calendar columns and blocks, visits, prescriptions, the audit
 * log, public booking. The alternative was `i18n.language.startsWith('en') ?
 * name.en : name.ar` at forty call sites, which is forty chances to write the
 * ternary backwards and forty places to change when the fallback rule changes.
 *
 * The fallback to the other language is not politeness, it is the migration:
 * every existing name was copied into both columns, and a clinic part-way
 * through filling in its Arabic spellings must not get a blank calendar.
 *
 * **Patient names are deliberately not this.** They are one field, entered as
 * reception copied them off an ID card (CLAUDE.md); rendering one through here
 * would be claiming a second spelling exists.
 */
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

/**
 * The same rule as a string, for the places that cannot take an element: an
 * `<option>` label, an `aria-label`, a document title, a sort key.
 *
 * Returns a function rather than a value so one call at the top of a component
 * covers a whole list — a table of forty rows would otherwise need forty hooks.
 */
export function usePersonName(): (name: Name | null | undefined) => string {
  const { i18n } = useTranslation();

  return (name) => personName(name, i18n.language);
}
