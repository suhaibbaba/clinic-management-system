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
// the blue or it competes with the page's action colour. Six pairs, from the reference's
// `.a1`–`.a6`.
const TINTS = [
  'bg-tint-1-bg text-tint-1-ink',
  'bg-tint-2-bg text-tint-2-ink',
  'bg-tint-3-bg text-tint-3-ink',
  'bg-tint-4-bg text-tint-4-ink',
  'bg-tint-5-bg text-tint-5-ink',
  'bg-tint-6-bg text-tint-6-ink',
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

  const shape = 'inline-flex shrink-0 select-none rounded-pill';

  const tint = tintKey === undefined ? 'bg-tint-2-bg text-tint-2-ink' : tintFor(tintKey);

  if (src === null || src === undefined || src === '') {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn(shape, 'items-center justify-center text-label font-medium', tint, className)}
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
            'absolute inset-0 flex items-center justify-center text-label font-medium',
            tint,
          )}
        >
          {initials}
        </span>
      }
      className={cn(shape, 'border border-line bg-sunken', className)}
    />
  );
}

const DEFAULT_SIZE = 36;
