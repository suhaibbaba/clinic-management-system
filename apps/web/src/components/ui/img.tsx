import { useEffect, useState, type CSSProperties, type JSX, type ReactNode } from 'react';

import { Icon } from '@web/components/ui/icon';
import { Skeleton } from '@web/components/ui/skeleton';
import { cn } from '@web/lib/cn';

interface FluidSizing {
  /** CSS `aspect-ratio`, e.g. `"4/3"`. The box takes its width from the layout. */
  readonly aspectRatio: string;
  readonly width?: never;
  readonly height?: never;
}

interface FixedSizing {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio?: never;
}

interface ImgBase {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly className?: string | undefined;
  /** `cover` crops to fill the reserved box; `contain` fits inside it. */
  readonly fit?: 'cover' | 'contain' | undefined;
  /** Above the fold: eager and high priority, for the logo and nothing routine. */
  readonly priority?: boolean | undefined;
  /** Drawn in the reserved box instead of the broken-image mark, at the same size. */
  readonly fallback?: ReactNode | undefined;
}

export type ImgProps = ImgBase & (FluidSizing | FixedSizing);

type ImgState = 'loading' | 'loaded' | 'failed';

/**
 * The box is reserved before the file loads and keeps its dimensions in every state, so no image
 * in the app can shift the layout under it.
 */
export function Img({
  src,
  alt,
  className,
  fit = 'cover',
  priority = false,
  fallback,
  ...sizing
}: ImgProps): JSX.Element {
  const [state, setState] = useState<ImgState>('loading');

  useEffect(() => setState('loading'), [src]);

  const box: CSSProperties =
    sizing.aspectRatio === undefined
      ? { width: sizing.width, height: sizing.height }
      : { aspectRatio: sizing.aspectRatio };

  const missing = src === null || src === undefined || src === '';
  const showFallback = missing || state === 'failed';

  return (
    <span
      style={box}
      className={cn('relative block max-w-full shrink-0 overflow-hidden', className)}
    >
      {!missing && state !== 'failed' && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          {...(priority
            ? { loading: 'eager' as const, fetchPriority: 'high' as const }
            : { loading: 'lazy' as const })}
          decoding="async"
          className={cn(
            'size-full transition-opacity duration-[120ms]',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {!missing && state === 'loading' && (
        <Skeleton className="absolute inset-0 size-full rounded-none" />
      )}

      {showFallback &&
        (fallback ?? (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-inset text-ink-subtle"
          >
            <Icon name="image" />
          </span>
        ))}
    </span>
  );
}
