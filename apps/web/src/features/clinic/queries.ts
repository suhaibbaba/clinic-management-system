import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { Clinic, ClinicBranding, PresignClinicLogoInput } from '@clinic/shared';
import type { UpdateClinicInput } from '@clinic/shared';

import { buildClinicIconSet } from '@web/features/clinic/logo-icons';
import { clinicApi } from '@web/features/clinic/api';
import { uploadToStorage } from '@web/features/patients/api';

const CLINIC_KEY = 'clinic';
const BRANDING_KEY = 'clinic-branding';

// `/clinic/branding` answers only for a single-clinic deployment, so there is no id to key the
// browser's copy of the logo by, and one constant scope is the whole truth.
export const BRANDING_SCOPE = 'branding';

export function useClinic(): UseQueryResult<Clinic> {
  return useQuery({ queryKey: [CLINIC_KEY], queryFn: () => clinicApi.get() });
}

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

/** Never retried: a link that cannot be resolved once will not resolve on a second try either. */
export function useResolveLocation() {
  return useMutation({ mutationFn: (url: string) => clinicApi.resolveLocation(url), retry: false });
}

// Cached for the session and never retried: a sign-in page that spins because branding is slow is
// worse than one showing the clinic's initial.
export function useClinicBranding(enabled = true): UseQueryResult<ClinicBranding> {
  return useQuery({
    queryKey: [BRANDING_KEY],
    queryFn: () => clinicApi.branding(),
    staleTime: Infinity,
    retry: false,
    enabled,
  });
}

export function useUploadClinicLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<Clinic> => {
      const icons = await buildClinicIconSet(file);

      const presigned = await clinicApi.presignLogo({
        filename: file.name,
        mime: file.type as PresignClinicLogoInput['mime'],
        sizeBytes: file.size,
      });

      // The logo and its icons go up together; confirm refuses a set that arrived half-written,
      // so a clinic never ends up with a tab mark rendered from a logo it no longer has.
      await Promise.all([
        uploadToStorage(presigned.uploadUrl, file),
        ...presigned.icons.map((slot) => {
          const blob = icons.get(slot.name);

          if (!blob) {
            throw new Error(`No icon was generated for ${slot.name}`);
          }

          return uploadToStorage(slot.uploadUrl, blob, slot.mime);
        }),
      ]);

      return clinicApi.confirmLogo(presigned.key);
    },
    onSuccess: (clinic) => {
      queryClient.setQueryData([CLINIC_KEY], clinic);
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
