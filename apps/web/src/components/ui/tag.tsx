import type { JSX, ReactNode } from 'react';

import { Icon, type IconName } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface TagProps {
  readonly icon?: IconName | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

// The reference's `.tag`: the label that names what a KPI figure counts, or what a panel lists. It
// is a heading's clothing, never a control — a `Badge` says what a row's state is, a `Tag` says
// what the thing below it is.
export function Tag({ icon, className, children }: TagProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-field px-[15px] py-[9px]',
        'tag-wash text-label leading-none font-medium text-primary-900',
        className,
      )}
    >
      {icon !== undefined && <Icon name={icon} className="size-3.5 shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
