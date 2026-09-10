import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { Clinic, ClinicBranding, PresignClinicLogoInput } from '@clinic/shared';
import type { UpdateClinicInput } from '@clinic/shared';

import { clinicApi } from '@web/features/clinic/api';
import { uploadToStorage } from '@web/features/patients/api';

const CLINIC_KEY = 'clinic';
const BRANDING_KEY = 'clinic-branding';

export function useClinic(): UseQueryResult<Clinic> {
  return useQuery({ queryKey: [CLINIC_KEY], queryFn: () => clinicApi.get() });
}

// A hook rather than a prop through five forms: a form that forgot the prop drew its amounts with
// no symbol, which reads as a missing setting rather than a bug.
export function useCurrency(): string | undefined {
  return useClinic().data?.currency;
}

export function useUpdateClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateClinicInput) => clinicApi.update(body),
    onSuccess: (clinic) => queryClient.setQueryData([CLINIC_KEY], clinic),
  });
}

// Cached for the session and never retried: a login page that spins because branding is slow is
// worse than one showing the product's own mark.
export function useClinicBranding(): UseQueryResult<ClinicBranding> {
  return useQuery({
    queryKey: [BRANDING_KEY],
    queryFn: () => clinicApi.branding(),
    staleTime: Infinity,
    retry: false,
  });
}

export function useUploadClinicLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<Clinic> => {
      const presigned = await clinicApi.presignLogo({
        filename: file.name,
        mime: file.type as PresignClinicLogoInput['mime'],
        sizeBytes: file.size,
      });

      await uploadToStorage(presigned.uploadUrl, file);

      return clinicApi.confirmLogo(presigned.key);
    },
    onSuccess: (clinic) => {
      queryClient.setQueryData([CLINIC_KEY], clinic);
      // The sign-in screen reads its own endpoint, so it needs telling too.
      void queryClient.invalidateQueries({ queryKey: [BRANDING_KEY] });
    },
  });
}

export function useRemoveClinicLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clinicApi.removeLogo(),
    onSuccess: (clinic) => {
      queryClient.setQueryData([CLINIC_KEY], clinic);
      void queryClient.invalidateQueries({ queryKey: [BRANDING_KEY] });
    },
  });
}
