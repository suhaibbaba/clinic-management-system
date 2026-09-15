import * as Dialog from '@radix-ui/react-dialog';
import { useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@ui/components/icon';
import { DialogLayerProvider } from '@ui/components/dialog-layer';
import { cn } from '@ui/lib/cn';
import { documentDirection } from '@ui/lib/direction';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already-resolved title: a drawer usually names a record, not a screen. */
  title: ReactNode;
  descriptionKey: string;
  children: ReactNode;
  footer?: ReactNode | undefined;
}

// Auto-focus prevented as in `Modal`: a drawer opens to be read. No slide-in either — `translate-x`
// is not mirrored in RTL, so it would animate from the wrong side; it fades instead.
export function Drawer({
  open,
  onOpenChange,
  title,
  descriptionKey,
  children,
  footer,
}: DrawerProps): JSX.Element {
  const { t } = useTranslation();
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-part="drawer-overlay"
          className={cn(
            'fixed inset-0 z-40 bg-ink/40',
            'data-[state=open]:animate-[fade-in_200ms_ease-out]',
            'data-[state=closed]:animate-[fade-out_150ms_ease-in]',
          )}
        />
        <Dialog.Content
          ref={setLayer}
          data-part="drawer"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          tabIndex={-1}
          dir={documentDirection()}
          className={cn(
            'fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-float',
            'border-s border-line',
            'data-[state=open]:animate-[drawer-end-in_220ms_cubic-bezier(0.32,0.72,0,1)]',
            'data-[state=closed]:animate-[drawer-end-out_180ms_ease-in]',
          )}
        >
          <div
            data-part="drawer-header"
            className="flex items-start justify-between gap-3 border-b border-line px-4 py-3"
          >
            <Dialog.Title data-part="drawer-title" className="text-section font-medium text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close
              data-part="drawer-close"
              className={cn(
                'inline-flex size-(--control-h) shrink-0 cursor-pointer items-center justify-center rounded-pill',
                'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
              )}
              aria-label={t('common.close')}
            >
              <Icon name="x" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">{t(descriptionKey)}</Dialog.Description>

          <div data-part="drawer-body" className="scroll-lane flex-1 overflow-y-auto px-4 py-4">
            {/* As in `Modal`: a picker in here portals into the drawer. */}
            <DialogLayerProvider container={layer}>{children}</DialogLayerProvider>
          </div>

          {footer !== undefined && (
            <div data-part="drawer-footer" className="shrink-0 border-t border-line px-4 py-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
