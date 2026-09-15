import type {
  Clinic,
  ClinicBranding,
  PresignClinicIconsResponse,
  PresignClinicLogoInput,
  PresignClinicLogoResponse,
  ResolvedLocation,
  UpdateClinicInput,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const clinicApi = {
  get: (): Promise<Clinic> => apiRequest('/clinic'),
  update: (body: UpdateClinicInput): Promise<Clinic> =>
    apiRequest('/clinic', { method: 'PATCH', body }),
  /** No token: the sign-in screen draws this before anybody has one. */
  branding: (): Promise<ClinicBranding> => apiRequest('/clinic/branding'),
  /** A shortened map link hides its coordinates behind a redirect only the API can follow. */
  resolveLocation: (url: string): Promise<ResolvedLocation> =>
    apiRequest('/clinic/location/resolve', { method: 'POST', body: { url } }),

  presignLogo: (body: PresignClinicLogoInput): Promise<PresignClinicLogoResponse> =>
    apiRequest('/clinic/logo/presign', { method: 'POST', body }),
  confirmLogo: (key: string): Promise<Clinic> =>
    apiRequest('/clinic/logo', { method: 'POST', body: { key } }),
  removeLogo: (): Promise<Clinic> => apiRequest('/clinic/logo', { method: 'DELETE' }),

  presignAppIcon: (body: PresignClinicLogoInput): Promise<PresignClinicLogoResponse> =>
    apiRequest('/clinic/app-icon/presign', { method: 'POST', body }),
  confirmAppIcon: (key: string): Promise<Clinic> =>
    apiRequest('/clinic/app-icon', { method: 'POST', body: { key } }),
  removeAppIcon: (): Promise<Clinic> => apiRequest('/clinic/app-icon', { method: 'DELETE' }),

  /** Signed against whatever the icons are rendered from, and hands back its bytes to re-read. */
  presignIcons: (): Promise<PresignClinicIconsResponse> =>
    apiRequest('/clinic/branding/icons/presign', { method: 'POST' }),
  confirmIcons: (): Promise<Clinic> => apiRequest('/clinic/branding/icons', { method: 'POST' }),
};
