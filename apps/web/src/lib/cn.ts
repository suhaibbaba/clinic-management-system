import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge has never read theme.css, so a custom `--text-*` key looks like a colour and a
// custom `--radius-*` like an unrelated utility: the later class wins and an override does nothing.
// Any new token needs adding below.
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['label', 'value', 'kpi'] }],
      rounded: [{ rounded: ['card', 'panel', 'control', 'pill'] }],
    },
  },
});

// Without the merge a caller's `w-64` and the component's `w-full` both survive and stylesheet
// order decides, so a `className` override silently does nothing.
export const cn = (...values: ClassValue[]): string => merge(clsx(values));
