import { createContext, useContext, type JSX, type ReactNode } from 'react';

/**
 * The element a popover opened *inside a dialog* must portal into.
 *
 * Radix Dialog makes the rest of the page inert while it is open — `RemoveScroll`
 * puts `pointer-events: none` on the body and the focus scope keeps focus in
 * the dialog. A popover that portals to `document.body`, which is what
 * `PopoverSheet` does everywhere else, lands in that inert layer: the calendar
 * renders, and every click on it goes nowhere. The date range picker in the
 * "add a closure" dialog was exactly this — a calendar you could see and could
 * not use.
 *
 * So a dialog publishes its own content node here, and a popover rendered
 * beneath one portals into that instead of into the body. Outside a dialog the
 * value is null and nothing changes.
 *
 * A context rather than a prop threaded through every field: the popover is
 * three or four components below the dialog that opens it, and a prop that has
 * to be passed at each step is a prop somebody will forget on the fifth field.
 */
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

/** The dialog to portal into, or null when there is no dialog above us. */
export function useDialogLayer(): HTMLElement | null {
  return useContext(DialogLayerContext);
}
