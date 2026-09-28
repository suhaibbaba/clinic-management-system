import { CLINIC_KEY, BRANDING_KEY } from "@web/shared/queries/clinic";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  Clinic,
  PresignClinicLogoInput,
  VersionResponse,
  UpdateClinicInput,
} from "@clinic/shared";
import { buildClinicIconSet } from "@web/modules/clinic/lib/logo-icons";
import { clinicApi } from "@web/shared/api/clinic";
import { uploadToStorage } from "@web/shared/lib/upload";

export function useUpdateClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateClinicInput) => clinicApi.update(body),
    onSuccess: (clinic) => queryClient.setQueryData([CLINIC_KEY], clinic),
  });
}

export function useResolveLocation() {
  return useMutation({ mutationFn: (url: string) => clinicApi.resolveLocation(url), retry: false });
}

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

export function useUploadClinicLogo() {
  return useBrandingMutation(async (file: File) => {
    const clinic = await uploadBrandingImage(file, clinicApi.presignLogo, clinicApi.confirmLogo);

    return clinic.appIconKey === null ? renderBrandingIcons() : clinic;
  });
}

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

export function useApiVersion(): UseQueryResult<VersionResponse> {
  return useQuery({
    queryKey: ["version"],
    queryFn: () => clinicApi.version(),
    staleTime: Infinity,
    retry: false,
  });
}
