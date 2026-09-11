import type { PatientClinicalView, PatientView } from '@clinic/shared';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  Avatar,
  Button,
  type Column,
  DropdownMenuItem,
  EmptyState,
  Icon,
  Ltr,
  PageHeader,
  PhoneLink,
  RowAction,
  RowMenu,
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
import { cn } from '@web/lib/cn';
import { useDebounced } from '@web/lib/use-debounced';
import { isRefetching } from '@web/lib/use-delayed-loading';

const PAGE_SIZE = 10;

/** The address the dashboard's overdue card and the retired standalone overdue screen both point at. */
const BALANCE_FILTER = 'balance';
const VISITED_FILTER = 'visited';

type PatientFilter = typeof BALANCE_FILTER | typeof VISITED_FILTER | 'all';

/** Local midnight on the first of this month, as a date the API reads without a timezone of its own. */
function startOfThisMonth(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function isClinicalView(patient: PatientView): patient is PatientClinicalView {
  return 'gender' in patient;
}

// The search runs on the server — a client-side filter over one page cannot find a patient among
// thousands — and is debounced. Columns follow the role's response shape.
export function PatientsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();

  // The bar owns the term and writes it here as `?q=`, so the URL is what this reads — a state copy
  // seeded at mount would ignore a search typed from another screen.
  const [page, setPage] = useState(1);
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [createOpen, setCreateOpen] = useState(false);

  const raw = params.get('filter');
  const filter: PatientFilter = raw === BALANCE_FILTER || raw === VISITED_FILTER ? raw : 'all';
  const setFilter = (next: PatientFilter): void => {
    setParams(
      {
        ...(search.trim() !== '' && { q: search }),
        ...(next !== 'all' && { filter: next }),
      },
      { replace: true },
    );
    setPage(1);
  };

  const debouncedSearch = useDebounced(search);

  // A new term starts at the first page; page 3 of the old results is meaningless for the new ones.
  // An effect rather than the setter's own job, because the setter is in the bar now.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
    ...(filter === BALANCE_FILTER && showBalance && { hasBalance: true }),
    ...(filter === VISITED_FILTER && { visitedSince: startOfThisMonth() }),
  });

  // `limit: 1` — the chip wants the total, not the rows, and the API returns it either way.
  const owing = usePatients({ page: 1, limit: 1, hasBalance: true }, { enabled: showBalance });

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
              <Ltr className="text-micro tabular-nums text-ink-subtle">{row.fileNumber}</Ltr>
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

          // The reference's `.bal`: a pill either way, so the column reads as one shape and the
          // colour is the only thing carrying the news.
          return (
            <Money
              amount={row.balance}
              currency={currency}
              className={cn(
                'inline-flex items-center justify-center rounded-pill px-[13px] py-[5px]',
                'text-label leading-none font-medium',
                owes ? 'bg-danger-100 text-danger-600' : 'bg-quiet-bg text-quiet-ink',
              )}
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
        <span className="flex items-center gap-1.5">
          <RowAction onClick={() => navigate(`/patients/${row.id}`)}>
            {t('patients.openFile')}
            <Icon name="chevron-end" className="size-4" />
          </RowAction>

          {/* The file's tabs are addresses, so the menu is shortcuts into them — each gated by the
              permission that gates the tab, so nothing here bounces the reader. */}
          <RowMenu label={t('patients.rowMenu')}>
            {showClinical && (
              <DropdownMenuItem
                icon="clock"
                onSelect={() => navigate(`/patients/${row.id}?tab=timeline`)}
              >
                {t('patients.tabs.timeline')}
              </DropdownMenuItem>
            )}
            {showBalance && (
              <DropdownMenuItem
                icon="money"
                onSelect={() => navigate(`/patients/${row.id}?tab=billing`)}
              >
                {t('patients.tabs.billing')}
              </DropdownMenuItem>
            )}
            {showClinical && (
              <DropdownMenuItem
                icon="image"
                onSelect={() => navigate(`/patients/${row.id}?tab=attachments`)}
              >
                {t('patients.tabs.attachments')}
              </DropdownMenuItem>
            )}
          </RowMenu>
        </span>
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
        {...(query.data !== undefined && {
          count: t('pagination.total', { total: query.data.total }),
        })}
        primaryAction={
          canCreate ? (
            <Button icon={<Icon name="user-plus" />} onClick={() => setCreateOpen(true)}>
              {t('patients.create')}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <SegmentedControl<PatientFilter>
          label={t('patients.filterLabel')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('common.all') },
            // The balance chip only where the response carries balances; the API would ignore the
            // parameter for a technician anyway, and a chip that does nothing is worse than none.
            ...(showBalance
              ? [
                  {
                    value: BALANCE_FILTER as PatientFilter,
                    label: t('patients.owing'),
                    // How many the filter would leave, on the chip that applies it.
                    ...(owing.data !== undefined && { count: owing.data.total }),
                  },
                ]
              : []),
            { value: VISITED_FILTER, label: t('patients.visitedThisMonth') },
          ]}
        />
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
