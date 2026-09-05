import * as Dialog from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@web/lib/cn';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** i18n key. */
  title: string;
  /** Interpolation values for the title. */
  titleValues?: Record<string, string> | undefined;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  size?: 'md' | 'lg' | undefined;
}

/**
 * Radix Dialog: focus trapping, escape handling and `aria-modal` are the parts
 * that are genuinely hard to get right by hand.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  titleValues,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-gray-900/40" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            // Physical centring: `translate-x` is not mirrored in RTL, so the
            // logical `start-*` variant would push the dialog off centre.
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            size === 'lg' ? 'max-w-2xl' : 'max-w-md',
            // Column layout so the body scrolls and the footer stays reachable.
            'flex max-h-[calc(100vh-4rem)] flex-col rounded-lg bg-white p-5 shadow-xl',
          )}
        >
          <Dialog.Title className="text-base font-semibold text-gray-900">
            {t(title, titleValues ?? {})}
          </Dialog.Title>

          {description !== undefined ? (
            <Dialog.Description className="mt-1 text-sm text-gray-500">
              {t(description)}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">
              {t(title, titleValues ?? {})}
            </Dialog.Description>
          )}

          <div className="mt-4 flex-1 overflow-y-auto">{children}</div>

          {footer !== undefined && (
            <div className="mt-5 flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 pt-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
