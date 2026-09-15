import * as ToastPrimitive from '@radix-ui/react-toast';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@ui/components/icon';
import { cn } from '@ui/lib/cn';
import { documentDirection } from '@ui/lib/direction';

type ToastTone = 'success' | 'error';

/** Four seconds: long enough to read a line, short enough not to sit over the next thing done. */
const TOAST_MS = 4000;

interface ToastMessage {
  readonly id: number;
  readonly messageKey: string;
  readonly values?: Record<string, string | number>;
  readonly tone: ToastTone;
}

interface ToastApi {
  /** Both take an i18n key — never a ready-made string. */
  success: (messageKey: string, values?: Record<string, string | number>) => void;
  error: (messageKey: string, values?: Record<string, string | number>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const push = useCallback(
    (messageKey: string, tone: ToastTone, values?: Record<string, string | number>) => {
      setMessages((current) => [
        ...current,
        { id: Date.now() + current.length, messageKey, tone, ...(values && { values }) },
      ]);
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (messageKey, values) => push(messageKey, 'success', values),
      error: (messageKey, values) => push(messageKey, 'error', values),
    }),
    [push],
  );

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {/* Swiped towards the nearest edge, which for a toast in the top end corner is the end one. */}
      <ToastPrimitive.Provider
        swipeDirection={documentDirection() === 'rtl' ? 'left' : 'right'}
        duration={TOAST_MS}
      >
        {children}

        {messages.map((message) => (
          <ToastPrimitive.Root
            key={message.id}
            data-part="toast"
            open
            onOpenChange={(open) => {
              if (!open) {
                dismiss(message.id);
              }
            }}
            className={cn(
              'group relative flex items-start gap-2.5 overflow-hidden rounded-panel border border-line bg-surface',
              'border-s-4 px-4 py-3 text-value shadow-float',
              'data-[state=open]:animate-[toast-in_200ms_ease-out]',
              'data-[state=closed]:animate-[toast-out_150ms_ease-in]',
              'data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)',
              message.tone === 'success' ? 'border-s-success-500' : 'border-s-danger-500',
            )}
          >
            <Icon
              name={message.tone === 'success' ? 'check' : 'error'}
              className={cn(
                'mt-0.5',
                message.tone === 'success' ? 'text-success-600' : 'text-danger-600',
              )}
            />

            <ToastPrimitive.Description data-part="toast-message" className="flex-1 text-ink">
              {t(message.messageKey, message.values ?? {})}
            </ToastPrimitive.Description>

            <ToastPrimitive.Close
              data-part="toast-close"
              aria-label={t('common.close')}
              className={cn(
                'inline-grid size-(--control-h-sm) shrink-0 cursor-pointer place-items-center',
                'rounded-control text-ink-subtle',
                'transition-colors duration-150 hover:bg-inset hover:text-ink',
              )}
            >
              <Icon name="x" className="size-4" />
            </ToastPrimitive.Close>

            {/* The time left. A pointer over the toast does not pause the countdown, it restarts it
                — so the line is dropped while hovered and runs again from full on the way out. */}
            <span
              data-part="toast-life"
              aria-hidden="true"
              style={{ animationDuration: `${TOAST_MS}ms` }}
              className={cn(
                'absolute inset-x-0 bottom-0 h-0.5 origin-left animate-[toast-life_linear_forwards]',
                'page-rtl:origin-right group-hover:animate-none',
                message.tone === 'success' ? 'bg-success-500' : 'bg-danger-500',
              )}
            />
          </ToastPrimitive.Root>
        ))}

        {/* The top end corner — the right in English, the left in Arabic — clear of the bar's own
            buttons and of anything a hand covers on a phone. */}
        <ToastPrimitive.Viewport
          data-part="toast-viewport"
          className="fixed top-4 end-4 z-[60] flex w-80 max-w-[calc(100dvw-2rem)] flex-col gap-2 outline-none"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
