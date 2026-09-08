import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Select } from '@web/components/ui/select';
import '@web/i18n';

const OPTIONS = [
  { value: 'samer', label: 'د. سامر نصار' },
  { value: 'layla', label: 'د. ليلى حداد' },
];

/**
 * jsdom has no layout, so `matchMedia` answers the breakpoint question
 * directly. Unstubbed it is absent, which the hook reads as "not mobile" — so
 * every other test in the suite keeps getting the native control.
 */
function setViewport(isMobile: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isMobile && query.includes('max-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function Host(): React.JSX.Element {
  const [value, setValue] = useState('');

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

describe('Select', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a native control on a pointer device', () => {
    setViewport(false);
    render(<Host />);

    const field = screen.getByRole('combobox');
    expect(field.tagName).toBe('SELECT');
    // Placeholder first, then the options in the order they were given.
    expect([...(field as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      '',
      'samer',
      'layla',
    ]);
  });

  /**
   * The reason this shape exists: on an iPhone the platform picker never came
   * up, on every screen, and a native picker is not part of the page — so it
   * can be neither reproduced nor regression-tested off the device. Below the
   * breakpoint the choice is ordinary DOM instead, and this is the test that a
   * browser can actually run.
   */
  it('opens the app’s own sheet on a narrow screen, and picks from it', async () => {
    setViewport(true);
    render(<Host />);

    const field = screen.getByRole('button', { name: 'الطبيب' });
    expect(field.tagName).toBe('BUTTON');
    expect(field).toHaveTextContent('كل الأطباء');

    await userEvent.click(field);

    // Every option, and the placeholder as the way back to "no choice".
    const sheet = await screen.findByRole('list', { name: 'الطبيب' });
    expect(sheet).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'د. ليلى حداد' }));

    // The same `event.target.value` a caller reads off the native control.
    expect(screen.getByTestId('value')).toHaveTextContent('layla');
    expect(screen.getByRole('button', { name: 'الطبيب' })).toHaveTextContent('د. ليلى حداد');
  });

  it('can be put back to the placeholder', async () => {
    setViewport(true);
    render(<Host />);

    await userEvent.click(screen.getByRole('button', { name: 'الطبيب' }));
    await userEvent.click(screen.getByRole('button', { name: 'د. سامر نصار' }));
    expect(screen.getByTestId('value')).toHaveTextContent('samer');

    await userEvent.click(screen.getByRole('button', { name: 'الطبيب' }));
    await userEvent.click(screen.getByRole('button', { name: 'كل الأطباء' }));

    expect(screen.getByTestId('value')).toHaveTextContent('');
  });

  it('does not open while it is disabled', async () => {
    setViewport(true);
    render(
      <Select id="d" aria-label="الطبيب" options={OPTIONS} value="" disabled onChange={() => {}} />,
    );

    const field = screen.getByRole('button', { name: 'الطبيب' });
    expect(field).toBeDisabled();

    await userEvent.click(field);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
