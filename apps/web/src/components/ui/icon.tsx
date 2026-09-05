import type { JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

/**
 * The app's icons, drawn rather than installed.
 *
 * An icon set is a dependency that ships hundreds of glyphs to render a dozen,
 * and CLAUDE.md rules out weight without justification. These are the ones the
 * design actually uses, on one 24px grid with one stroke width, so they sit
 * together on a row without any looking heavier than its neighbours.
 *
 * Every icon is `currentColor` and decorative: an icon here never carries
 * meaning on its own, so it is `aria-hidden` and the label beside it is what
 * the screen reader announces. Where an icon is the only content — a circular
 * action button — the button carries the accessible name, not the glyph.
 *
 * Nothing here is mirrored for RTL except the direction arrows, which are
 * chosen by the caller: a chevron that means "forward" is a different glyph in
 * Arabic, but a bell is a bell.
 */
export type IconName =
  | 'activity'
  | 'alert'
  | 'bell'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-end'
  | 'chevron-start'
  | 'clipboard'
  | 'coins'
  | 'file'
  | 'gear'
  | 'image'
  | 'logout'
  | 'money'
  | 'plus'
  | 'search'
  | 'shield'
  | 'stethoscope'
  | 'tooth'
  | 'trend-down'
  | 'trend-up'
  | 'user'
  | 'users'
  | 'x';

const PATHS: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  alert: (
    <>
      <path d="M12 3.6 2.7 19.2a1.4 1.4 0 0 0 1.2 2.1h16.2a1.4 1.4 0 0 0 1.2-2.1L12 3.6Z" />
      <path d="M12 9.5v4.2M12 17.3h.01" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2.1 6.4-2.1 6.4h16.2S18 13.6 18 8.6Z" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.2" y="4.8" width="17.6" height="16" rx="2.6" />
      <path d="M3.2 9.8h17.6M8.4 2.8v4M15.6 2.8v4" />
    </>
  ),
  check: <path d="M4.8 12.6l4.6 4.6L19.2 7.4" />,
  'chevron-down': <path d="M6 9.5 12 15.5 18 9.5" />,
  'chevron-end': <path d="M15 6 9 12l6 6" />,
  'chevron-start': <path d="M9 6l6 6-6 6" />,
  clipboard: (
    <>
      <path d="M9 4.4H7.4a2 2 0 0 0-2 2v12.4a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V6.4a2 2 0 0 0-2-2H15" />
      <rect x="9" y="2.6" width="6" height="3.6" rx="1.2" />
      <path d="M9 11.4h6M9 15.4h4" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.6" rx="7.4" ry="3.2" />
      <path d="M4.6 6.6v5.2c0 1.8 3.3 3.2 7.4 3.2s7.4-1.4 7.4-3.2V6.6" />
      <path d="M4.6 11.8v5.2c0 1.8 3.3 3.2 7.4 3.2s7.4-1.4 7.4-3.2v-5.2" />
    </>
  ),
  file: (
    <>
      <path d="M13.6 2.8H7.4a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8l-5-5.2Z" />
      <path d="M13.4 2.9V8h4.9M8.8 13h6.4M8.8 16.6h4.4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.5 14.4a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z" />
    </>
  ),
  image: (
    <>
      <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="2.6" />
      <circle cx="8.6" cy="9.8" r="1.7" />
      <path d="m3.8 17.4 4.8-4.6a2 2 0 0 1 2.7 0l5.6 5.4M15 13.4l1.6-1.5a2 2 0 0 1 2.7 0l1.5 1.4" />
    </>
  ),
  logout: (
    <>
      <path d="M9.6 20.4H6.2a2 2 0 0 1-2-2V5.6a2 2 0 0 1 2-2h3.4" />
      <path d="M15.2 16.4 19.6 12l-4.4-4.4M19.2 12H9.4" />
    </>
  ),
  money: (
    <>
      <rect x="2.6" y="5.6" width="18.8" height="12.8" rx="2.4" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6.4 9.6v4.8M17.6 9.6v4.8" />
    </>
  ),
  plus: <path d="M12 5.4v13.2M5.4 12h13.2" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.6" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 4.6 6v6c0 4.6 3.1 8.4 7.4 9.4 4.3-1 7.4-4.8 7.4-9.4V6L12 2.8Z" />
      <path d="m9.2 11.8 2 2 3.6-3.6" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M5.2 3.2v5.2a4.2 4.2 0 0 0 8.4 0V3.2" />
      <path d="M3.6 3.2h3.2M12 3.2h3.2" />
      <path d="M9.4 12.6v2.6a4.6 4.6 0 0 0 9.2 0v-2" />
      <circle cx="18.8" cy="11.2" r="2.2" />
    </>
  ),
  tooth: (
    <path d="M12 3.2c-4.2 0-6.8 2.5-6.8 6.3 0 3.4 1.7 5.5 2.5 8.9.5 1.7 1.8 2.1 2.6 1.2.8-.9.8-3.8 1.7-3.8s.9 2.9 1.7 3.8c.8.9 2.1.5 2.6-1.2.8-3.4 2.5-5.5 2.5-8.9 0-3.8-2.6-6.3-6.8-6.3Z" />
  ),
  'trend-down': (
    <>
      <path d="M3.4 7.6 10 14.2l3.4-3.4 7.2 7.2" />
      <path d="M15.4 18h5.2v-5.2" />
    </>
  ),
  'trend-up': (
    <>
      <path d="M3.4 16.4 10 9.8l3.4 3.4 7.2-7.2" />
      <path d="M15.4 6h5.2v5.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.8 20.4a7.4 7.4 0 0 1 14.4 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9.4" cy="8" r="3.6" />
      <path d="M2.8 20.2a6.8 6.8 0 0 1 13.2 0" />
      <path d="M16.4 4.8a3.6 3.6 0 0 1 0 6.9M17.8 14.4a6 6 0 0 1 3.6 5.8" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

export interface IconProps {
  readonly name: IconName;
  /** Sizing and colour only — an icon has no colour of its own. */
  readonly className?: string | undefined;
}

export function Icon({ name, className }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('size-5 shrink-0', className)}
    >
      {PATHS[name]}
    </svg>
  );
}
