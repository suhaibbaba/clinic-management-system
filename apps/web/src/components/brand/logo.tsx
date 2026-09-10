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
  /**
   * The chrome: the sidebar's own band, and the mobile drawer's.
   *
   * 44 inside a 56px band is as large as the mark goes without the band
   * growing — and the band's height is not free, because its hairline and the
   * page bar's are one line across the screen.
   */
  sm: 'h-11 w-auto',
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
   * The mark is decorative wherever a name for it is already on screen or on
   * the container — the login page's heading, the drawer's own label — so it
   * is hidden from assistive technology by default rather than read out twice.
   * The sidebar band is the exception: nothing else there names the app.
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
      // `max-w-full` is a guard rather than a size: a clinic's own mark can be
      // a wide wordmark, and at a fixed height `w-auto` would take it past the
      // edge of the 248px rail.
      className={cn(SIZES[size], 'max-w-full shrink-0', own && 'object-contain', className)}
    />
  );
}
