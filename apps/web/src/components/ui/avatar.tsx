import type { JSX } from 'react';

import { cn } from '@web/lib/cn';

export interface AvatarProps {
  readonly name: string;
  readonly className?: string | undefined;
}

/**
 * Initials in a tinted circle.
 *
 * No photo: the system stores none, and a generated cartoon of a person is
 * worse than their initials. Two "words" at most — Arabic names run long, and
 * four letters in a 36px circle is a smudge.
 *
 * Decorative, because the name it abbreviates is always rendered beside it.
 */
export function Avatar({ name, className }: AvatarProps): JSX.Element {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('');

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-9 shrink-0 select-none items-center justify-center rounded-pill',
        'bg-primary-100 text-label font-semibold text-primary-800',
        className,
      )}
    >
      {initials}
    </span>
  );
}
