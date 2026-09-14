import { useRef, useState, type KeyboardEvent } from 'react';

// ArrowDown is the only key that can be added without taking one away: Enter belongs to the form
// and Space to the text. Focus alone must never open anything.
export function openOnArrowDown(open: () => void) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'ArrowDown') {
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
  opens(takeFocus: boolean): {
    onPointerDown: () => void;
    onClick: () => void;
  };
  show(): void;
}

// The field anchors rather than triggers, and Radix dismisses on pointer-down, so a plain
// `setOpen(true)` reopens what the same click closed. The pointer-down state restores the toggle.
export function usePickerOpen(): PickerOpener {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(true);
  // What the popover's state was when this gesture started, read before Radix
  // has had a chance to dismiss it.
  const openAtPointerDown = useRef(false);

  const show = (takeFocus: boolean): void => {
    setFocusOnOpen(takeFocus);
    setOpen(true);
  };

  return {
    open,
    onOpenChange: setOpen,
    focusOnOpen,
    opens: (takeFocus) => ({
      onPointerDown: () => {
        openAtPointerDown.current = open;
      },
      onClick: () => {
        if (!openAtPointerDown.current) {
          show(takeFocus);
        }
      },
    }),
    show: () => show(true),
  };
}
