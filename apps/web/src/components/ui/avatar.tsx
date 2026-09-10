import type { JSX } from 'react';

import { Img } from '@web/components/ui/img';
import { cn } from '@web/lib/cn';

export interface AvatarProps {
  readonly name: string;
  // Keyed to a stable id so the same person is the same colour on every screen; the colour itself
  // means nothing.
  readonly tintKey?: string | undefined;
  readonly src?: string | null | undefined;
  /** Edge length in pixels. Fixed, so the row does not reflow when a photo lands. */
  readonly size?: number | undefined;
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
// expired URL falls back to initials.
export function Avatar({
  name,
  tintKey,
  src,
  size = DEFAULT_SIZE,
  className,
}: AvatarProps): JSX.Element {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('');

  const shape = cn('inline-flex shrink-0 select-none rounded-pill', className);

  const tint = tintKey === undefined ? 'bg-primary-100 text-primary-800' : tintFor(tintKey);

  if (src === null || src === undefined || src === '') {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn(shape, 'items-center justify-center text-label font-semibold', tint)}
      >
        {initials}
      </span>
    );
  }

  return (
    <Img
      src={src}
      alt=""
      width={size}
      height={size}
      // `cover`, because a portrait cropped to a circle is what everyone
      // expects of one; `contain` would letterbox a face inside a ring.
      fit="cover"
      fallback={
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center justify-center text-label font-semibold',
            tint,
          )}
        >
          {initials}
        </span>
      }
      className={cn(shape, 'border border-line bg-sunken')}
    />
  );
}

const DEFAULT_SIZE = 36;
