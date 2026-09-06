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

import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';

type ToastTone = 'success' | 'error';

interface ToastMessage {
  readonly id: number;
  /** i18n key. */
  readonly messageKey: string;
  readonly values?: Record<string, string>;
  readonly tone: ToastTone;
}

interface ToastApi {
  /** Both take an i18n key — never a ready-made string. */
  success: (messageKey: string, values?: Record<string, string>) => void;
  error: (messageKey: string, values?: Record<string, string>) => void;
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
    (messageKey: string, tone: ToastTone, values?: Record<string, string>) => {
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
      <ToastPrimitive.Provider swipeDirection="left" duration={5000}>
        {children}

        {messages.map((message) => (
          <ToastPrimitive.Root
            key={message.id}
            open
            onOpenChange={(open) => {
              if (!open) {
                dismiss(message.id);
              }
            }}
            className={cn(
              // The accent bar is a border on the start edge, so it mirrors
              // with the language along with everything else.
              'flex items-start gap-2.5 overflow-hidden rounded-panel border-s-4 bg-surface',
              'px-4 py-3 text-value shadow-float',
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

            <ToastPrimitive.Description className="flex-1 text-ink">
              {t(message.messageKey, message.values ?? {})}
            </ToastPrimitive.Description>

            <ToastPrimitive.Close
              aria-label={t('common.close')}
              className={cn(
                'shrink-0 cursor-pointer rounded-control p-1 text-ink-subtle',
                'transition-colors duration-150 hover:bg-inset hover:text-ink',
              )}
            >
              <Icon name="x" className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}

        {/* Bottom-start corner: mirrors to the right-hand side in RTL. */}
        <ToastPrimitive.Viewport className="fixed bottom-4 start-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
