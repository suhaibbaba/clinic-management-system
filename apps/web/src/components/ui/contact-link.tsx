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
  /*
   * A 44px thumb target that costs the line nothing.
   *
   * A row in a table is a 20px line, and on a phone this is a thing a thumb
   * has to land on — and a near miss on a patient card does not miss, it opens
   * the patient, because the card's whole surface is a button. So the target
   * has to be there.
   *
   * It used to be `inline-flex min-h-11 items-center`, which bought the height
   * out of the line box: an inline-level box takes its baseline from its
   * content, so a 44px box around a 24px line hung 10px of itself above the
   * baseline and pushed the number 8px below the label sitting beside it. On
   * every card of every list, the phone row was the one row whose two halves
   * did not read as one line — and the row grew to 64px with it.
   *
   * An absolutely positioned `::after` gives the same 44px of hit area with no
   * layout at all: it is a descendant box of the link, so it hit-tests as the
   * link, and it is centred on the text rather than displacing it. Above `lg`
   * there is no thumb and the rows are dense enough that neighbouring bands
   * would start competing, so it is dropped.
   */
  'relative inline-block',
  "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] lg:after:hidden",
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
