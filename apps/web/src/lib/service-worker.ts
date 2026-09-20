/**
 * The worker precaches the shell and nothing else — never `/api`. A cached medical response would
 * outlive the logout and the role change that should have ended it, on hardware a clinic shares.
 */

// A clinic leaves the app open all day, and the browser only re-checks the worker on a real
// navigation — which never comes. Without this poll a deploy reaches that tab tomorrow.
const UPDATE_CHECK_MS = 30 * 60 * 1000;

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW: (_url, registration) => {
        if (!registration) {
          return;
        }

        let lastCheck = Date.now();

        const check = (): void => {
          lastCheck = Date.now();
          void registration.update();
        };

        setInterval(check, UPDATE_CHECK_MS);

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible" && Date.now() - lastCheck >= UPDATE_CHECK_MS) {
            check();
          }
        });
      },
    });
  });
}
