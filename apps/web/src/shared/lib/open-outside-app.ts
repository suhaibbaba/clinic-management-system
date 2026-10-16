import { isAndroid, isIos, isStandalone } from "@web/shared/lib/display-mode";

export type AppShell = "browser" | "android-app" | "ios-app" | "desktop-app";

export function currentShell(): AppShell {
  if (!isStandalone()) {
    return "browser";
  }

  if (isAndroid()) {
    return "android-app";
  }

  return isIos() ? "ios-app" : "desktop-app";
}

export function outsideAppUrl(href: string, base: string, shell: AppShell): string | null {
  const url = new URL(href, base);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  switch (shell) {
    case "android-app":
      return (
        `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};` +
        `action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;` +
        `S.browser_fallback_url=${encodeURIComponent(url.href)};end`
      );
    case "ios-app":
      return `x-safari-${url.href}`;
    default:
      return null;
  }
}

export function openOutsideApp(href: string): boolean {
  const target = outsideAppUrl(href, window.location.href, currentShell());

  if (target === null) {
    return false;
  }

  window.location.href = target;

  return true;
}
