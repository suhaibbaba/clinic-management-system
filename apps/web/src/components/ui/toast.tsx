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
            className={[
              'rounded-md px-4 py-3 text-sm shadow-lg ring-1',
              message.tone === 'success'
                ? 'bg-white text-gray-900 ring-gray-200'
                : 'bg-red-50 text-red-800 ring-red-200',
            ].join(' ')}
          >
            <ToastPrimitive.Description>
              {t(message.messageKey, message.values ?? {})}
            </ToastPrimitive.Description>
          </ToastPrimitive.Root>
        ))}

        {/* Bottom-start corner: mirrors to the right-hand side in RTL. */}
        <ToastPrimitive.Viewport className="fixed bottom-4 start-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
