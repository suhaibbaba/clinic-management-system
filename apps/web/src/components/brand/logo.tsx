import { useState, type JSX } from 'react';

import logoUrl from '@web/assets/logo.svg';
import { cn } from '@web/lib/cn';

// Falls back on error and not only on absence: a signed URL that expired between the response and
// the render must show a mark, not a broken image.
export type LogoSize = 'chrome' | 'print' | 'login';

const SIZES: Record<LogoSize, string> = {
  // The height cap is not decoration: a clinic's own square mark would be 208px tall across the
  // rail and push the navigation off a laptop screen.
  chrome: 'w-full max-h-24 object-contain',
  print: 'h-12 w-auto',
  login: 'h-20 w-auto',
};

export interface LogoProps {
  size?: LogoSize | undefined;
  /** The clinic's own logo; the bundled mark is used when it is absent. */
  src?: string | null | undefined;
  className?: string | undefined;
  // Decorative wherever something else already names it, so it is not read out twice; the sidebar
  // band is the exception.
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
      // `contain` and `max-w-full` are for an uploaded logo: a wide wordmark at a fixed height
      // would run past the edge of the rail.
      className={cn(SIZES[size], 'max-w-full shrink-0', own && 'object-contain', className)}
    />
  );
}
