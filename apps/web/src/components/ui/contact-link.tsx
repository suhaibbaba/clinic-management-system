import type { JSX } from 'react';

import { Ltr } from '@web/components/ui/ltr';
import { cn } from '@web/lib/cn';

export interface ContactLinkProps {
  /** The number or address as it is stored. Rendered verbatim. */
  readonly value: string | null | undefined;
  readonly className?: string | undefined;
  /** What to draw when there is nothing to link to. Defaults to an em dash. */
  readonly fallback?: JSX.Element | string | undefined;
}

/**
 * Shared by both: a phone number and an email address are the same object on a
 * screen — a Latin string that is also an action.
 */
const LINK_CLASS = cn(
  'text-primary-600 underline-offset-2 transition-colors duration-150',
  'hover:text-primary-700 hover:underline',
  // A row in a table is a 20px line; on a phone this is a thing a thumb has to
  // land on, so it carries the same 44px box every other row action does.
  'inline-flex min-h-11 items-center lg:min-h-0',
);

/**
 * A phone number that dials.
 *
 * Reception's job is largely ringing people, and the number was previously
 * inert text on every screen but the two booking ones — so a receptionist read
 * it off the patients list and typed it into a handset. The link costs nothing
 * and on the device this app is actually used on it is the whole interaction.
 *
 * `tel:` gets the number with its spaces and dashes stripped, because a dialler
 * is entitled to reject them, while the *visible* text stays exactly as it was
 * entered — what is on screen has to match what reception reads out loud.
 *
 * `<Ltr>` because it is a number: a leading `+` is a neutral character and
 * hands itself to the surrounding direction without it, so `+970599…` renders
 * as `970599…+` in an Arabic card.
 */
export function PhoneLink({ value, className, fallback = '—' }: ContactLinkProps): JSX.Element {
  if (value === null || value === undefined || value.trim() === '') {
    return <>{fallback}</>;
  }

  return (
    <Ltr
      as="a"
      href={`tel:${value.replace(/[^+\d]/g, '')}`}
      className={cn(LINK_CLASS, 'tabular-nums', className)}
    >
      {value}
    </Ltr>
  );
}

/**
 * An email address that opens a message.
 *
 * Same reasoning, and the same `<Ltr>`: an address is Latin text, and the dot
 * before a top-level domain is as neutral as the plus in a phone number.
 */
export function EmailLink({ value, className, fallback = '—' }: ContactLinkProps): JSX.Element {
  if (value === null || value === undefined || value.trim() === '') {
    return <>{fallback}</>;
  }

  return (
    <Ltr as="a" href={`mailto:${value.trim()}`} className={cn(LINK_CLASS, className)}>
      {value}
    </Ltr>
  );
}
