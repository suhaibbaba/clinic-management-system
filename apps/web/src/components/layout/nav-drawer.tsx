import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface NavDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly closeLabel: string;
  readonly children: ReactNode;
}

/**
 * The mobile navigation drawer.
 *
 * It replaces what was there before, which was not a drawer at all: the
 * sidebar simply stopped being `hidden` and pushed the entire page down, so
 * opening the menu meant scrolling past seven nav rows to get back to the
 * content — and the page underneath jumped every time.
 *
 * A real drawer slides in over the page from the side the language starts on,
 * dims what is behind it, traps focus, closes on Escape, on the scrim, and on
 * picking a destination, and returns focus to the button that opened it. All
 * of that is Radix's Dialog; none of it is worth hand-rolling.
 *
 * It slides from `inset-inline-start`, so in Arabic it comes in from the right
 * — the edge the thumb is already on and the edge the reading starts from.
 */
export function NavDrawer({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
}: NavDrawerProps): JSX.Element {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-ink/40 md:hidden',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
          )}
        />

        <DialogPrimitive.Content
          aria-label={title}
          className={cn(
            'fixed inset-y-0 start-0 z-50 flex w-[86%] max-w-[320px] flex-col md:hidden',
            'bg-surface shadow-float',
            'data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <DialogPrimitive.Title className="text-value font-semibold text-ink">
              {title}
            </DialogPrimitive.Title>

            <DialogPrimitive.Close
              aria-label={closeLabel}
              className={cn(
                'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-pill',
                'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
              )}
            >
              <Icon name="x" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
