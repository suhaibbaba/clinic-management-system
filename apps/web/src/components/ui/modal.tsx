import * as Dialog from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@web/lib/cn';
import { documentDirection } from '@web/lib/direction';

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
 *
 * **Nothing is focused when it opens.** Radix's default is to focus the first
 * focusable element, which put the caret in the first field of every dialog in
 * the app — a date field there would unfold its calendar over a form nobody had
 * touched, and a screen reader announced the field before the title that says
 * what the dialog is for. `onOpenAutoFocus` is prevented and the focus goes to
 * the dialog container instead, which keeps everything that matters: the trap
 * still holds, Escape still closes, and the first Tab reaches the first field
 * exactly as it would on a page.
 *
 * Fixed here rather than at each call site, so every dialog in the app inherits
 * it and a new one cannot forget.
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          // See the note above: no field is focused on open.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          // `-1` so the container can hold focus without entering the tab
          // order; the first Tab moves on to the first field.
          tabIndex={-1}
          // The dialog renders on `document.body`, so it inherits the page's
          // direction — but only as long as nothing pins it. It used to say
          // `rtl` outright, which left every form in the English UI with its
          // labels, its field icons and its button icons on the right.
          dir={documentDirection()}
          className={cn(
            // Physical centring: `translate-x` is not mirrored in RTL, so the
            // logical `start-*` variant would push the dialog off centre.
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            size === 'lg' ? 'max-w-2xl' : 'max-w-md',
            // Column layout so the body scrolls and the footer stays reachable.
            'flex max-h-[calc(100vh-4rem)] flex-col rounded-card bg-surface p-6 shadow-float',
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-ink">
            {t(title, titleValues ?? {})}
          </Dialog.Title>

          {description !== undefined ? (
            <Dialog.Description className="mt-1 text-label text-ink-muted">
              {t(description)}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">
              {t(title, titleValues ?? {})}
            </Dialog.Description>
          )}

          {/*
            The focus ring is 3px with a 2px offset (base.css), so a field
            flush against the edge of a scroll container has a fifth of its
            ring clipped — most visibly at 390px, where every field is
            full-width. The inner padding gives the ring its 5px and the
            matching negative margin keeps the content aligned with the title
            above it.
          */}
          <div className="-mx-1.5 mt-4 flex-1 overflow-y-auto px-1.5 py-1.5">{children}</div>

          {footer !== undefined && (
            <div className="mt-6 flex shrink-0 items-center justify-end gap-2 border-t border-line pt-5">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
