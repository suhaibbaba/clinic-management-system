import { useState, type JSX } from 'react';

import logoUrl from '@web/assets/logo.svg';
import { cn } from '@web/lib/cn';

/**
 * The clinic mark.
 *
 * One component for every placement, so the artwork is referenced from exactly
 * one import and swapping `assets/logo.svg` needs no code change anywhere.
 *
 * A clinic that has uploaded its own logo gets that one instead — pass `src`
 * — and the bundled mark is the fallback until they do, or when the signed URL
 * fails to load. Fallback on error and not only on absence: a URL that expired
 * between the response and the render must show a mark, not a broken image.
 *
 * Sizes are named rather than free-form: a logo that each screen scales to
 * taste stops being a logo. The file's own width and height are ignored — the
 * mark is sized by these classes and keeps its aspect ratio.
 */
export type LogoSize = 'sm' | 'md' | 'lg';

const SIZES: Record<LogoSize, string> = {
  /** Sidebar header, next to the app name. */
  sm: 'h-7 w-auto',
  /** Print letterhead. */
  md: 'h-12 w-auto',
  /** Login page. */
  lg: 'h-20 w-auto',
};

export interface LogoProps {
  size?: LogoSize | undefined;
  /** The clinic's own logo; the bundled mark is used when it is absent. */
  src?: string | null | undefined;
  className?: string | undefined;
  /**
   * The mark is decorative wherever the clinic's name is already on screen
   * beside it — which is every placement — so it is hidden from assistive
   * technology by default rather than read out twice.
   */
  alt?: string | undefined;
}

export function Logo({ size = 'md', src, className, alt }: LogoProps): JSX.Element {
  const [failed, setFailed] = useState(false);
  const own = src && !failed ? src : null;

  return (
    <img
      src={own ?? logoUrl}
      alt={alt ?? ''}
      {...(alt === undefined && { 'aria-hidden': true })}
      {...(own && { onError: () => setFailed(true) })}
      // `contain` only matters for an uploaded logo: the bundled mark already
      // fits its box, and someone else's does not have to.
      className={cn(SIZES[size], 'shrink-0', own && 'object-contain', className)}
    />
  );
}
