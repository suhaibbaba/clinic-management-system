export const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  ("standalone" in navigator && navigator.standalone === true);

export const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isAndroid = (): boolean => /android/i.test(navigator.userAgent);
