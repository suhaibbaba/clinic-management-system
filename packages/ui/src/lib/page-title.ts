import { createContext, useContext, useEffect } from 'react';

const PageTitleContext = createContext<((title: string | null) => void) | null>(null);

/** The host owns `document.title`; the library only says which page is on screen. */
export const PageTitleProvider = PageTitleContext.Provider;

/** Called by `PageHeader`, never by a screen: a screen's title is the heading it already renders. */
export function useDocumentTitle(title: string): void {
  const register = useContext(PageTitleContext);

  useEffect(() => {
    register?.(title);

    return () => register?.(null);
  }, [register, title]);
}
