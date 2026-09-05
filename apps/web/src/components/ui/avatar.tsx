import type { JSX } from 'react';

import { cn } from '@web/lib/cn';

export interface AvatarProps {
  readonly name: string;
  /**
   * Picks the tint from a stable id. Two patients in a list read apart at a
   * glance without the colour meaning anything — it is decoration keyed to
   * identity, so the same person is the same colour on every screen.
   */
  readonly tintKey?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * The tints an avatar can take.
 *
 * Deliberately soft and low-chroma: this is the one place colour appears
 * without meaning, so it has to stay well below the blue in weight or it
 * starts competing with the page's single action colour. Each pairs a tint
 * with ink that clears AA on it.
 */
const TINTS = [
  'bg-primary-100 text-primary-800',
  'bg-success-100 text-success-800',
  'bg-warning-100 text-warning-800',
  'bg-danger-100 text-danger-800',
  'bg-neutral-200 text-neutral-800',
] as const;

/** A stable index from a string — same id, same colour, every render. */
function tintFor(key: string): string {
  let hash = 0;

  for (const character of key) {
    hash = (hash * 31 + character.codePointAt(0)!) % 1_000_003;
  }

  return TINTS[hash % TINTS.length] ?? TINTS[0];
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
export function Avatar({ name, tintKey, className }: AvatarProps): JSX.Element {
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
        'text-label font-semibold',
        tintKey === undefined ? 'bg-primary-100 text-primary-800' : tintFor(tintKey),
        className,
      )}
    >
      {initials}
    </span>
  );
}
