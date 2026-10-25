const SETTLE_MS = 900;

export function revealField(field: HTMLElement, target: HTMLElement = field): void {
  const focus = (): void => target.focus({ preventScroll: true });
  const { top, bottom } = field.getBoundingClientRect();

  if (top >= window.innerHeight * 0.15 && bottom <= window.innerHeight) {
    focus();
    return;
  }

  let settled = false;
  const settle = (): void => {
    if (settled) {
      return;
    }

    settled = true;
    document.removeEventListener("scrollend", settle, true);
    focus();
  };

  document.addEventListener("scrollend", settle, true);
  window.setTimeout(settle, SETTLE_MS);
  field.scrollIntoView({ behavior: "smooth", block: "center" });
}
