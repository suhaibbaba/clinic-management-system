import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { USER_ROLE } from '@clinic/shared';

import { useSession } from '@web/features/auth/session';
import { useAllergyFlags } from '@web/features/patients/queries';

/**
 * Allergies, at the top of the patient file and before anything else.
 *
 * It renders the moment its own query resolves, independently of the patient
 * record and the chart, because the whole point is that nobody starts working
 * on this patient without having seen it. A quiet banner would defeat it, so it
 * is red, it is first, and it is announced assertively.
 *
 * The data comes from the narrow allergy-flags endpoint rather than the full
 * medical history: it is all this needs, and it is the one medical read a
 * technician is also allowed (ROLES.md).
 *
 * A receptionist gets no medical history at all, allergies included, so the
 * query is not made rather than made and refused — a 403 in the console on
 * every patient they open teaches everyone to ignore 403s.
 */
export function AllergyBanner({ patientId }: { patientId: string }): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const mayRead = user !== null && user.role !== USER_ROLE.RECEPTIONIST;
  const { data } = useAllergyFlags(patientId, mayRead);

  if (!data?.hasAllergies) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-red-300 bg-red-50 px-4 py-3"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ⚠
      </span>
      <span className="text-sm font-semibold text-red-800">{t('patients.allergies')}:</span>
      <span className="text-sm text-red-700">{data.allergies.join('، ')}</span>
    </div>
  );
}
