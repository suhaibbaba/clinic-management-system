import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Clinic, ClinicBranding } from "@clinic/shared";
import { clinicApi } from "@web/shared/api/clinic";

export const CLINIC_KEY = "clinic";

export const BRANDING_KEY = "clinic-branding";

export const BRANDING_SCOPE = "branding";

export function useClinic(): UseQueryResult<Clinic> {
  return useQuery({ queryKey: [CLINIC_KEY], queryFn: () => clinicApi.get() });
}

export function useCurrency(): string | undefined {
  return useClinic().data?.currency;
}

export function useClinicBranding(enabled = true): UseQueryResult<ClinicBranding> {
  return useQuery({
    queryKey: [BRANDING_KEY],
    queryFn: () => clinicApi.branding(),
    staleTime: Infinity,
    retry: false,
    enabled,
  });
}
