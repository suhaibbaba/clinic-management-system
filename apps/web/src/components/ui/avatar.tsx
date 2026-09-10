import { useEffect, useState, type JSX } from 'react';

import { cn } from '@web/lib/cn';

export interface AvatarProps {
  readonly name: string;
  // Keyed to a stable id so the same person is the same colour on every screen; the colour itself
  // means nothing.
  readonly tintKey?: string | undefined;
  readonly src?: string | null | undefined;
  readonly className?: string | undefined;
}

// Soft and low-chroma: this is the one place colour appears without meaning, so it must stay below
// the blue or it competes with the page's action colour.
const TINTS = [
  'bg-primary-100 text-primary-800',
  'bg-success-100 text-success-800',
  'bg-warning-100 text-warning-800',
  'bg-danger-100 text-danger-800',
  'bg-neutral-200 text-neutral-800',
] as const;

function tintFor(key: string): string {
  let hash = 0;

  for (const character of key) {
    hash = (hash * 31 + character.codePointAt(0)!) % 1_000_003;
  }

  return TINTS[hash % TINTS.length] ?? TINTS[0];
}

// Staff have a photo because a rota is read by scanning for a person; patients do not. A broken or
// expired URL falls back to initials, and a new `src` clears that.
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
