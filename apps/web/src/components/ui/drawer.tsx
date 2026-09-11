import * as Dialog from '@radix-ui/react-dialog';
import { useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui/icon';
import { DialogLayerProvider } from '@web/components/ui/dialog-layer';
import { cn } from '@web/lib/cn';
import { documentDirection } from '@web/lib/direction';

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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          ref={setLayer}
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
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <Dialog.Title className="text-section font-medium text-ink">{title}</Dialog.Title>
            <Dialog.Close
              className={cn(
                // The same 44px close as the navigation drawer: this was a bare "✕" in a 27px box,
                // the smallest target on the screen.
                'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill',
                'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
              )}
              aria-label={t('common.close')}
            >
              <Icon name="x" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">{t(descriptionKey)}</Dialog.Description>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* As in `Modal`: a picker in here portals into the drawer. */}
            <DialogLayerProvider container={layer}>{children}</DialogLayerProvider>
          </div>

          {footer !== undefined && (
            <div className="shrink-0 border-t border-line px-4 py-3">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
