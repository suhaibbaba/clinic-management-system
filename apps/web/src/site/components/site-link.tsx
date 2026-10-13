import type { AnchorHTMLAttributes, JSX, MouseEvent } from "react";
import { useSite } from "@web/site/hooks/use-site";

export function SiteLink({
  to,
  params,
  onClick,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  readonly to: string;
  readonly params?: Record<string, string>;
}): JSX.Element {
  const { href, navigate } = useSite();
  const target = href(to, params);

  return (
    <a
      {...rest}
      href={target}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        navigate(target);
      }}
    />
  );
}
