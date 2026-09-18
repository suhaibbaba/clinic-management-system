import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Clinic, ClinicBranding, PresignClinicLogoInput } from "@clinic/shared";
import type { UpdateClinicInput } from "@clinic/shared";
import { buildClinicIconSet } from "@web/features/clinic/logo-icons";
import { clinicApi } from "@web/features/clinic/api";
import { uploadToStorage } from "@web/features/patients/api";

const CLINIC_KEY = "clinic";
const BRANDING_KEY = "clinic-branding";

// `/clinic/branding` answers only for a single-clinic deployment, so there is no id to key the
// browser's copy of the logo by, and one constant scope is the whole truth.
export const BRANDING_SCOPE = "branding";

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

// Re-reads the stored source rather than the file in hand, so the icons are always a rendering of
// exactly the bytes the API kept — and so removing the app icon can fall back to the logo.
async function renderBrandingIcons(): Promise<Clinic> {
  const slots = await clinicApi.presignIcons();
  const source = await fetch(slots.sourceUrl);

  if (!source.ok) {
    throw new Error(`The icon source could not be read (${String(source.status)})`);
  }

  const icons = await buildClinicIconSet(await source.blob());

  await Promise.all(
    slots.icons.map((slot) => {
      const blob = icons.get(slot.name);

      if (!blob) {
        throw new Error(`No icon was generated for ${slot.name}`);
      }

      return uploadToStorage(slot.uploadUrl, blob, slot.mime);
    }),
  );

  return clinicApi.confirmIcons();
}

async function uploadBrandingImage(
  file: File,
  presign: (body: PresignClinicLogoInput) => Promise<{ key: string; uploadUrl: string }>,
  confirm: (key: string) => Promise<Clinic>,
): Promise<Clinic> {
  const presigned = await presign({
    filename: file.name,
    mime: file.type as PresignClinicLogoInput["mime"],
    sizeBytes: file.size,
  });

  await uploadToStorage(presigned.uploadUrl, file);

  return confirm(presigned.key);
}

/** Only the logo drives the icons, and only when no app icon has taken that job. */
export function useUploadClinicLogo() {
  return useBrandingMutation(async (file: File) => {
    const clinic = await uploadBrandingImage(file, clinicApi.presignLogo, clinicApi.confirmLogo);

    return clinic.appIconKey === null ? renderBrandingIcons() : clinic;
  });
}

// Nothing to re-render either way: an app icon is still the source, and without one the API has
// already dropped the set.
export function useRemoveClinicLogo() {
  return useBrandingMutation(() => clinicApi.removeLogo());
}

export function useUploadAppIcon() {
  return useBrandingMutation(async (file: File) => {
    await uploadBrandingImage(file, clinicApi.presignAppIcon, clinicApi.confirmAppIcon);

    return renderBrandingIcons();
  });
}

export function useRemoveAppIcon() {
  return useBrandingMutation(async () => {
    const clinic = await clinicApi.removeAppIcon();

    return clinic.logoKey === null ? clinic : renderBrandingIcons();
  });
}

function useBrandingMutation<TInput>(mutationFn: (input: TInput) => Promise<Clinic>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (clinic: Clinic) => {
      queryClient.setQueryData([CLINIC_KEY], clinic);
      void queryClient.invalidateQueries({ queryKey: [BRANDING_KEY] });
    },
  });
}
