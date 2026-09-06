import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type JSX,
  type KeyboardEvent,
} from 'react';

import { t } from '@web/booking/i18n';
import { Alert, Button, cx } from '@web/booking/ui';

const LENGTH = 6;
const RESEND_SECONDS = 60;

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * Step four, OTP mode: the six digits that came by SMS.
 *
 * Six boxes rather than one field, because that is what every other code entry
 * on a phone looks like and because it makes "how many digits" answerable at a
 * glance. Everything that makes six boxes annoying is handled: pasting the
 * whole code into any box fills all of them, backspace on an empty box steps
 * back, the last digit submits without a tap, and each box tells a screen
 * reader which position it is.
 *
 * The code dies after three wrong guesses server-side, so the count below is a
 * report of the API's rule, never the rule itself.
 */
export function OtpStep({
  phone,
  onVerify,
  onResend,
  busy,
  error,
  attemptsLeft,
}: {
  readonly phone: string;
  readonly onVerify: (code: string) => void;
  readonly onResend: () => void;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly attemptsLeft: number;
}): JSX.Element {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: LENGTH }, () => ''));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus: the keyboard should already be up when the SMS arrives.
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

  const code = digits.join('');

  const write = (next: string[]): void => {
    setDigits(next);

    // Six characters after joining means six boxes with a digit in them: a
    // gap contributes nothing to the join, so a short string is a gap.
    const filled = next.join('');
    if (filled.length === LENGTH) {
      onVerify(filled);
    }
  };

  const setDigit = (index: number, value: string): void => {
    const typed = digitsOnly(value);

    // More than one digit in one box means a paste, or a keyboard that
    // inserted the whole code: spread it forward from here.
    if (typed.length > 1) {
      const next = [...digits];
      for (let offset = 0; offset < typed.length && index + offset < LENGTH; offset += 1) {
        next[index + offset] = typed[offset] ?? '';
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
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      boxes.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      boxes.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      boxes.current[index + 1]?.focus();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const pasted = digitsOnly(event.clipboardData.getData('text')).slice(0, LENGTH);

    if (pasted) {
      event.preventDefault();
      const next = Array.from({ length: LENGTH }, (_unused, index) => pasted[index] ?? '');
      boxes.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
      write(next);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-value text-ink-muted">
        {t('otp.sentTo', { phone: '' })}
        <span dir="ltr" className="bidi-auto font-medium text-ink">
          {phone}
        </span>
      </p>

      <fieldset className="border-0 p-0">
        <legend className="sr-only">{t('otp.inputLabel')}</legend>

        {/* LTR: a code is read left to right in every language. */}
        <div dir="ltr" className="flex justify-between gap-2">
          {digits.map((digit, index) => (
            <input
              // Positional and never reordered, so the index is the identity.
              key={index}
              ref={(element) => {
                boxes.current[index] = element;
              }}
              value={digit}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(index, event)}
              onPaste={onPaste}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              // Not `maxLength={1}`: a paste into a box must reach onChange
              // whole, or five of its six digits are silently dropped.
              aria-label={t('otp.digitLabel', { index: index + 1 })}
              className={cx(
                'h-14 w-full min-w-0 rounded-control border bg-surface text-center',
                'text-[1.25rem] font-semibold tabular-nums text-ink',
                error ? 'border-danger-500' : 'border-line-strong focus:border-primary-600',
              )}
            />
          ))}
        </div>
      </fieldset>

      {error && <Alert>{error}</Alert>}

      <Button full busy={busy} disabled={code.length < LENGTH} onClick={() => onVerify(code)}>
        {t('otp.verify')}
      </Button>

      {seconds > 0 ? (
        <p aria-live="polite" className="text-center text-label text-ink-muted">
          {t('otp.resendIn', { seconds })}
        </p>
      ) : (
        <Button
          variant="ghost"
          full
          disabled={attemptsLeft <= 0}
          onClick={() => {
            setSeconds(RESEND_SECONDS);
            setDigits(Array.from({ length: LENGTH }, () => ''));
            boxes.current[0]?.focus();
            onResend();
          }}
        >
          {t('otp.resend')}
        </Button>
      )}
    </div>
  );
}
