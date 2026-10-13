import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { cx } from "@web/booking/ui";

export function SiteImage({
  src,
  alt = "",
  className,
  fit = "cover",
  layer = false,
  wash = true,
  priority = false,
  fallback,
  "data-testid": testId,
}: {
  readonly src: string | null | undefined;
  readonly alt?: string;
  readonly className?: string;
  readonly fit?: "cover" | "contain" | "top";
  readonly layer?: boolean;
  readonly wash?: boolean;
  readonly priority?: boolean;
  readonly fallback?: ReactNode;
  readonly "data-testid"?: string;
}): JSX.Element {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const current = image.current;

    setState(current?.complete && current.naturalWidth > 0 ? "loaded" : "loading");
  }, [src]);

  const showImage = Boolean(src) && state !== "failed";

  return (
    <div
      data-testid={testId}
      data-state={showImage ? state : "empty"}
      className={cx(
        "overflow-hidden",
        layer ? "absolute inset-0" : "relative",
        wash && "bg-primary-50 site-panel-wash",
        className,
      )}
    >
      {showImage && state === "loading" && (
        <span aria-hidden className="skeleton absolute inset-0 rounded-none" />
      )}

      {showImage ? (
        <img
          ref={image}
          src={src ?? undefined}
          alt={alt}
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          {...(priority ? { loading: "eager", fetchPriority: "high" } : { loading: "lazy" })}
          className={cx(
            "absolute inset-0 size-full transition-[opacity,scale] duration-500 ease-out",
            fit === "contain" ? "object-contain" : "object-cover",
            fit === "top" && "object-top",
            state === "loaded" ? "scale-100 opacity-100" : "scale-[1.02] opacity-0",
          )}
        />
      ) : (
        <div
          aria-hidden
          className="site-placeholder absolute inset-0 flex items-center justify-center text-primary-300"
        >
          {fallback}
        </div>
      )}
    </div>
  );
}
