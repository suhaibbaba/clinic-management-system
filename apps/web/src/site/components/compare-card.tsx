import { useId, useState, type JSX } from "react";
import { SiteImage } from "@web/site/components/site-image";
import { useSite } from "@web/site/hooks/use-site";

export function CompareCard({
  before,
  after,
  title,
  "data-testid": testId,
}: {
  readonly before: string;
  readonly after: string;
  readonly title: string;
  readonly "data-testid": string;
}): JSX.Element {
  const { language, t } = useSite();
  const [split, setSplit] = useState(50);
  const slider = useId();
  const clipPath = language === "ar" ? `inset(0 ${100 - split}% 0 0)` : `inset(0 0 0 ${split}%)`;

  return (
    <figure
      data-testid={testId}
      className="flex flex-col gap-2 overflow-hidden rounded-card border border-line bg-surface p-2 shadow-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-panel has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary-600">
        <SiteImage src={before} layer alt={t("cases.beforeOf", { title })} />
        <div className="absolute inset-0" style={{ clipPath }}>
          <SiteImage src={after} layer alt={t("cases.afterOf", { title })} />
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-surface shadow-float"
          style={{ left: `${split}%` }}
        >
          <span className="absolute top-1/2 left-1/2 size-5 -translate-1/2 rounded-pill border-2 border-surface bg-primary-600" />
        </span>
        <span className="absolute start-2 bottom-2 rounded-pill bg-primary-900/80 px-2.5 py-0.5 text-micro font-medium text-ink-inverse">
          {t("cases.before")}
        </span>
        <span className="absolute end-2 bottom-2 rounded-pill bg-primary-600 px-2.5 py-0.5 text-micro font-medium text-ink-inverse">
          {t("cases.after")}
        </span>
        <label htmlFor={slider} className="sr-only">
          {t("cases.compare", { title })}
        </label>
        <input
          id={slider}
          type="range"
          dir="ltr"
          min={0}
          max={100}
          value={split}
          data-testid={`${testId}-split`}
          onChange={(event) => setSplit(Number(event.target.value))}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
      {title && (
        <figcaption className="px-2 pb-1 text-center text-label font-bold text-primary-900">
          {title}
        </figcaption>
      )}
    </figure>
  );
}
