import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditional class names, with later Tailwind utilities winning over earlier
 * conflicting ones.
 *
 * The merge matters for the base components: without it a caller's `w-64` and
 * the component's own `w-full` both survive and the stylesheet order decides,
 * so a `className` override silently does nothing.
 */
export const cn = (...values: ClassValue[]): string => twMerge(clsx(values));
