import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface NavDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  // Drawn nowhere — the header carries `brand` — but a dialog still has to be named for a screen
  // reader.
  readonly title: string;
  readonly brand: ReactNode;
  readonly closeLabel: string;
  readonly children: ReactNode;
}

// A real drawer over the page: the sidebar used to simply unhide and push the content down, so
// opening the menu meant scrolling past seven rows to get back.
export function NavDrawer({
  open,
  onOpenChange,
  title,
  brand,
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
          // Same rule as `Modal` and `Drawer`: a panel opening does not move the caret. Radix would
          // focus the close button, announcing "close" before the navigation.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          tabIndex={-1}
          aria-label={title}
          className={cn(
            'fixed inset-y-0 start-0 z-50 flex w-[86%] max-w-[320px] flex-col md:hidden',
            // `bg-rail`, not `bg-surface`: on a phone this panel is the rail, and it carries the
            // same tint the rail does on a laptop.
            'bg-rail shadow-float',
            'data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out',
          )}
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3">
            {/* The mark is what is drawn; the name is what is announced. */}
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {/* `min-w-0` so the mark takes the width the close button leaves,
                rather than pushing it off the edge. */}
            <div className="min-w-0 flex-1">{brand}</div>

            <DialogPrimitive.Close
              aria-label={closeLabel}
              className={cn(
                'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill',
                'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
              )}
            >
              <Icon name="x" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
