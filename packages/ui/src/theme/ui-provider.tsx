import { createTheme, type ThemeOverride } from "@ui/theme/create-theme";
import { useEffect, useInsertionEffect, type JSX, type ReactNode } from "react";

export type Direction = "rtl" | "ltr";

export interface UiProviderProps {
  /** This product's values for the library's tokens. Omitted, the neutral defaults stand. */
  readonly theme?: ThemeOverride | undefined;
  readonly direction?: Direction | undefined;
  /** BCP 47, written to the document alongside the direction. */
  readonly lang?: string | undefined;
  readonly children: ReactNode;
}

const STYLE_ID = "clinic-ui-theme";

export function UiProvider({
  theme,
  direction = "rtl",
  lang,
  children,
}: UiProviderProps): JSX.Element {
  // Before paint rather than after it, so a changed theme never shows a frame of the old one.
  useInsertionEffect(() => {
    if (theme === undefined) {
      return;
    }

    const style = document.getElementById(STYLE_ID) ?? document.createElement("style");

    style.id = STYLE_ID;
    style.textContent = createTheme(theme);
    document.head.append(style);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = direction;

    if (lang !== undefined) {
      document.documentElement.lang = lang;
    }
  }, [direction, lang]);

  // No context: the direction that matters is the one on `<html>`, because the components that
  // need it portal to `document.body` and would not see a provider above them anyway.
  return <>{children}</>;
}
