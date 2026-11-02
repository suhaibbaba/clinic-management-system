export interface ClinicAddresses {
  readonly siteDomain: string | null;
  readonly appDomain: string | null;
}

export function publicBase(clinic: ClinicAddresses | undefined, fallback: string): string {
  const host = clinic?.siteDomain ?? clinic?.appDomain;

  return host ? `https://${host}` : fallback.replace(/\/$/, "");
}
