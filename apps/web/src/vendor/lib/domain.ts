import { clinicDomainSchema } from "@clinic/shared";

export interface ClinicAddresses {
  readonly website: string;
  readonly dashboard: string;
}

export const clinicAddresses = (domain: string): ClinicAddresses => ({
  website: `https://${domain}`,
  dashboard: `https://admin.${domain}`,
});

export const parseDomain = (input: string): string | null | undefined => {
  if (input.trim() === "") {
    return null;
  }

  const parsed = clinicDomainSchema.safeParse(input);

  return parsed.success ? parsed.data : undefined;
};
