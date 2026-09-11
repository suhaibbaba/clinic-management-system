import type { JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export interface WidgetProps {
  readonly title?: ReactNode | undefined;
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

// The reference's `.widget`: a panel's smaller sibling for the side column — the same edge and
// shadow, tighter padding, and a heading that carries its own single action.
export function Widget({ title, action, className, children }: WidgetProps): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface px-[18px] py-4 shadow-card',
        className,
      )}
    >
      {title !== undefined && (
        <h3 className="flex items-center justify-between gap-2 text-section font-medium">
          {title}
          {action}
        </h3>
      )}
      {children}
    </div>
  );
}
