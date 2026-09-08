import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Pick a row from a `Select`, by the words on it.
 *
 * The control is Radix's rather than a native `<select>`, so
 * `userEvent.selectOptions` does not apply to it: it is a button that opens a
 * listbox, and choosing is two clicks. The listbox portals out of the form it
 * belongs to, which is why the row is looked up on the whole screen rather
 * than inside the dialog.
 *
 * Written once here so a test can say what it means instead of how the widget
 * happens to be built.
 */
export async function choose(field: HTMLElement, label: string | RegExp): Promise<void> {
  await userEvent.click(field);
  await userEvent.click(await screen.findByRole('option', { name: label }));
}
