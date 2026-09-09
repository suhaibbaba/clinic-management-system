import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmailLink, PhoneLink } from '@web/components/ui/contact-link';

describe('PhoneLink', () => {
  it('dials the number and shows it exactly as it was entered', () => {
    render(<PhoneLink value="+970 59-900 0001" />);

    const link = screen.getByRole('link', { name: '+970 59-900 0001' });

    // The dialler gets digits and a plus; the screen keeps the spacing
    // reception reads out loud.
    expect(link).toHaveAttribute('href', 'tel:+970599000001');
  });

  it('stays a left-to-right island, so a leading plus does not drift', () => {
    render(<PhoneLink value="+970599000001" />);

    expect(screen.getByRole('link')).toHaveAttribute('dir', 'ltr');
  });

  it('draws a dash rather than an empty link when there is no number', () => {
    render(<PhoneLink value={null} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('treats blank as absent — a link to `tel:` dials nothing', () => {
    render(<PhoneLink value="   " />);

    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('EmailLink', () => {
  it('opens a message to the address', () => {
    render(<EmailLink value="reception@clinic.ps" />);

    expect(screen.getByRole('link', { name: 'reception@clinic.ps' })).toHaveAttribute(
      'href',
      'mailto:reception@clinic.ps',
    );
  });

  it('falls back to a dash when a user has no address', () => {
    render(<EmailLink value={undefined} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
