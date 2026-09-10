import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Icon, Ltr, SearchField } from '@web/components/ui';
import { usePatients } from '@web/features/patients/queries';
import { useDebounced } from '@web/lib/use-debounced';
import { cn } from '@web/lib/cn';

// Not a whole patient record: the calendar feed already carries these four, and they are all a
// receptionist's response contains.
export interface PickedPatient {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string;
  readonly fileNumber: string;
}

export interface PatientPickerProps {
  readonly value: PickedPatient | null;
  readonly onChange: (patient: PickedPatient | null) => void;
  readonly id: string;
}

// A `<select>` of every patient is unusable past a few hundred rows, so this reuses the search
// reception already knows and the same identity cell.
export function PatientPicker({ value, onChange, id }: PatientPickerProps): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const results = usePatients({
    limit: 8,
    ...(debounced.trim() !== '' && { search: debounced.trim() }),
  });

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-control border border-line bg-inset px-3 py-2">
        <Avatar name={value.fullName} tintKey={value.id} />
        <span className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="truncate text-value font-medium text-ink">{value.fullName}</span>
          <Ltr className="truncate text-label tabular-nums text-ink-subtle">{value.phone}</Ltr>
        </span>
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

  return (
    <div className="flex flex-col gap-2">
      <SearchField
        id={id}
        label={t('patients.search')}
        placeholder={t('patients.searchPlaceholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {search.trim() !== '' && (
        <ul className="max-h-56 overflow-y-auto rounded-control border border-line">
          {results.data?.items.length === 0 && (
            <li className="px-3 py-2.5 text-label text-ink-muted">{t('patients.noMatches')}</li>
          )}

          {results.data?.items.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(patient);
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
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
