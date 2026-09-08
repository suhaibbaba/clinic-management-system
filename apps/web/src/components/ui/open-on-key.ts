import type { KeyboardEvent } from 'react';

/**
 * The one key that opens a picker from its own text field.
 *
 * ArrowDown is the convention every combobox uses, and it is the only one that
 * can be added here without taking something away: Enter belongs to the form,
 * Space belongs to the text being typed, and focus alone must never open
 * anything — a dialog handing focus to its first field would otherwise unfold
 * a calendar over a form nobody has touched.
 *
 * The picker's own button covers click, Enter and Space, because it is a
 * button; this is what makes the field itself reachable without one.
 */
export function openOnArrowDown(open: () => void) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open();
    }
  };
}
