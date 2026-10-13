import { useEffect, type JSX, type ReactNode } from "react";
import { STEP_KEYS } from "@web/booking/constants";
import { t } from "@web/booking/i18n";
import { Button, cx, Img } from "@web/booking/ui";

export function PageShell({
  clinicName,
  logoUrl,
  children,
  footer,
  inline = false,
}: {
  readonly clinicName: string | undefined;
  readonly logoUrl?: string | null;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly inline?: boolean;
}): JSX.Element {
  const name = clinicName ?? t("page.title");

  useEffect(() => {
    if (inline) {
      return;
    }

    document.title =
      clinicName === undefined ? t("page.title") : `${t("page.title")} — ${clinicName}`;
  }, [clinicName, inline]);

  if (inline) {
    return (
      <div data-testid="booking-shell" data-part="inline" className="flex flex-col">
        <div data-testid="booking-main">{children}</div>
        {footer && (
          <div data-testid="booking-footer" className="mt-4">
            {footer}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="booking-shell" className="flex min-h-full flex-col">
      <header
        data-testid="booking-header"
        className="flex items-center justify-center gap-2.5 px-4 py-5"
      >
        {logoUrl !== null && logoUrl !== undefined && (
          <Img src={logoUrl} alt="" width={32} height={32} priority data-testid="booking-logo" />
        )}
        <span
          data-testid="booking-clinic-name"
          className="text-value font-medium tracking-[-0.02em] text-ink"
        >
          {name}
        </span>
      </header>

      <main data-testid="booking-main" className="mx-auto w-full max-w-[480px] flex-1 px-4 pb-6">
        {children}
      </main>

      {footer && (
        <div
          data-testid="booking-footer"
          className={cx(
            "sticky bottom-0 z-10 border-t border-line bg-surface",
            "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div className="mx-auto w-full max-w-[480px]">{footer}</div>
        </div>
      )}
    </div>
  );
}

export function StepHeader({
  current,
  title,
  steps = STEP_KEYS,
  level = 1,
}: {
  readonly current: number;
  readonly title: string;
  readonly steps?: readonly string[];
  readonly level?: 1 | 2;
}): JSX.Element {
  const Heading = level === 1 ? "h1" : "h2";
  const progress = steps.length > 1 ? (current - 1) / (steps.length - 1) : 1;

  return (
    <div data-testid="booking-step-header" className="mb-5">
      <ol
        data-testid="booking-stepper"
        aria-label={t("steps.counter", { current, total: steps.length })}
        className="relative mb-5 flex justify-between"
      >
        <span
          aria-hidden
          className="absolute top-4 h-0.5 rounded-pill bg-neutral-200"
          style={{ insetInline: `calc(100% / ${steps.length} / 2)` }}
        >
          <span
            data-part="progress"
            className="booking-progress absolute inset-y-0 start-0 rounded-pill bg-primary-600"
            style={{ width: `${progress * 100}%` }}
          />
        </span>

        {steps.map((key, index) => {
          const number = index + 1;
          const state = number < current ? "done" : number === current ? "current" : "next";

          return (
            <li
              key={key}
              data-state={state}
              {...(state === "current" && { "aria-current": "step" as const })}
              className="relative z-10 flex flex-1 flex-col items-center gap-1.5 text-center"
            >
              <span
                className={cx(
                  "booking-step-dot pill-text inline-flex size-8 items-center justify-center rounded-pill border-2 text-label font-medium tabular-nums",
                  state === "next"
                    ? "border-neutral-200 bg-surface text-ink-subtle"
                    : "border-primary-600 bg-primary-600 text-ink-inverse",
                  state === "current" && "shadow-field-focus",
                )}
              >
                {state === "done" ? (
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  number
                )}
              </span>
              <span
                className={cx(
                  "text-micro font-medium transition-colors duration-300",
                  state === "next" ? "text-ink-subtle" : "text-primary-800",
                )}
              >
                {t(key)}
              </span>
            </li>
          );
        })}
      </ol>

      <p
        aria-live="polite"
        data-testid="booking-step-counter"
        className="text-label font-medium text-ink-muted"
      >
        {t("steps.counter", { current, total: steps.length })}
      </p>

      <Heading
        key={title}
        data-testid="booking-step-title"
        className="booking-step mt-1 text-title font-medium text-primary-900"
      >
        {title}
      </Heading>
    </div>
  );
}

export function FullPageMessage({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body?: string;
  readonly action?: ReactNode;
}): JSX.Element {
  return (
    <div
      data-testid="booking-message"
      className="mt-10 flex flex-col items-center gap-3 text-center"
    >
      <h1 data-testid="booking-message-title" className="text-title font-medium text-primary-900">
        {title}
      </h1>
      {body && (
        <p data-testid="booking-message-body" className="text-value text-ink-muted">
          {body}
        </p>
      )}
      {action}
    </div>
  );
}

interface StepAction {
  readonly testId: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

export function StepNav({
  back,
  next,
}: {
  readonly back?: StepAction;
  readonly next?: StepAction;
}): JSX.Element {
  return (
    <div data-testid="booking-step-nav" className="flex items-center justify-between gap-4">
      {back && (
        <Button
          variant="ghost"
          data-testid={back.testId}
          onClick={back.onClick}
          className="px-4 text-value"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 ltr:-scale-x-100"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          {t("common.back")}
        </Button>
      )}
      {next && (
        <Button
          data-testid={next.testId}
          disabled={next.disabled}
          onClick={next.onClick}
          className="ms-auto min-w-32 rounded-pill px-7 text-value shadow-nav-active"
        >
          {t("common.next")}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 ltr:-scale-x-100"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Button>
      )}
    </div>
  );
}
