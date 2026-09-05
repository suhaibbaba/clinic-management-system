import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge, taught this app's own font-size scale.
 *
 * tailwind-merge has its own idea of what every class means, built from stock
 * Tailwind. It has never read theme.css, so a custom `--text-*` key looks
 * exactly like a colour to it: `text-value` and `text-ink-inverse` are judged
 * to be the same kind of class, and the later one silently wins.
 *
 * That is not theoretical — it shipped a black button with black text, because
 * `text-ink-inverse` was dropped from a `cn('… text-ink-inverse', 'text-value')`
 * and nothing failed; it just came out unreadable. Declaring the scale here is
 * what keeps a size and a colour in separate groups.
 *
 * Any new `--text-*` token in theme.css needs its name adding below.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['label', 'value', 'kpi'] }],
    },
  },
});

/**
 * Conditional class names, with later Tailwind utilities winning over earlier
 * conflicting ones.
 *
 * The merge matters for the base components: without it a caller's `w-64` and
 * the component's own `w-full` both survive and the stylesheet order decides,
 * so a `className` override silently does nothing.
 */
export const cn = (...values: ClassValue[]): string => merge(clsx(values));
