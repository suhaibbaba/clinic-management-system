import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Ltr } from '@web/components/ui/ltr';

/**
 * The two things every number in this app depends on.
 *
 * Both were found by looking at screenshots rather than at code: a file number
 * under a patient's name sat on the opposite side of the card from the name,
 * and an appointment's time floated off the corner of its own chip — because a
 * `dir="ltr"` block resolves `text-align: start` against *itself*, not against
 * the Arabic page around it.
 */
describe('Ltr', () => {
  it('carries its own direction', () => {
    render(<Ltr>+963931000001</Ltr>);

    expect(screen.getByText('+963931000001')).toHaveAttribute('dir', 'ltr');
  });

  it('hugs its content rather than filling the line', () => {
    render(<Ltr>08/09/2026</Ltr>);

    // `w-fit` is what stops a flex column stretching the island back to full
    // width and handing it its own start edge; `inline-block` is what lets the
    // parent's own alignment place it.
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
