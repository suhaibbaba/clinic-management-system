import * as ToastPrimitive from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { Icon, type IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { documentDirection } from "@ui/lib/direction";

type ToastTone = "success" | "warning" | "error";

const TONES: Record<ToastTone, { chip: string; tint: string; line: string; icon: IconName }> = {
  success: {
    chip: "bg-success-600",
    tint: "[--toast-tint:var(--color-success-100)]",
    line: "bg-success-500",
    icon: "check",
  },
  warning: {
    chip: "bg-warning-500",
    tint: "[--toast-tint:var(--color-warning-100)]",
    line: "bg-warning-500",
    icon: "alert",
  },
  error: {
    chip: "bg-danger-600",
    tint: "[--toast-tint:var(--color-danger-100)]",
    line: "bg-danger-500",
    icon: "x",
  },
};

/** Four seconds: long enough to read a line, short enough not to sit over the next thing done. */
const TOAST_MS = 2500;

interface ToastMessage {
  readonly id: number;
  readonly messageKey: string;
  readonly values?: Record<string, string | number>;
  /** A second line under the title, where one sentence does not carry it. */
  readonly descriptionKey?: string;
  readonly tone: ToastTone;
}

type Values = Record<string, string | number>;
type Notify = (messageKey: string, values?: Values, descriptionKey?: string) => void;

interface ToastApi {
  /** Each takes an i18n key — never a ready-made string. */
  success: Notify;
  warning: Notify;
  error: Notify;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const push = useCallback(
    (messageKey: string, tone: ToastTone, values?: Values, descriptionKey?: string) => {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + current.length,
          messageKey,
          tone,
          ...(values && { values }),
          ...(descriptionKey !== undefined && { descriptionKey }),
        },
      ]);
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (messageKey, values, description) =>
        push(messageKey, "success", values, description),
      warning: (messageKey, values, description) =>
        push(messageKey, "warning", values, description),
      error: (messageKey, values, description) => push(messageKey, "error", values, description),
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
        swipeDirection={documentDirection() === "rtl" ? "left" : "right"}
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
              // One line sits in the middle of the chip; two lines start level with its top.
              "group relative flex gap-3 overflow-hidden rounded-card border border-line",
              message.descriptionKey === undefined ? "items-center" : "items-start",
              "toast-wash px-4 py-3.5 shadow-float",
              TONES[message.tone].tint,
              "data-[state=open]:animate-[toast-in_200ms_ease-out]",
              "data-[state=closed]:animate-[toast-out_150ms_ease-in]",
              "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
            )}
          >
            <span
              data-part="toast-chip"
              aria-hidden="true"
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-pill text-ink-inverse",
                message.descriptionKey !== undefined && "mt-0.5",
                TONES[message.tone].chip,
              )}
            >
              <Icon name={TONES[message.tone].icon} className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title
                data-part="toast-title"
                className="text-value font-medium text-ink"
              >
                {t(message.messageKey, message.values ?? {})}
              </ToastPrimitive.Title>

              {message.descriptionKey !== undefined && (
                <ToastPrimitive.Description
                  data-part="toast-message"
                  className="mt-0.5 text-label text-ink-muted"
                >
                  {t(message.descriptionKey, message.values ?? {})}
                </ToastPrimitive.Description>
              )}
            </div>

            <ToastPrimitive.Close
              data-part="toast-close"
              aria-label={t("common.close")}
              className={cn(
                "inline-grid size-(--control-h-sm) shrink-0 cursor-pointer place-items-center",
                "rounded-control text-ink-subtle",
                "transition-colors duration-[250ms] ease-in-out hover:bg-inset hover:text-ink",
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
                // Grown from the side reading starts on: in Arabic it fills from the right, in
                // English from the left.
                "absolute inset-x-0 bottom-0 h-0.5 animate-[toast-life_linear_forwards]",
                "page-rtl:origin-right page-ltr:origin-left group-hover:animate-none",
                TONES[message.tone].line,
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
