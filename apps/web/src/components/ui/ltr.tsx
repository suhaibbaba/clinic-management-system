import type { JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export interface LtrProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly as?: 'span' | 'dd' | 'p' | 'div' | 'a' | undefined;
  /** Passed through when the island is a link — `tel:` and `mailto:`. */
  readonly href?: string | undefined;
  readonly title?: string | undefined;
}

// An LTR island for Latin digits: its own direction (or `+963…` renders as `963…+`), isolation from
// the text around it, and `w-fit` so alignment still belongs to the page.
export function Ltr({ children, className, as = 'span', href, title }: LtrProps): JSX.Element {
  const Tag = as;

  return (
    <Tag
      dir="ltr"
      className={cn(
        // `inline-block` lets the parent's text-align place it, `w-fit` stops a flex item
        // stretching, `nowrap` because an amount is one word, `max-w-full` so `truncate` has a box.
        'inline-block w-fit max-w-full whitespace-nowrap',
        className,
      )}
      {...(href !== undefined && { href })}
      {...(title !== undefined && { title })}
    >
      {children}
    </Tag>
  );
}
