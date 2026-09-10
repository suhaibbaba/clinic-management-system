import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Ltr } from '@web/components/ui/ltr';

// Both were found in screenshots: a `dir="ltr"` block resolves `text-align: start` against itself,
// not against the Arabic page around it.
describe('Ltr', () => {
  it('carries its own direction', () => {
    render(<Ltr>+963931000001</Ltr>);

    expect(screen.getByText('+963931000001')).toHaveAttribute('dir', 'ltr');
  });

  it('hugs its content rather than filling the line', () => {
    render(<Ltr>08/09/2026</Ltr>);

    const island = screen.getByText('08/09/2026');
    expect(island).toHaveClass('w-fit');
    expect(island).toHaveClass('inline-block');
    // An amount is one word: `200.00 USD` must never break across two lines.
    expect(island).toHaveClass('whitespace-nowrap');
  });

  it('renders as the element the layout needs', () => {
    render(
      <dl>
        <dt>Phone</dt>
        <Ltr as="dd">+963931000002</Ltr>
      </dl>,
    );

    expect(screen.getByText('+963931000002').tagName).toBe('DD');
  });
});
