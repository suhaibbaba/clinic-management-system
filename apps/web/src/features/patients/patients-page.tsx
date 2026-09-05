import type { PatientClinicalView, PatientView } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  SearchField,
  SegmentedControl,
  Table,
  type Column,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { Money } from '@web/features/billing/money';
import { canSeeBilling } from '@web/features/billing/permissions';
import { useClinic } from '@web/features/clinic/queries';
import { PatientFormModal } from '@web/features/patients/patient-form-modal';
import { canCreatePatient, seesClinicalPatientFields } from '@web/features/patients/permissions';
import { usePatients } from '@web/features/patients/queries';
import { ageInYears } from '@web/features/patients/patient-page';
import { cn } from '@web/lib/cn';
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

  /*
   * The URL owns the search term, rather than a `useState` seeded from it.
   *
   * The top bar navigates here with `?q=`, and when the user is *already* on
   * this screen that navigation does not remount the page — a state copy
   * seeded once at mount would silently ignore it. Reading the param directly
   * means there is only one answer to "what is being searched", and it also
   * makes a search reloadable, shareable and back-button-able for free.
   */
  const [page, setPage] = useState(1);
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const setSearch = (next: string): void => {
    setParams(next.trim() === '' ? {} : { q: next }, { replace: true });
    // A new search starts at the first page; page 3 of the old results is
    // meaningless for the new ones.
    setPage(1);
  };
  const [createOpen, setCreateOpen] = useState(false);
  /*
   * The Owing filter narrows the page in hand rather than asking the server:
   * the API takes no balance filter, and inventing a client-side "all
   * patients who owe" over one page would be a wrong answer wearing a
   * confident label. The segment says which of *these* rows to show, and the
   * count beside it stays the server's total.
   */
  const [owingOnly, setOwingOnly] = useState(false);

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
        key: 'fullName',
        header: 'patients.fullName',
        // The card's title on a phone; on a wide screen, the identity cell:
        // a tinted initial, the name, and the file number as its caption.
        // Two columns collapsed into one — the file number never needed a
        // header of its own, it needed to be under the name it belongs to.
        primary: true,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar name={row.fullName} tintKey={row.id} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold text-ink">{row.fullName}</span>
              <span dir="ltr" className="text-label tabular-nums text-ink-subtle">
                {row.fileNumber}
              </span>
            </span>
          </span>
        ),
      },
      {
        key: 'phone',
        header: 'patients.phone',
        render: (row) => (
          <span dir="ltr" className="tabular-nums">
            {row.phone}
          </span>
        ),
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
        // Long, wraps badly, and rarely the reason anyone opens this list.
        hideOnMobile: true,
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
        align: 'numeric',
        render: (row) => {
          if (row.balance === undefined) {
            return '—';
          }

          // Nothing owed is not news: it recedes. Something owed is the one
          // thing on this page that earns the red.
          const owes = Number(row.balance) > 0;

          return (
            <Money
              amount={row.balance}
              currency={currency}
              className={owes ? 'font-semibold text-danger-600' : 'text-ink-subtle'}
            />
          );
        },
      });
    }

    base.push({
      key: 'actions',
      header: 'common.actions',
      actions: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/patients/${row.id}`)}
          className={cn(
            'inline-flex cursor-pointer items-center gap-0.5 rounded-control px-1 py-0.5',
            'text-value font-medium text-primary-600',
            'transition-colors duration-150 hover:text-primary-700',
          )}
        >
          {t('patients.openFile')}
          <Icon name="chevron-end" className="size-4" />
        </button>
      ),
    });

    return base;
  }, [showClinical, showBalance, currency, navigate, t]);

  const canCreate = user ? canCreatePatient(user.role) : false;
  const isSearching = search.trim() !== '';
  const rows = (query.data?.items ?? []).filter(
    (row) => !owingOnly || Number(row.balance ?? '0') > 0,
  );

  return (
    <div>
      <PageHeader
        title="patients.title"
        subtitle="patients.subtitle"
        actions={
          canCreate ? (
            <Button icon={<Icon name="user-plus" />} onClick={() => setCreateOpen(true)}>
              {t('patients.create')}
            </Button>
          ) : undefined
        }
      />

      {/*
        Search and filter sit on the page, not on a card of their own: a
        toolbar is chrome, and giving it a white surface makes it read as
        content with a heading missing.
      */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchField
          className="min-w-0 flex-1 sm:max-w-sm"
          label={t('patients.search')}
          placeholder={t('patients.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {showBalance && (
          <SegmentedControl
            label={t('patients.filterByBalance')}
            value={owingOnly ? 'owing' : 'all'}
            onChange={(next) => setOwingOnly(next === 'owing')}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'owing', label: t('patients.owing') },
            ]}
          />
        )}

        {query.data !== undefined && (
          <span className="ms-auto text-label text-ink-subtle">
            {t('pagination.total', { total: query.data.total })}
          </span>
        )}
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        empty={
          <EmptyState
            title={isSearching ? 'patients.noMatches' : 'patients.empty'}
            hint={isSearching ? 'patients.noMatchesHint' : 'patients.emptyHint'}
            action={
              canCreate && !isSearching ? (
                <Button icon={<Icon name="user-plus" />} onClick={() => setCreateOpen(true)}>
                  {t('patients.create')}
                </Button>
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
