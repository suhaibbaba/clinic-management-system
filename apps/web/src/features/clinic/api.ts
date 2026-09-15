import type {
  Clinic,
  ClinicBranding,
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
};
