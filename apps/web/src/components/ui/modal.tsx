import * as Dialog from '@radix-ui/react-dialog';
import { useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DialogLayerProvider } from '@web/components/ui/dialog-layer';
import { cn } from '@web/lib/cn';
import { documentDirection } from '@web/lib/direction';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Numbers stay numbers: i18next only pluralises on a numeric `count`, and Arabic has six forms. */
  titleValues?: Record<string, string | number> | undefined;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  size?: 'md' | 'lg' | undefined;
}

// Nothing is focused when it opens: Radix's default put a caret in every dialog's first field,
// unfolding a date picker over an untouched form. The trap and Escape are unchanged.
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
  // State rather than a ref: a popover beneath this dialog has to re-render
  // once the node exists, and a ref would not tell it.
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
          // `-1` so the container can hold focus without entering the tab
          // order; the first Tab moves on to the first field.
          tabIndex={-1}
          // It renders on `document.body` and inherits the page's direction — it used to say `rtl`
          // outright, which put every English form's labels and icons on the right.
          dir={documentDirection()}
          className={cn(
            // Physical centring: `translate-x` is not mirrored in RTL, so the
            // logical `start-*` variant would push the dialog off centre.
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            size === 'lg' ? 'max-w-2xl' : 'max-w-md',
            // Column layout so the body scrolls and the footer stays reachable.
            'flex max-h-[calc(100vh-4rem)] flex-col rounded-card border border-line bg-surface p-5 shadow-float',
          )}
        >
          <Dialog.Title className="text-section font-medium text-ink">
            {t(title, titleValues ?? {})}
          </Dialog.Title>

          {description !== undefined ? (
            <Dialog.Description className="mt-1 text-meta text-ink-muted">
              {t(description)}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">
              {t(title, titleValues ?? {})}
            </Dialog.Description>
          )}

          {/* The focus ring is 2px with a 2px offset, so a field flush against a scroll container's
              edge is clipped; the inner padding and negative margin give it room. */}
          <div className="-mx-1.5 mt-4 flex-1 overflow-y-auto px-1.5 py-1.5">
            {/* Date and time pickers inside a dialog portal into it rather than
                into the inert body — see `DialogLayerProvider`. */}
            <DialogLayerProvider container={layer}>{children}</DialogLayerProvider>
          </div>

          {footer !== undefined && (
            <div className="mt-5 flex shrink-0 items-center justify-end gap-2 border-t border-line pt-4">
              <DialogLayerProvider container={layer}>{footer}</DialogLayerProvider>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
