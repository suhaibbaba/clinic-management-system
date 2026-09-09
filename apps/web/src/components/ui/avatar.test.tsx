import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '@web/components/ui/avatar';

describe('Avatar', () => {
  it('falls back to two initials when there is no photo', () => {
    const { container } = render(<Avatar name="ليلى محمود حداد" src={null} />);

    // Two, not three: four letters in a 36px circle is a smudge.
    expect(container.textContent).toBe('لم');
    expect(container.querySelector('img')).toBeNull();
  });

  it('draws the photo when there is one', () => {
    render(<Avatar name="ليلى حداد" src="https://storage.example/signed/layla.jpg" />);

    const image = screen.getByRole('presentation', { hidden: true });
    expect(image).toHaveAttribute('src', 'https://storage.example/signed/layla.jpg');
    // Decorative: the name it stands for is always rendered beside it.
    expect(image).toHaveAttribute('alt', '');
  });

  /*
   * Photo URLs are signed and expire in minutes, so a tab left open overnight
   * is the ordinary case — it has to show the initials, not a torn image.
   */
  it('goes back to initials when the signed URL has expired', () => {
    const { container } = render(
      <Avatar name="سامر نصار" src="https://storage.example/gone.jpg" />,
    );

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('سن');
  });

  it('gives the same person the same tint on every screen', () => {
    const tint = (name: string): string | undefined =>
      render(<Avatar name={name} tintKey="patient-1" />)
        .container.firstElementChild?.className.split(' ')
        .find((token) => token.startsWith('bg-'));

    // Keyed to the id, not to the name — the colour means nothing, but it has
    // to be the same nothing wherever the same person appears.
    expect(tint('أحمد')).toBe(tint('أحمد خالد'));
    expect(tint('أحمد')).toBeDefined();
  });
});
