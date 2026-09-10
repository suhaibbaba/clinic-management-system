import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Select } from '@web/components/ui/select';
import '@web/i18n';

const OPTIONS = [
  { value: 'samer', label: 'د. سامر نصار' },
  { value: 'layla', label: 'د. ليلى حداد' },
];

function Host({ initial = '' }: { readonly initial?: string }): React.JSX.Element {
  const [value, setValue] = useState(initial);

  return (
    <>
      <Select
        id="doctor"
        aria-label="الطبيب"
        placeholder="كل الأطباء"
        options={OPTIONS}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

// Radix rather than the platform, because on a clinic's iPhone the native picker never opened — and
// a native picker cannot be regression-tested off the device.
describe('Select', () => {
  it('shows the placeholder while nothing is chosen', () => {
    render(<Host />);

    expect(screen.getByRole('combobox', { name: 'الطبيب' })).toHaveTextContent('كل الأطباء');
  });

  it('opens on a click and lists every option', async () => {
    render(<Host />);

    await userEvent.click(screen.getByRole('combobox', { name: 'الطبيب' }));

    const list = await screen.findByRole('listbox');
    expect(
      within(list)
        .getAllByRole('option')
        .map((row) => row.textContent),
    ).toEqual(['كل الأطباء', 'د. سامر نصار', 'د. ليلى حداد']);
  });

  it('hands the caller the chosen value as event.target.value', async () => {
    render(<Host />);

    await userEvent.click(screen.getByRole('combobox', { name: 'الطبيب' }));
    await userEvent.click(await screen.findByRole('option', { name: 'د. ليلى حداد' }));

    expect(screen.getByTestId('value')).toHaveTextContent('layla');
    expect(screen.getByRole('combobox', { name: 'الطبيب' })).toHaveTextContent('د. ليلى حداد');
  });

  it('goes back to nothing through the placeholder row', async () => {
    // Radix reserves the empty string for clearing a selection, so the "no choice" row travels
    // under a sentinel and comes back out as `''`.
    render(<Host initial="samer" />);

    await userEvent.click(screen.getByRole('combobox', { name: 'الطبيب' }));
    await userEvent.click(await screen.findByRole('option', { name: 'كل الأطباء' }));

    expect(screen.getByTestId('value')).toHaveTextContent('');
  });

  it('opens with the arrow keys and chooses with Enter', async () => {
    render(<Host />);

    screen.getByRole('combobox', { name: 'الطبيب' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByTestId('value')).toHaveTextContent('samer');
  });

  it('does not open while it is disabled', async () => {
    render(
      <Select id="d" aria-label="الطبيب" options={OPTIONS} value="" disabled onChange={() => {}} />,
    );

    const field = screen.getByRole('combobox', { name: 'الطبيب' });
    expect(field).toBeDisabled();

    await userEvent.click(field);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
