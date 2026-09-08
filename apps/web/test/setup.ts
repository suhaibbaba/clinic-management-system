import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// The app renders RTL; jsdom needs to be told, since index.html is not used.
document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'ar');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Radix primitives measure elements that jsdom does not implement.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = (): void => {};
}

/*
 * Radix `Select` captures the pointer to keep a drag-to-choose gesture on the
 * list it started in. jsdom implements none of the Pointer Capture API, so the
 * primitive throws on the first pointer-down without these three.
 */
Element.prototype.hasPointerCapture ??= (): boolean => false;
Element.prototype.setPointerCapture ??= (): void => {};
Element.prototype.releasePointerCapture ??= (): void => {};
