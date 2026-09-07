import type {
  Clinic,
  ClinicBranding,
  PresignClinicLogoInput,
  PresignClinicLogoResponse,
  UpdateClinicInput,
} from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const clinicApi = {
  get: (): Promise<Clinic> => apiRequest('/clinic'),
  update: (body: UpdateClinicInput): Promise<Clinic> =>
    apiRequest('/clinic', { method: 'PATCH', body }),
  /** No token: the sign-in screen draws this before anybody has one. */
  branding: (): Promise<ClinicBranding> => apiRequest('/clinic/branding'),
  presignLogo: (body: PresignClinicLogoInput): Promise<PresignClinicLogoResponse> =>
    apiRequest('/clinic/logo/presign', { method: 'POST', body }),
  confirmLogo: (key: string): Promise<Clinic> =>
    apiRequest('/clinic/logo', { method: 'POST', body: { key } }),
  removeLogo: (): Promise<Clinic> => apiRequest('/clinic/logo', { method: 'DELETE' }),
};
