import type { JSX } from 'react';

import logoUrl from '@web/assets/logo.svg';
import { cn } from '@web/lib/cn';

/**
 * The clinic mark.
 *
 * One component for every placement, so the artwork is referenced from exactly
 * one import and swapping `assets/logo.svg` needs no code change anywhere.
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
  className?: string | undefined;
  /**
   * The mark is decorative wherever the clinic's name is already on screen
   * beside it — which is every placement — so it is hidden from assistive
   * technology by default rather than read out twice.
   */
  alt?: string | undefined;
}

export function Logo({ size = 'md', className, alt }: LogoProps): JSX.Element {
  return (
    <img
      src={logoUrl}
      alt={alt ?? ''}
      {...(alt === undefined && { 'aria-hidden': true })}
      className={cn(SIZES[size], 'shrink-0', className)}
    />
  );
}
