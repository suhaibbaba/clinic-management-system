import type { PatientClinicalView, PatientView } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button, EmptyState, Input, PageHeader, Table, type Column } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { Money } from '@web/features/billing/money';
import { canSeeBilling } from '@web/features/billing/permissions';
import { useClinic } from '@web/features/clinic/queries';
import { PatientFormModal } from '@web/features/patients/patient-form-modal';
import { canCreatePatient, seesClinicalPatientFields } from '@web/features/patients/permissions';
import { usePatients } from '@web/features/patients/queries';
import { ageInYears } from '@web/features/patients/patient-page';
import { useDebounced } from '@web/lib/use-debounced';

const PAGE_SIZE = 10;

/** True when the response carries the clinical fields, not just the public ones. */
function isClinicalView(patient: PatientView): patient is PatientClinicalView {
  return 'gender' in patient;
}

/**
 * The way reception finds a patient: one search box over name, phone and file
 * number, and a page of results under it.
 *
 * The search runs on the server — the whole point is to find a patient among
 * thousands, which a client-side filter over one page cannot do — and is
 * debounced so a burst of typing is one request, not eight.
 *
 * Which columns exist follows the role. The API hands a receptionist and a
 * technician `PatientPublicView`, so the table can only render what it was
 * given; the extra columns are not merely hidden, they are absent
 * (ROLES.md field-level security).
 */
export function PatientsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const debouncedSearch = useDebounced(search);
  const showClinical = user ? seesClinicalPatientFields(user.role) : false;
  const showBalance = user ? canSeeBilling(user.role) : false;
  const clinic = useClinic();
  const currency = clinic.data?.currency;

  const query = usePatients({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch.trim() !== '' && { search: debouncedSearch.trim() }),
  });

  const columns = useMemo<Column<PatientView>[]>(() => {
    const base: Column<PatientView>[] = [
      {
        key: 'fileNumber',
        header: 'patients.fileNumber',
        render: (row) => (
          <span dir="ltr" className="font-mono text-xs">
            {row.fileNumber}
          </span>
        ),
      },
      {
        key: 'fullName',
        header: 'patients.fullName',
        render: (row) => <span className="font-medium text-gray-900">{row.fullName}</span>,
      },
      {
        key: 'phone',
        header: 'patients.phone',
        render: (row) => <span dir="ltr">{row.phone}</span>,
      },
      {
        key: 'age',
        header: 'patients.age',
        render: (row) =>
          row.dateOfBirth ? t('patients.years', { count: ageInYears(row.dateOfBirth) }) : '—',
      },
    ];

    // Only for the roles whose response actually carries these fields.
    if (showClinical) {
      base.push({
        key: 'address',
        header: 'patients.address',
        render: (row) => (isClinicalView(row) ? (row.address ?? '—') : '—'),
      });
    }

    // ROLES.md lists `balance` on `PatientPublicView`, and the API computes it
    // for every role but the technician — so the column exists exactly when
    // the response carries it.
    if (showBalance) {
      base.push({
        key: 'balance',
        header: 'patients.balance',
        render: (row) =>
          row.balance === undefined ? (
            '—'
          ) : (
            <Money amount={row.balance} currency={currency} signed />
          ),
      });
    }

    base.push({
      key: 'actions',
      header: 'common.actions',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${row.id}`)}>
          {t('patients.openFile')}
        </Button>
      ),
    });

    return base;
  }, [showClinical, showBalance, currency, navigate, t]);

  const canCreate = user ? canCreatePatient(user.role) : false;
  const isSearching = search.trim() !== '';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="patients.title"
        subtitle="patients.subtitle"
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>{t('patients.create')}</Button>
          ) : undefined
        }
      />

      {/* Search first: this screen exists to answer "where is this patient?". */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label htmlFor="patient-search" className="mb-1.5 block text-sm font-medium text-gray-800">
          {t('patients.search')}
        </label>
        <Input
          id="patient-search"
          type="search"
          className="h-12 text-base"
          placeholder={t('patients.searchPlaceholder')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            // A new search starts at the first page; page 3 of the old results
            // is meaningless for the new ones.
            setPage(1);
          }}
        />
      </div>

      <Table
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        empty={
          <EmptyState
            title={isSearching ? 'patients.noMatches' : 'patients.empty'}
            hint={isSearching ? 'patients.noMatchesHint' : 'patients.emptyHint'}
            action={
              canCreate && !isSearching ? (
                <Button onClick={() => setCreateOpen(true)}>{t('patients.create')}</Button>
              ) : undefined
            }
          />
        }
        pagination={{
          page,
          totalPages: query.data?.totalPages ?? 0,
          total: query.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <PatientFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(patientId) => navigate(`/patients/${patientId}`)}
      />
    </div>
  );
}
