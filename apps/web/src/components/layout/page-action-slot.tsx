import { createContext, useContext } from 'react';

const PageActionSlotContext = createContext<HTMLElement | null>(null);

export const PageActionSlotProvider = PageActionSlotContext.Provider;

/** The bar's node for a page's primary action, or null where there is no bar (tests, booking). */
export function usePageActionSlot(): HTMLElement | null {
  return useContext(PageActionSlotContext);
}

// Created detached rather than read back off a ref, so a page's portal finds it on its first render
// and the button is never a frame late into a bar that has already painted.
export function createPageActionSlot(): HTMLDivElement {
  const slot = document.createElement('div');

  slot.className = 'flex items-center gap-2.5';

  return slot;
}
