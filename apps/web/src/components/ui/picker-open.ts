import { useRef, useState, type KeyboardEvent } from 'react';

/**
 * The one key that opens a picker from its own text field.
 *
 * ArrowDown is the convention every combobox uses, and it is the only *key*
 * that can be added without taking something away: Enter belongs to the form
 * and Space belongs to the text being typed. Focus alone must never open
 * anything — a dialog handing focus to its first field would otherwise unfold
 * a calendar over a form nobody has touched, which is the bug this replaced.
 */
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
  /** True when the popover should take focus — see `PopoverSheet`. */
  readonly focusOnOpen: boolean;
  /**
   * Spread onto anything inside the anchor that should open the picker: the
   * field itself, and the button at the end of it.
   *
   * `takeFocus` is what separates the two. The button and ArrowDown are a
   * request for the picker, so it takes focus and the keyboard lands in it;
   * a click in the text field is somebody about to type a date, so the
   * calendar appears beside them and the caret stays where they put it.
   */
  opens(takeFocus: boolean): {
    onPointerDown: () => void;
    onClick: () => void;
  };
  /** Opens it and takes focus — for ArrowDown. */
  show(): void;
}

/**
 * Click opens a picker; clicking again closes it.
 *
 * The second half is why this is a hook rather than `setOpen(true)`. The field
 * *anchors* the popover rather than triggering it (see `PopoverSheet`), and
 * Radix treats an anchor as outside the layer: the pointer going down on it
 * dismisses an open popover before the click ever lands, so a plain
 * `onClick={() => setOpen(true)}` reopens what the same gesture just closed and
 * the picker cannot be shut by clicking the thing it belongs to. Remembering
 * what the state was when the pointer went down turns that back into a toggle.
 */
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
