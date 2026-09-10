import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The control is Radix's, so `userEvent.selectOptions` does not apply: it is a button opening a
// listbox, and the listbox portals out of the form.
export async function choose(field: HTMLElement, label: string | RegExp): Promise<void> {
  await userEvent.click(field);
  await userEvent.click(await screen.findByRole('option', { name: label }));
}
