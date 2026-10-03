const STORAGE_KEY = "clinic.rememberMe";

export function readRememberMe(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function writeRememberMe(rememberMe: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(rememberMe));
  } catch {}
}
