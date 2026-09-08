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

/**
 * The clinic's currency, for anything that draws or accepts an amount.
 *
 * A hook rather than a prop threaded down through five forms: every money field
 * and every figure needs it, it comes from the same cached query as the rest of
 * the clinic, and a form that forgot the prop rendered its amounts with no
 * symbol at all — which reads as a missing setting rather than as a bug.
 *
 * Undefined until the query lands; `Money` and `MoneyInput` both draw the
 * figure without a symbol in the meantime rather than shifting the layout twice.
 */
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

/**
 * The clinic's name and mark for the sign-in screen, which has no session yet.
 *
 * Cached for the session and never retried: the screen has a perfectly good
 * fallback, and a login page that spins because branding is slow is worse than
 * one showing the product's own mark.
 */
export function useClinicBranding(): UseQueryResult<ClinicBranding> {
  return useQuery({
    queryKey: [BRANDING_KEY],
    queryFn: () => clinicApi.branding(),
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Presign, PUT the bytes straight to storage, confirm — the same three steps
 * the X-ray upload uses, because it is the same flow: the API signs a URL and
 * the file never passes through it.
 */
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
