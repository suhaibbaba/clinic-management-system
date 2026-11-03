import { foldDigits } from "@clinic/shared";
import { NOTIFICATION_CHANNEL, type NotificationChannel } from "@shared/enums";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type JSX,
  type KeyboardEvent,
} from "react";
import { t } from "@web/booking/i18n";
import { GLYPH } from "@web/booking/constants";
import { Alert, Button, cx, Glyph } from "@web/booking/ui";

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
  const whatsapp = channel === NOTIFICATION_CHANNEL.WHATSAPP;

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
    <div data-testid="otp-step" className="flex flex-col gap-6">
      <div data-testid="otp-sent-to" className="flex flex-col items-center gap-3 pt-2 text-center">
        <span
          aria-hidden
          className={cx(
            "inline-flex size-16 items-center justify-center rounded-pill",
            whatsapp ? "bg-success-50 text-success-600" : "bg-primary-50 text-primary-600",
          )}
        >
          <Glyph
            path={whatsapp ? GLYPH.whatsapp : GLYPH.message}
            filled={whatsapp}
            className="size-8"
          />
        </span>
        <h3 className="text-heading font-bold text-primary-900">
          {t(whatsapp ? "otp.headingWhatsapp" : "otp.headingSms")}
        </h3>
        <p className="text-value text-ink-muted">
          {t(whatsapp ? "otp.sentWhatsapp" : "otp.sentSms")}{" "}
          <bdi dir="ltr" className="font-bold whitespace-nowrap text-ink tabular-nums">
            {phone}
          </bdi>
        </p>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="sr-only">{t("otp.inputLabel")}</legend>

        <div dir="ltr" className="flex justify-center gap-2">
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
                "h-14 w-full max-w-12 min-w-0 rounded-control border-[1.5px] text-center text-title font-bold text-ink tabular-nums",
                "transition-[border-color,background-color] duration-150 outline-none focus:border-primary-600 focus:bg-surface",
                error
                  ? "border-danger-600 bg-danger-50"
                  : digit
                    ? "border-primary-600 bg-primary-50"
                    : "border-line bg-surface hover:border-line-strong",
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

      <div className="flex flex-col items-center gap-1 text-center text-label">
        <span className="text-ink-muted">{t("otp.notArrived")}</span>
        {seconds > 0 ? (
          <span
            data-testid="otp-resend-timer"
            aria-live="polite"
            className="text-ink-subtle tabular-nums"
          >
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
            className="cursor-pointer font-medium text-primary-700 underline-offset-4 hover:underline aria-disabled:cursor-not-allowed aria-disabled:text-ink-subtle"
          >
            {t("otp.resend")}
          </button>
        )}
      </div>

      <div data-testid="otp-skip" className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="text-center text-label text-ink-muted">{t("otp.skipHint")}</p>
        <Button
          variant="secondary"
          full
          data-testid="otp-skip-button"
          busy={busy}
          disabled={skipIn > 0}
          onClick={onSkip}
        >
          {skipIn > 0 ? t("otp.skipIn", { seconds: skipIn }) : t("otp.skip")}
        </Button>
      </div>
    </div>
  );
}
