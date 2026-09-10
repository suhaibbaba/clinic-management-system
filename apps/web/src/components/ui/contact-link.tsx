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

const LINK_CLASS = cn(
  'text-primary-600 underline-offset-2 transition-colors duration-150',
  'hover:text-primary-700 hover:underline',
  // An absolutely positioned `::after` gives 44px of hit area with no layout: `inline-flex
  // min-h-11` bought the height out of the line box and dropped the number below its label.
  'relative inline-block',
  "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] lg:after:hidden",
);

// `tel:` gets the digits stripped of spacing while the visible text stays as entered — that is what
// reception reads aloud. `<Ltr>`, or a leading `+` renders as `970599…+`.
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

// Same `<Ltr>` reasoning: the dot before a top-level domain is as neutral as the plus in a phone
// number.
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
