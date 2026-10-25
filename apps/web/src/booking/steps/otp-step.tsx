import { foldDigits } from "@clinic/shared";
import { NOTIFICATION_CHANNEL, type NotificationChannel } from "@shared/enums";
import { Icon } from "@clinic/ui/components/icon";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type JSX,
  type KeyboardEvent,
} from "react";
import { t } from "@web/booking/i18n";
import { Alert, Button, cx } from "@web/booking/ui";

const LENGTH = 6;
const RESEND_SECONDS = 60;
const SKIP_SECONDS = 10;

const digitsOnly = (value: string): string => foldDigits(value).replace(/\D/g, "");

export function OtpStep({
  phone,
  channel,
  onVerify,
  onResend,
  onSkip,
  busy,
  error,
  attemptsLeft,
}: {
  readonly phone: string;
  readonly channel: NotificationChannel;
  readonly onVerify: (code: string) => void;
  readonly onResend: () => void;
  readonly onSkip: () => void;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly attemptsLeft: number;
}): JSX.Element {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: LENGTH }, () => ""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [skipIn, setSkipIn] = useState(SKIP_SECONDS);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setTimeout(() => setSeconds((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [seconds]);

  useEffect(() => {
    if (skipIn <= 0) {
      return;
    }

    const timer = setTimeout(() => setSkipIn((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [skipIn]);

  const code = digits.join("");

  const write = (next: string[]): void => {
    setDigits(next);

    const filled = next.join("");
    if (filled.length === LENGTH) {
      onVerify(filled);
    }
  };

  const setDigit = (index: number, value: string): void => {
    const typed = digitsOnly(value);

    if (typed.length > 1) {
      const next = [...digits];
      for (let offset = 0; offset < typed.length && index + offset < LENGTH; offset += 1) {
        next[index + offset] = typed[offset] ?? "";
      }

      boxes.current[Math.min(index + typed.length, LENGTH - 1)]?.focus();
      write(next);
      return;
    }

    const next = [...digits];
    next[index] = typed;
    write(next);

    if (typed && index < LENGTH - 1) {
      boxes.current[index + 1]?.focus();
    }
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      boxes.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      boxes.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < LENGTH - 1) {
      boxes.current[index + 1]?.focus();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const pasted = digitsOnly(event.clipboardData.getData("text")).slice(0, LENGTH);

    if (pasted) {
      event.preventDefault();
      const next = Array.from({ length: LENGTH }, (_unused, index) => pasted[index] ?? "");
      boxes.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
      write(next);
    }
  };

  return (
    <div data-testid="otp-step" className="flex flex-col gap-5">
      <div
        data-testid="otp-sent-to"
        className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-5 text-center shadow-card"
      >
        <span
          aria-hidden
          className={cx(
            "inline-flex size-12 items-center justify-center rounded-pill",
            channel === NOTIFICATION_CHANNEL.WHATSAPP
              ? "bg-success-50 text-success-700"
              : "bg-primary-50 text-primary-700",
          )}
        >
          <Icon
            name={channel === NOTIFICATION_CHANNEL.WHATSAPP ? "whatsapp" : "message"}
            size="md"
          />
        </span>
        <p className="text-value text-ink-muted">
          {t(channel === NOTIFICATION_CHANNEL.WHATSAPP ? "otp.sentWhatsapp" : "otp.sentSms")}
        </p>
        <span
          dir="ltr"
          className="pill-text inline-flex min-h-(--control-h-sm) items-center rounded-pill bg-canvas px-3 text-value font-bold tabular-nums text-ink"
        >
          {phone}
        </span>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="sr-only">{t("otp.inputLabel")}</legend>

        <div dir="ltr" className="flex justify-center gap-2 sm:gap-2.5">
          {digits.map((digit, index) => (
            <input
              key={index}
              data-testid={`otp-digit-${String(index)}`}
              ref={(element) => {
                boxes.current[index] = element;
              }}
              value={digit}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(index, event)}
              onPaste={onPaste}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={t("otp.digitLabel", { index: index + 1 })}
              className={cx(
                "aspect-[4/5] w-full max-w-14 min-w-0 rounded-field border-2 text-center text-title font-bold tabular-nums text-ink",
                "transition-[border-color,background-color,box-shadow] duration-150 outline-none",
                "focus:border-primary-600 focus:shadow-field-focus",
                error
                  ? "border-danger-500 bg-danger-50"
                  : digit
                    ? "border-primary-300 bg-primary-50"
                    : "border-line-strong bg-surface",
              )}
            />
          ))}
        </div>
      </fieldset>

      {error && <Alert data-testid="otp-error">{error}</Alert>}

      <Button
        full
        data-testid="otp-verify"
        busy={busy}
        disabled={code.length < LENGTH}
        onClick={() => onVerify(code)}
      >
        {t("otp.verify")}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-label text-ink-muted">
        <span>{t("otp.notArrived")}</span>
        {seconds > 0 ? (
          <span data-testid="otp-resend-timer" aria-live="polite" className="tabular-nums">
            {t("otp.resendIn", { seconds })}
          </span>
        ) : (
          <button
            type="button"
            data-testid="otp-resend"
            aria-disabled={attemptsLeft <= 0}
            onClick={() => {
              if (attemptsLeft <= 0) {
                return;
              }

              setSeconds(RESEND_SECONDS);
              setDigits(Array.from({ length: LENGTH }, () => ""));
              boxes.current[0]?.focus();
              onResend();
            }}
            className="cursor-pointer font-medium text-primary-700 underline-offset-4 hover:underline aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
          >
            {t("otp.resend")}
          </button>
        )}
      </div>

      <div
        data-testid="otp-skip"
        className="flex flex-col gap-3 rounded-card border border-dashed border-line-strong bg-canvas p-4"
      >
        <p className="text-label text-ink-muted">{t("otp.skipHint")}</p>
        <Button
          variant="secondary"
          full
          data-testid="otp-skip-button"
          busy={busy}
          disabled={skipIn > 0}
          onClick={onSkip}
        >
          {t("otp.skip")}
        </Button>
        {skipIn > 0 && (
          <p
            data-testid="otp-skip-timer"
            aria-live="polite"
            className="text-center text-meta text-ink-muted tabular-nums"
          >
            {t("otp.skipIn", { seconds: skipIn })}
          </p>
        )}
      </div>
    </div>
  );
}
