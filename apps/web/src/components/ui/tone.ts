import type { BadgeTone } from '@web/components/ui/badge';

// A tone becomes a colour in exactly two places: `Badge` draws the pill, and this draws the block
// a calendar or a board column needs — the same tint with an edge on it. A status table names a
// tone and nothing else, so a status cannot be amber in one view and grey in another.
export const TONE_SURFACE: Record<BadgeTone, string> = {
  neutral: 'border-line-strong bg-sunken text-ink-subtle',
  success: 'border-success-300 bg-success-100 text-success-700',
  warning: 'border-warning-200 bg-warning-100 text-warning-700',
  danger: 'border-danger-200 bg-danger-100 text-danger-600',
  info: 'border-primary-200 bg-primary-100 text-primary-600',
};
