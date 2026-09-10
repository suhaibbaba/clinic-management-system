import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

export interface NavDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * The panel's accessible name. Drawn nowhere: the header carries `brand`
   * instead, and a dialog still has to be named for a screen reader.
   */
  readonly title: string;
  /** What the header shows — the clinic's mark, at the rail's own size. */
  readonly brand: ReactNode;
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
          // No field here, but the same rule as `Modal` and `Drawer`: a panel
          // opening does not move the caret. Radix would focus the close
          // button, which announces "close" before the navigation.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          tabIndex={-1}
          aria-label={title}
          className={cn(
            'fixed inset-y-0 start-0 z-50 flex w-[86%] max-w-[320px] flex-col md:hidden',
            // `chrome-sidebar`, not `bg-surface`: on a phone this panel is the
            // rail, and it carries the same tint the rail does on a laptop.
            'chrome-sidebar shadow-float',
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
