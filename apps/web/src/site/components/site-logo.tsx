import { useId, useState, type JSX } from "react";
import { cx } from "@web/booking/ui";

function InverseInk({ id }: { readonly id: string }): JSX.Element {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -0.51 -1.72 -0.17 2.4 0"
          result="ink"
        />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.7 5.72 0.58 -3.8 0"
          result="light"
        />
        <feFlood style={{ floodColor: "var(--color-primary-500)" }} result="accent" />
        <feComposite in="accent" in2="light" operator="in" result="lightInk" />
        <feComposite in="lightInk" in2="ink" operator="atop" />
      </filter>
    </svg>
  );
}

export function SiteLogo({
  url,
  name,
  size = "header",
}: {
  readonly url: string | null;
  readonly name: string;
  readonly size?: "header" | "footer";
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  const ink = useId();
  const footer = size === "footer";

  if (url && !failed) {
    return (
      <>
        {footer && <InverseInk id={ink} />}
        <img
          src={url}
          alt={name}
          width={200}
          height={88}
          data-testid={footer ? "site-footer-logo" : "site-logo"}
          onError={() => setFailed(true)}
          {...(footer && { style: { filter: `url("#${ink}")` } })}
          className={
            footer
              ? "h-16 w-auto max-w-60 object-contain sm:h-20 lg:h-16 xl:h-20"
              : "h-12 w-auto max-w-full min-w-0 object-contain lg:h-14"
          }
        />
      </>
    );
  }

  return (
    <span
      data-testid={footer ? "site-footer-logo-fallback" : "site-logo-fallback"}
      className="flex min-w-0 items-center gap-2.5"
    >
      <span
        aria-hidden
        className="pill-text inline-flex size-11 shrink-0 items-center justify-center rounded-brand bg-primary-600 text-heading font-bold text-ink-inverse"
      >
        {name.slice(0, 1)}
      </span>
      <span
        className={cx(
          "truncate text-section font-bold lg:text-heading",
          footer ? "text-ink-inverse" : "text-primary-900",
        )}
      >
        {name}
      </span>
    </span>
  );
}
