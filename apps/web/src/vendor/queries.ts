import type {
  SavePlanInput,
  SaveSubscriptionInput,
  SpecialtyCode,
  VendorClinicsQuery,
  VendorLoginInput,
} from "@clinic/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@web/vendor/api";
import { VENDOR_QUERY_KEY } from "@web/vendor/constants";

export const useVendorSession = () =>
  useQuery({ queryKey: VENDOR_QUERY_KEY.SESSION, queryFn: vendorApi.session, retry: false });

export function useSignIn() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: VendorLoginInput) => vendorApi.signIn(input),
    onSuccess: (profile) => client.setQueryData(VENDOR_QUERY_KEY.SESSION, profile),
  });
}

export function useSignOut() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: vendorApi.signOut,
    onSettled: () => client.clear(),
  });
}

export const useOverview = () =>
  useQuery({ queryKey: VENDOR_QUERY_KEY.OVERVIEW, queryFn: vendorApi.overview });

export const useClinics = (params: Partial<VendorClinicsQuery>) =>
  useQuery({
    queryKey: [...VENDOR_QUERY_KEY.CLINICS, params],
    queryFn: () => vendorApi.clinics(params),
    placeholderData: (previous) => previous,
  });

export const useClinic = (id: string) =>
  useQuery({ queryKey: [...VENDOR_QUERY_KEY.CLINIC, id], queryFn: () => vendorApi.clinic(id) });

export const usePlans = () =>
  useQuery({ queryKey: VENDOR_QUERY_KEY.PLANS, queryFn: vendorApi.plans });

function useRefreshAll() {
  const client = useQueryClient();

  return () =>
    Promise.all(
      [
        VENDOR_QUERY_KEY.OVERVIEW,
        VENDOR_QUERY_KEY.CLINICS,
        VENDOR_QUERY_KEY.CLINIC,
        VENDOR_QUERY_KEY.PLANS,
      ].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
}

export function useSaveSubscription(clinicId: string) {
  const refresh = useRefreshAll();

  return useMutation({
    mutationFn: (input: SaveSubscriptionInput) => vendorApi.saveSubscription(clinicId, input),
    onSuccess: refresh,
  });
}

export function useSaveDomain(clinicId: string) {
  const refresh = useRefreshAll();

  return useMutation({
    mutationFn: (domain: string | null) => vendorApi.saveDomain(clinicId, { domain }),
    onSuccess: refresh,
  });
}

export function useGrantSpecialty(clinicId: string) {
  const refresh = useRefreshAll();

  return useMutation({
    mutationFn: (code: SpecialtyCode) => vendorApi.grantSpecialty(clinicId, { code }),
    onSuccess: refresh,
  });
}

export function useSavePlan() {
  const refresh = useRefreshAll();

  return useMutation({
    mutationFn: ({ id, input }: { readonly id: string | null; readonly input: SavePlanInput }) =>
      id === null ? vendorApi.createPlan(input) : vendorApi.updatePlan(id, input),
    onSuccess: refresh,
  });
}
