import { useEffect, type JSX, type ReactNode } from "react";
import { GLYPH, STEP_KEYS } from "@web/booking/constants";
import { t } from "@web/booking/i18n";
import { LanguageMenu } from "@web/booking/language-menu";
import { cx, Glyph, Img } from "@web/booking/ui";
import type { BookingLanguage } from "@web/booking/use-booking-language";

export function PageShell({
  clinicName,
  logoUrl,
  children,
  inline = false,
  language,
}: {
  readonly clinicName: string | undefined;
  readonly logoUrl?: string | null;
  readonly children: ReactNode;
  readonly inline?: boolean;
  readonly language?: BookingLanguage | undefined;
}): JSX.Element {
  const name = clinicName ?? t("page.title");

  useDocumentTitle(clinicName, inline);

  if (inline) {
    return (
      <div data-testid="booking-shell" data-part="inline" className="flex flex-col">
        <div data-testid="booking-main">{children}</div>
      </div>
    );
  }

  return (
    <div data-testid="booking-shell" className="flex min-h-full flex-col">
      <header
        data-testid="booking-header"
        className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-5"
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
        <LanguageMenu language={language} />
      </header>

      <main data-testid="booking-main" className="mx-auto w-full max-w-[480px] flex-1 px-4 pb-6">
        {children}
      </main>
    </div>
  );
}

function useDocumentTitle(clinicName: string | undefined, inline: boolean): void {
  useEffect(() => {
    if (inline) {
      return;
    }

    document.title =
      clinicName === undefined ? t("page.title") : `${t("page.title")} — ${clinicName}`;
  }, [clinicName, inline]);
}

export function BookingBoard({
  clinicName,
  logoUrl,
  phone,
  inline,
  current,
  screen,
  direction,
  onStep,
  choices,
  panel,
  bar,
  language,
}: {
  readonly clinicName: string;
  readonly logoUrl: string | null | undefined;
  readonly phone: string | null;
  readonly inline: boolean;
  readonly current: number;
  readonly screen: 1 | 2 | 3;
  readonly direction: "forward" | "back";
  readonly onStep?: ((step: number) => void) | undefined;
  readonly choices: ReactNode;
  readonly panel: ReactNode;
  readonly bar?: ReactNode;
  readonly language?: BookingLanguage | undefined;
}): JSX.Element {
  useDocumentTitle(clinicName, inline);

  const grid = (
    <div
      data-testid="booking-board"
      className={cx(
        "mx-auto flex w-full max-w-6xl flex-col items-start gap-6 lg:flex-row",
        !inline && "relative -mt-16 px-4 pb-28 lg:pb-10",
      )}
    >
      <div
        data-testid="booking-choices"
        className={cx("flex w-full min-w-0 flex-1 flex-col gap-5", screen === 3 && "max-lg:hidden")}
      >
        {choices}
      </div>
      <aside
        id="booking-panel"
        data-testid="booking-panel"
        aria-labelledby="booking-panel-title"
        data-direction={direction}
        className={cx(
          "booking-screen w-full shrink-0 scroll-mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-float lg:sticky lg:top-[calc(var(--site-sticky-top,0rem)+1.5rem)] lg:w-96",
          screen < 3 && "max-lg:hidden",
        )}
      >
        {panel}
      </aside>
    </div>
  );

  if (inline) {
    return (
      <div
        data-testid="booking-shell"
        data-part="inline"
        className="flex flex-col gap-6 max-lg:pb-24"
      >
        <StepPills current={current} onStep={onStep} tone="light" />
        {grid}
        {bar}
      </div>
    );
  }

  return (
    <div data-testid="booking-shell" className="flex min-h-full flex-col bg-canvas">
      <header data-testid="booking-header" className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {logoUrl !== null && logoUrl !== undefined && (
            <Img src={logoUrl} alt="" width={104} height={44} priority data-testid="booking-logo" />
          )}
          <span
            data-testid="booking-clinic-name"
            className="text-value font-bold tracking-[-0.02em] text-primary-900"
          >
            {clinicName}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <LanguageMenu language={language} />
            {phone && (
              <a
                href={`tel:${phone}`}
                data-testid="booking-phone"
                className="pill-text inline-flex min-h-(--control-h) items-center rounded-pill bg-canvas px-3 text-label font-medium text-ink-muted hover:text-primary-800"
              >
                <bdi dir="ltr">{phone}</bdi>
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="bg-primary-900 text-ink-inverse">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pt-7 pb-24">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-headline font-bold">{t("board.title")}</h1>
            <p className="text-value text-ink-inverse/80">{t("board.subtitle")}</p>
          </div>
          <StepPills current={current} onStep={onStep} tone="dark" />
        </div>
      </section>

      <main data-testid="booking-main" className="flex-1">
        {grid}
      </main>
      {bar}
    </div>
  );
}

function StepPills({
  current,
  onStep,
  tone,
}: {
  readonly current: number;
  readonly onStep?: ((step: number) => void) | undefined;
  readonly tone: "light" | "dark";
}): JSX.Element {
  return (
    <ol
      data-testid="booking-stepper"
      aria-label={t("steps.counter", { current, total: STEP_KEYS.length })}
      className="flex scroll-mt-4 flex-wrap gap-2"
    >
      {STEP_KEYS.map((key, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        const reachable = done && onStep !== undefined;

        return (
          <li key={key} className="flex">
            <button
              type="button"
              data-testid={`booking-step-${number}`}
              data-state={done ? "done" : active ? "current" : "next"}
              {...(active && { "aria-current": "step" as const })}
              {...(!reachable && { "aria-disabled": true })}
              onClick={() => {
                if (reachable) {
                  onStep(number);
                }
              }}
              className={cx(
                "pill-text inline-flex min-h-(--control-h) items-center gap-2 rounded-pill border ps-1.5 pe-3.5 text-label font-medium transition-colors",
                reachable
                  ? cx(
                      "cursor-pointer",
                      tone === "dark"
                        ? "hover:bg-ink-inverse/25"
                        : "hover:border-primary-300 hover:bg-primary-100",
                    )
                  : "cursor-not-allowed",
                tone === "dark"
                  ? done || active
                    ? "border-ink-inverse/20 bg-ink-inverse/15 text-ink-inverse"
                    : "border-ink-inverse/15 text-ink-inverse/70"
                  : done || active
                    ? "border-primary-200 bg-primary-50 text-primary-900"
                    : "border-line bg-surface text-ink-muted",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "inline-flex size-6 items-center justify-center rounded-pill text-micro font-bold",
                  done || active
                    ? "bg-primary-600 text-ink-inverse"
                    : tone === "dark"
                      ? "bg-ink-inverse/10 text-ink-inverse"
                      : "bg-canvas text-ink-muted",
                )}
              >
                {done ? <Glyph path={GLYPH.check} weight={3} className="size-3.5" /> : number}
              </span>
              {t(key)}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function FullPageMessage({
  title,
  body,
  action,
  level = 1,
}: {
  readonly title: string;
  readonly body?: string;
  readonly action?: ReactNode;
  readonly level?: 1 | 2;
}): JSX.Element {
  const Heading = level === 2 ? "h2" : "h1";

  return (
    <div
      data-testid="booking-message"
      className="mt-10 flex flex-col items-center gap-3 text-center"
    >
      <Heading
        data-testid="booking-message-title"
        className="text-title font-medium text-primary-900"
      >
        {title}
      </Heading>
      {body && (
        <p data-testid="booking-message-body" className="text-value text-ink-muted">
          {body}
        </p>
      )}
      {action}
    </div>
  );
}
