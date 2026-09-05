import * as Dialog from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@web/lib/cn';

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
 * Radix Dialog underneath, for the focus trap and escape handling. There is
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
          dir="rtl"
          className={cn(
            'fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-float',
            'border-s border-line',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close
              className="cursor-pointer rounded-control px-2 py-1 text-label text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              aria-label={t('common.close')}
            >
              ✕
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
