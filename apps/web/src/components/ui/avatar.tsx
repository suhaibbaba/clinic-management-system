import { useEffect, useState, type JSX } from 'react';

import { cn } from '@web/lib/cn';

export interface AvatarProps {
  readonly name: string;
  /**
   * Picks the tint from a stable id. Two patients in a list read apart at a
   * glance without the colour meaning anything — it is decoration keyed to
   * identity, so the same person is the same colour on every screen.
   */
  readonly tintKey?: string | undefined;
  /**
   * A staff photo, as the short-lived signed URL the API minted for it. Null,
   * absent, or a URL that fails to load all fall back to the initials.
   */
  readonly src?: string | null | undefined;
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
 * A staff photo, or initials in a tinted circle.
 *
 * Patients have no photo and are not going to: this system records what
 * reception was handed, and a portrait of a patient is not that. **Staff do**,
 * because a rota, a calendar column and a lab sheet are all read by scanning
 * for a person, and a face is faster than a name at 36 pixels.
 *
 * Two initials at most — Arabic names run long, and four letters in a 36px
 * circle is a smudge.
 *
 * The image is decorative in the same way the initials are: the name it stands
 * for is always rendered beside it, so it carries an empty `alt` rather than
 * repeating that name to a screen reader.
 *
 * **A broken URL falls back rather than showing a torn image.** Photo URLs are
 * signed and expire in minutes, so a tab left open overnight is the ordinary
 * case, not the exceptional one — `onError` puts the initials back, and a new
 * `src` clears that so the next render gets a fair try.
 */
export function Avatar({ name, tintKey, src, className }: AvatarProps): JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('');

  const shape = cn('inline-flex size-9 shrink-0 select-none rounded-pill', className);

  if (src !== null && src !== undefined && src !== '' && !failed) {
    return (
      <img
        src={src}
        alt=""
        // `cover`, because a portrait cropped to a circle is what everyone
        // expects of one; `contain` would letterbox a face inside a ring.
        className={cn(shape, 'inline-block border border-line bg-sunken object-cover')}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        shape,
        'items-center justify-center text-label font-semibold',
        tintKey === undefined ? 'bg-primary-100 text-primary-800' : tintFor(tintKey),
      )}
    >
      {initials}
    </span>
  );
}
