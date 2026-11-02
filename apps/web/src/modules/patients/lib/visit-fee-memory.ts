const KEY = "clinic.visit-fee.procedure";

export function lastFeeProcedure(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberFeeProcedure(procedureId: string): void {
  try {
    localStorage.setItem(KEY, procedureId);
  } catch {}
}
