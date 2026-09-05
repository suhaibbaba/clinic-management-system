import type { Clinic, UpdateClinicInput } from '@clinic/shared';

import { apiRequest } from '@web/lib/api-client';

export const clinicApi = {
  get: (): Promise<Clinic> => apiRequest('/clinic'),
  update: (body: UpdateClinicInput): Promise<Clinic> =>
    apiRequest('/clinic', { method: 'PATCH', body }),
};
