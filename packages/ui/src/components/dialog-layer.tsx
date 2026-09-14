import { createContext, useContext, type JSX, type ReactNode } from 'react';

// Radix Dialog makes the rest of the page inert, so a popover portalled to `document.body` renders
// and swallows every click. A dialog publishes its content node here for popovers beneath it.
const DialogLayerContext = createContext<HTMLElement | null>(null);

export function DialogLayerProvider({
  container,
  children,
}: {
  readonly container: HTMLElement | null;
  readonly children: ReactNode;
}): JSX.Element {
  return <DialogLayerContext.Provider value={container}>{children}</DialogLayerContext.Provider>;
}

export function useDialogLayer(): HTMLElement | null {
  return useContext(DialogLayerContext);
}
