import type { JSX, MouseEvent, ReactNode } from "react";

export function VendorLink({
  to,
  navigate,
  className,
  children,
  "data-testid": testId,
}: {
  readonly to: string;
  readonly navigate: (to: string) => void;
  readonly className?: string | undefined;
  readonly children: ReactNode;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={follow} className={className} data-testid={testId}>
      {children}
    </a>
  );
}
