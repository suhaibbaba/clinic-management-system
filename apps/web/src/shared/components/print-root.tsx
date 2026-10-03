import type { JSX, ReactNode } from "react";
import { createPortal } from "react-dom";

export function PrintRoot({
  children,
  "data-testid": testId,
}: {
  readonly children: ReactNode;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  return createPortal(
    <div data-testid={testId} className="print-root">
      {children}
    </div>,
    document.body,
  );
}
