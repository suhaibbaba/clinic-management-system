import { versionResponseSchema, type VersionResponse } from "@clinic/shared";
import type {
  Clinic,
  ClinicBranding,
  PresignClinicIconsResponse,
  PresignClinicLogoInput,
  PresignClinicLogoResponse,
  ResolvedLocation,
  UpdateClinicInput,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const clinicApi = {
  get: (): Promise<Clinic> => apiRequest("/clinic"),
  version: async (): Promise<VersionResponse> =>
    versionResponseSchema.parse(await apiRequest("/version")),
  update: (body: UpdateClinicInput): Promise<Clinic> =>
    apiRequest("/clinic", { method: "PATCH", body }),
  branding: (): Promise<ClinicBranding> => apiRequest("/clinic/branding"),
  resolveLocation: (url: string): Promise<ResolvedLocation> =>
    apiRequest("/clinic/location/resolve", { method: "POST", body: { url } }),

  presignLogo: (body: PresignClinicLogoInput): Promise<PresignClinicLogoResponse> =>
    apiRequest("/clinic/logo/presign", { method: "POST", body }),
  confirmLogo: (key: string): Promise<Clinic> =>
    apiRequest("/clinic/logo", { method: "POST", body: { key } }),
  removeLogo: (): Promise<Clinic> => apiRequest("/clinic/logo", { method: "DELETE" }),

  presignAppIcon: (body: PresignClinicLogoInput): Promise<PresignClinicLogoResponse> =>
    apiRequest("/clinic/app-icon/presign", { method: "POST", body }),
  confirmAppIcon: (key: string): Promise<Clinic> =>
    apiRequest("/clinic/app-icon", { method: "POST", body: { key } }),
  removeAppIcon: (): Promise<Clinic> => apiRequest("/clinic/app-icon", { method: "DELETE" }),

  presignIcons: (): Promise<PresignClinicIconsResponse> =>
    apiRequest("/clinic/branding/icons/presign", { method: "POST" }),
  confirmIcons: (): Promise<Clinic> => apiRequest("/clinic/branding/icons", { method: "POST" }),
};
