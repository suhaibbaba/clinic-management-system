import {
  GENDERS,
  type CreateAppointmentInput,
  type PatientPhoneClash,
  type PatientView,
} from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Badge,
  Button,
  DatePicker,
  FormField,
  Icon,
  Input,
  Ltr,
  SearchField,
  Select,
} from '@web/components/ui';
import { usePatients } from '@web/features/patients/queries';
import { ApiError } from '@web/lib/api-error';
import { useDebounced } from '@web/lib/use-debounced';
import { cn } from '@web/lib/cn';

// Not a whole patient record: the calendar feed already carries these, and they are all a
// receptionist's response contains.
export interface PickedPatient {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string;
  readonly fileNumber: string;
  readonly profileIncomplete?: boolean;
}

/** The least reception can register somebody with while somebody else is on the phone. */
export interface PatientDraft {
  readonly fullName: string;
  readonly phone: string;
  readonly gender?: string;
  readonly dateOfBirth?: string;
}

export type PatientChoice =
  | { readonly kind: 'existing'; readonly patient: PickedPatient }
  | { readonly kind: 'new'; readonly draft: PatientDraft };

/** What every form that picks a patient sends: one of the two, never both (`patientRefFields`). */
export function toPatientRef(
  choice: PatientChoice,
): Pick<CreateAppointmentInput, 'patientId' | 'newPatient'> {
  if (choice.kind === 'existing') {
    return { patientId: choice.patient.id };
  }

  const { fullName, phone, dateOfBirth } = choice.draft;
  const gender = GENDERS.find((option) => option === choice.draft.gender);

  return {
    newPatient: {
      fullName: fullName.trim(),
      phone: phone.trim(),
      ...(gender && { gender }),
      ...(dateOfBirth && { dateOfBirth }),
    },
  };
}

// The API refuses a second record on a number it already knows and sends back the patient it found.
// Every form that registers inline reads it the same way, and offers that patient instead.
export function patientPhoneClash(error: unknown): PickedPatient | null {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return null;
  }

  return (error.payload as Partial<PatientPhoneClash> | undefined)?.existingPatient ?? null;
}

export const isDraftComplete = (choice: PatientChoice | null): boolean =>
  choice === null
    ? false
    : choice.kind === 'existing' ||
      (choice.draft.fullName.trim() !== '' && choice.draft.phone.trim() !== '');

export interface PatientPickerProps {
  readonly value: PatientChoice | null;
  readonly onChange: (choice: PatientChoice | null) => void;
  readonly id: string;
  /** A patient already on the typed number, sent back by the API instead of a duplicate. */
  readonly clash?: PickedPatient | null | undefined;
  /** Off where registering somebody would be beside the point — a stock movement, say. */
  readonly allowNew?: boolean;
}

// A `<select>` of every patient is unusable past a few hundred rows, so this reuses the search
// reception already knows. A search that finds nobody offers to register them here rather than
// sending reception away to another screen with a half-filled form behind them.
export function PatientPicker({
  value,
  onChange,
  id,
  clash,
  allowNew = true,
}: PatientPickerProps): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const term = debounced.trim();
  const results = usePatients({ limit: 8, ...(term !== '' && { search: term }) });
  const matches = results.data?.items ?? [];

  if (value?.kind === 'existing') {
    return (
      <div className="flex items-center gap-3 rounded-control border border-line bg-inset px-3 py-2">
        <Avatar name={value.patient.fullName} tintKey={value.patient.id} />
        <span className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="truncate text-value font-medium text-ink">{value.patient.fullName}</span>
          <Ltr className="truncate text-label tabular-nums text-ink-subtle">
            {value.patient.phone}
          </Ltr>
        </span>
        {value.patient.profileIncomplete && (
          <Badge tone="warning">{t('patients.incomplete')}</Badge>
        )}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('common.clear')}
          className="cursor-pointer rounded-control p-1 text-ink-subtle transition-colors duration-150 hover:text-ink"
        >
          <Icon name="x" className="size-4" />
        </button>
      </div>
    );
  }

  if (value?.kind === 'new') {
    return (
      <NewPatientFields
        id={id}
        draft={value.draft}
        onChange={(draft) => onChange({ kind: 'new', draft })}
        onCancel={() => onChange(null)}
        {...(clash ? { clash } : {})}
        onUseExisting={(patient) => onChange({ kind: 'existing', patient })}
      />
    );
  }

  const typed = search.trim();
  const offerNew = allowNew && typed !== '' && !results.isPending && matches.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <SearchField
        id={id}
        label={t('patients.search')}
        placeholder={t('patients.searchPlaceholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {typed !== '' && (
        <ul className="max-h-56 overflow-y-auto rounded-control border border-line">
          {offerNew && (
            <li>
              <button
                type="button"
                data-new-patient
                onClick={() => onChange({ kind: 'new', draft: { fullName: typed, phone: '' } })}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start',
                  'text-value font-medium text-primary-600',
                  'transition-colors duration-150 hover:bg-row-hover',
                )}
              >
                <Icon name="user-plus" className="size-4 shrink-0" />
                <span className="truncate">{t('patients.createNamed', { name: typed })}</span>
              </button>
            </li>
          )}

          {!offerNew && matches.length === 0 && (
            <li className="px-3 py-2.5 text-label text-ink-muted">{t('patients.noMatches')}</li>
          )}

          {matches.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ kind: 'existing', patient: toPicked(patient) });
                  setSearch('');
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-start',
                  'transition-colors duration-150 hover:bg-row-hover',
                )}
              >
                <Avatar name={patient.fullName} tintKey={patient.id} />
                <span className="flex min-w-0 flex-col leading-snug">
                  <span className="truncate text-value text-ink">{patient.fullName}</span>
                  <Ltr className="truncate text-label tabular-nums text-ink-subtle">
                    {patient.fileNumber} · {patient.phone}
                  </Ltr>
                </span>
                {patient.profileIncomplete && (
                  <Badge tone="warning" className="ms-auto">
                    {t('patients.incomplete')}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const toPicked = (patient: PatientView): PickedPatient => ({
  id: patient.id,
  fullName: patient.fullName,
  phone: patient.phone,
  fileNumber: patient.fileNumber,
  profileIncomplete: patient.profileIncomplete,
});

// Four fields, two of them optional. The history, the allergies and the address are taken when the
// patient walks in — asking for them down the phone is how the booking gets abandoned.
function NewPatientFields({
  id,
  draft,
  onChange,
  onCancel,
  clash,
  onUseExisting,
}: {
  readonly id: string;
  readonly draft: PatientDraft;
  readonly onChange: (draft: PatientDraft) => void;
  readonly onCancel: () => void;
  readonly clash?: PickedPatient;
  readonly onUseExisting: (patient: PickedPatient) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 rounded-control border border-primary-200 bg-primary-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-medium text-ink">{t('patients.createInline')}</span>
        <Button size="sm" variant="ghost" icon={<Icon name="x" />} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>

      {clash && (
        <div className="flex flex-wrap items-center gap-2 rounded-control bg-warning-100 px-3 py-2">
          <span className="text-label text-warning-700">
            {t('patients.phoneTaken', { name: clash.fullName })}
          </span>
          <Button size="sm" variant="secondary" onClick={() => onUseExisting(clash)}>
            {t('patients.useExisting')}
          </Button>
        </div>
      )}

      <FormField label="patients.fullName" htmlFor={`${id}-name`} required>
        <Input
          id={`${id}-name`}
          value={draft.fullName}
          onChange={(event) => onChange({ ...draft, fullName: event.target.value })}
        />
      </FormField>

      <FormField label="patients.phone" htmlFor={`${id}-phone`} required>
        <Input
          id={`${id}-phone`}
          type="tel"
          dir="ltr"
          value={draft.phone}
          onChange={(event) => onChange({ ...draft, phone: event.target.value })}
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="patients.gender" htmlFor={`${id}-gender`} optional>
          <Select
            id={`${id}-gender`}
            value={draft.gender ?? ''}
            placeholder={t('common.notSpecified')}
            options={GENDERS.map((gender) => ({
              value: gender,
              label: t(`patients.${gender}`),
            }))}
            onChange={(event) => onChange({ ...draft, gender: event.target.value })}
          />
        </FormField>

        <FormField label="patients.dateOfBirth" htmlFor={`${id}-dob`} optional>
          <DatePicker
            id={`${id}-dob`}
            startView="years"
            label={t('patients.dateOfBirth')}
            value={draft.dateOfBirth ?? ''}
            onChange={(next) => onChange({ ...draft, dateOfBirth: next })}
          />
        </FormField>
      </div>

      <p className="text-label text-ink-muted">{t('patients.createInlineHint')}</p>
    </div>
  );
}
