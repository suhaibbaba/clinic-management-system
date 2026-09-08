import * as Dialog from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';
import { documentDirection } from '@web/lib/direction';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already-resolved title: a drawer usually names a record, not a screen. */
  title: ReactNode;
  /** i18n key describing the drawer for screen readers. */
  descriptionKey: string;
  children: ReactNode;
  footer?: ReactNode | undefined;
}

/**
 * Side sheet anchored to the inline end of the page — the left in an RTL
 * layout, the right in LTR — so it opens away from the reading edge either way.
 *
 * Radix Dialog underneath, for the focus trap and escape handling — and, as in
 * `Modal`, with its auto-focus prevented: a drawer opens because somebody
 * wanted to read a record, and putting the caret in its first field announces
 * the wrong thing and can unfold a picker nobody asked for. The trap, Escape
 * and the first Tab all behave exactly as they did.
 *
 * There is
 * deliberately no slide-in transform: `translate-x` is not mirrored in RTL, so
 * a slide would animate from the wrong side of an Arabic page. It fades in
 * instead, which is direction-agnostic.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  descriptionKey,
  children,
  footer,
}: DrawerProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          tabIndex={-1}
          dir={documentDirection()}
          className={cn(
            'fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-float',
            'border-s border-line',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close
              className={cn(
                // The same 44px close as the navigation drawer's, and the same
                // glyph: this one was a bare "✕" character in a 27px box, so
                // it was both the smallest target on the screen and the one
                // control in the app drawn in a font rather than in the icon
                // set.
                'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill',
                'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
              )}
              aria-label={t('common.close')}
            >
              <Icon name="x" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">{t(descriptionKey)}</Dialog.Description>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer !== undefined && (
            <div className="shrink-0 border-t border-line px-5 py-3">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
