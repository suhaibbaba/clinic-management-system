import { useState, type JSX } from "react";

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

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        width={200}
        height={88}
        data-testid="site-logo"
        onError={() => setFailed(true)}
        className={
          size === "footer"
            ? "h-16 w-auto max-w-60 shrink-0 object-contain"
            : "h-12 w-auto max-w-52 shrink-0 object-contain lg:h-14"
        }
      />
    );
  }

  return (
    <span data-testid="site-logo-fallback" className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="pill-text inline-flex size-11 shrink-0 items-center justify-center rounded-brand bg-primary-600 text-heading font-bold text-ink-inverse"
      >
        {name.slice(0, 1)}
      </span>
      <span className="truncate text-section font-bold text-primary-900 lg:text-heading">
        {name}
      </span>
    </span>
  );
}
