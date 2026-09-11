import type { JSX, ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@web/components/ui/dropdown-menu';
import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface RowMenuProps {
  /** Named for screen readers; the trigger is a glyph. */
  readonly label: string;
  readonly children: ReactNode;
}

// The reference's `.more-btn`: the row's second-rank destinations, behind one glyph, so the first
// one stays the only thing competing for the eye down a column of ten.
export function RowMenu({ label, children }: RowMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          // 44px on touch (WCAG 2.5.8), the reference's drawn 32 on a laptop.
          'inline-grid size-11 shrink-0 cursor-pointer place-items-center lg:size-8',
          'rounded-control border border-line bg-surface text-ink-muted',
          'transition-colors duration-150',
          'hover:border-primary-600 hover:text-primary-600',
          'data-[state=open]:border-primary-600 data-[state=open]:text-primary-600',
        )}
      >
        <Icon name="more-vertical" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
