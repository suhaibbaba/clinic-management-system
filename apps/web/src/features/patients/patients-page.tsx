import type { PatientClinicalView, PatientView } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  Avatar,
  Button,
  type Column,
  EmptyState,
  Icon,
  Ltr,
  PageHeader,
  PhoneLink,
  RowAction,
  SearchField,
  SegmentedControl,
  Table,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { Money } from '@web/features/billing/money';
import { canSeeBilling } from '@web/features/billing/permissions';
import { useClinic } from '@web/features/clinic/queries';
import { PatientFormModal } from '@web/features/patients/patient-form-modal';
import { canCreatePatient, seesClinicalPatientFields } from '@web/features/patients/permissions';
import { usePatients } from '@web/features/patients/queries';
import { ageInYears } from '@web/features/patients/age';
import { useDebounced } from '@web/lib/use-debounced';
import { isRefetching } from '@web/lib/use-delayed-loading';

const PAGE_SIZE = 10;

/** The address the dashboard's overdue card and the retired standalone overdue screen both point at. */
const BALANCE_FILTER = 'balance';

function isClinicalView(patient: PatientView): patient is PatientClinicalView {
  return 'gender' in patient;
}

// The search runs on the server — a client-side filter over one page cannot find a patient among
// thousands — and is debounced. Columns follow the role's response shape.
export function PatientsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();

  // The URL owns the term: the top bar navigates here with `?q=` without remounting, so a state
  // copy seeded at mount would ignore it.
  const [page, setPage] = useState(1);
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const setSearch = (next: string): void => {
    // The balance filter survives a search: "who owes, called Ahmad" is a
    // question, and dropping half of it on the first keystroke is not.
    setParams(
      {
        ...(next.trim() !== '' && { q: next }),
        ...(params.get('filter') === BALANCE_FILTER && { filter: BALANCE_FILTER }),
      },
      { replace: true },
    );
    // A new search starts at the first page; page 3 of the old results is
    // meaningless for the new ones.
    setPage(1);
  };
  const [createOpen, setCreateOpen] = useState(false);
  const owingOnly = params.get('filter') === BALANCE_FILTER;
  const setOwingOnly = (next: boolean): void => {
    setParams(
      {
        ...(search.trim() !== '' && { q: search }),
        ...(next && { filter: BALANCE_FILTER }),
      },
      { replace: true },
    );
    setPage(1);
  };

  const debouncedSearch = useDebounced(search);
  const showClinical = user ? seesClinicalPatientFields(user.role) : false;
  const showBalance = user ? canSeeBilling(user.role) : false;
  const clinic = useClinic();
  const currency = clinic.data?.currency;

  const query = usePatients({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch.trim() !== '' && { search: debouncedSearch.trim() }),
    // Only for the roles the API serves balances to; for a technician the
    // parameter is ignored on both sides.
    ...(owingOnly && showBalance && { hasBalance: true }),
  });

  const columns = useMemo<Column<PatientView>[]>(() => {
    const base: Column<PatientView>[] = [
      {
        key: 'fullName',
        header: 'patients.fullName',
        primary: true,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar name={row.fullName} tintKey={row.id} />
            <span className="flex min-w-0 flex-col leading-snug">
              <span className="truncate font-medium text-ink">{row.fullName}</span>
              <Ltr className="text-label tabular-nums text-ink-subtle">{row.fileNumber}</Ltr>
            </span>
          </span>
        ),
      },
      {
        key: 'phone',
        header: 'patients.phone',
        render: (row) => <PhoneLink value={row.phone} />,
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

    // The API computes `balance` for every role but the technician, so the column exists exactly
    // when the response carries it.
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
              className={owes ? 'font-medium text-danger-600' : 'text-ink-subtle'}
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
        <RowAction onClick={() => navigate(`/patients/${row.id}`)}>
          {t('patients.openFile')}
          <Icon name="chevron-end" className="size-4" />
        </RowAction>
      ),
    });

    return base;
  }, [showClinical, showBalance, currency, navigate, t]);

  const canCreate = user ? canCreatePatient(user.role) : false;
  const isSearching = search.trim() !== '';
  const rows = query.data?.items ?? [];

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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchField
          className="w-full min-w-0 sm:max-w-md sm:flex-1"
          label={t('patients.search')}
          shortcut="/"
          placeholder={t('patients.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex items-center justify-between gap-3 sm:ms-auto">
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
            <span className="shrink-0 text-label text-ink-subtle">
              {t('pagination.total', { total: query.data.total })}
            </span>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
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
