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
 * Sizes are named for where they are used rather than as a t-shirt scale: a
 * logo each screen sizes to taste stops being a logo. The file's own width and
 * height are ignored — the mark is sized by these classes and keeps its aspect
 * ratio.
 */
export type LogoSize = 'chrome' | 'print' | 'login';

const SIZES: Record<LogoSize, string> = {
  /**
   * The rail's band, and the drawer's: the mark takes the whole width it is
   * given and finds its own height under it.
   *
   * The height cap is not decoration. A clinic uploads its own mark and it can
   * be any shape: the bundled one is 1.4:1 and would be 147px tall across a
   * 208px rail, and a square one 208 — a brand band that pushes the navigation
   * off a laptop screen. At `w-full` with a ceiling, a wordmark fills the width
   * and anything squarer sits centred inside it at 96px.
   */
  chrome: 'w-full max-h-24 object-contain',
  /** Print letterhead. */
  print: 'h-12 w-auto',
  /** Login page. */
  login: 'h-20 w-auto',
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

export function Logo({ size = 'print', src, className, alt }: LogoProps): JSX.Element {
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
