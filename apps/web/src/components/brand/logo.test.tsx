import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from '@web/components/brand/logo';
import '@web/i18n';

const CLINIC = { ar: 'عيادة النور', en: 'Al Nour Clinic' };

const boxOf = (container: HTMLElement): string => {
  const { style } = container.firstElementChild as HTMLElement;

  return `${style.width}×${style.height}`;
};

// A bundled mark is one clinic's, and this product is sold to more than one. The test is the
// absence: nothing to import means nothing to request.
describe('no bundled artwork', () => {
  const SRC = join(__dirname, '..', '..');

  function sources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return sources(path);
      }

      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  it('ships no image asset for the bundler to emit', () => {
    expect(existsSync(join(SRC, 'assets'))).toBe(false);
  });

  it('imports no image file anywhere in the app', () => {
    const offenders = sources(SRC).filter((path) =>
      /^\s*import .* from '[^']+\.(svg|png|jpe?g|webp|gif)';/m.test(readFileSync(path, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });

  it('requests nothing when the clinic has no logo', () => {
    const { container } = render(<Logo size="chrome" src={null} name={CLINIC} />);

    expect(container.querySelector('img')).toBeNull();
  });
});

describe('Logo', () => {
  it('lays out identically with a logo and without one', () => {
    const withLogo = render(<Logo size="login" src="https://storage.example/logo.png" />);
    const without = render(<Logo size="login" src={null} name={CLINIC} />);

    expect(boxOf(without.container)).toBe(boxOf(withLogo.container));
    expect(boxOf(without.container)).toBe('200px×80px');
  });

  it('marks a clinic with no logo by its own initial', () => {
    const { container } = render(<Logo size="chrome" src={null} name={CLINIC} />);

    expect(container.textContent).toBe('ع');
  });

  it('falls back to the mark when the signed URL no longer resolves', () => {
    const { container } = render(
      <Logo size="chrome" src="https://storage.example/gone.png" name={CLINIC} />,
    );
    const before = boxOf(container);

    fireEvent.error(container.querySelector('img')!);

    expect(boxOf(container)).toBe(before);
  });

  it('loads eagerly at high priority, because the rail is waiting on it', () => {
    const { container } = render(<Logo size="chrome" src="https://storage.example/logo.png" />);

    expect(container.querySelector('img')).toHaveAttribute('fetchpriority', 'high');
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager');
  });
});
