import { clinicDomainSchema, clinicHostSchema } from "@clinic/shared";

export interface ClinicAddresses {
  readonly website: string | null;
  readonly dashboard: string | null;
}

export const clinicAddresses = (
  domain: string | null,
  appDomain: string | null,
): ClinicAddresses => ({
  website: domain ? `https://${domain}` : null,
  dashboard: appDomain ? `https://${appDomain}` : null,
});

export const googleRedirectUri = (appDomain: string): string =>
  `https://${appDomain}/api/auth/google/callback`;

export const parseDomain = (input: string): string | null | undefined => {
  if (input.trim() === "") {
    return null;
  }

  const parsed = clinicDomainSchema.safeParse(input);

  return parsed.success ? parsed.data : undefined;
};

export const parseHost = (input: string): string | null | undefined => {
  if (input.trim() === "") {
    return null;
  }

  const parsed = clinicHostSchema.safeParse(input);

  return parsed.success ? parsed.data : undefined;
};
