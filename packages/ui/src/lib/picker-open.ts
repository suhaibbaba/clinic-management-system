import { useState, type KeyboardEvent } from "react";

// ArrowDown is the only key that can be added without taking one away: Enter belongs to the form
// and Space to the text. Focus alone must never open anything.
export function openOnArrowDown(open: () => void) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open();
    }
  };
}

export interface PickerOpener {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly focusOnOpen: boolean;
  // `takeFocus` separates the two: the button and ArrowDown ask for the picker, while a click in
  // the text field means somebody is about to type.
  opens(takeFocus: boolean): { onClick: () => void };
  show(): void;
}

export function usePickerOpen(): PickerOpener {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(true);

  const show = (takeFocus: boolean): void => {
    setFocusOnOpen(takeFocus);
    setOpen(true);
  };

  return {
    open,
    onOpenChange: setOpen,
    focusOnOpen,
    opens: (takeFocus) => ({
      onClick: () => {
        if (open) {
          setOpen(false);
          return;
        }

        show(takeFocus);
      },
    }),
    show: () => show(true),
  };
}
