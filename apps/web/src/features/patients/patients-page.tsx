import type { PatientClinicalView, PatientSort, PatientView, SortDirection } from "@clinic/shared";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  PageHeader,
  PhoneLink,
  RowMenu,
  SegmentedControl,
  Table,
  usePageParams,
  useToast,
  type Column,
} from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { Money } from "@web/features/billing/money";
import { canSeeBilling } from "@web/features/billing/permissions";
import { useClinic } from "@web/features/clinic/queries";
import { PatientFormModal } from "@web/features/patients/patient-form-modal";
import {
  canCreatePatient,
  canDeletePatient,
  canEditPatient,
  seesClinicalPatientFields,
} from "@web/features/patients/permissions";
import { useDeletePatient, usePatient, usePatients } from "@web/features/patients/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { ageInYears } from "@web/features/patients/age";
import { cn } from "@clinic/ui/lib/cn";
import { useDebounced } from "@web/lib/use-debounced";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

const DEFAULT_PER_PAGE = 10;

/** The address the dashboard's overdue card and the retired standalone overdue screen both point at. */
const BALANCE_FILTER = "balance";
const VISITED_FILTER = "visited";

type PatientFilter = typeof BALANCE_FILTER | typeof VISITED_FILTER | "all";

/** Local midnight on the first of this month, as a date the API reads without a timezone of its own. */
function startOfThisMonth(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function isClinicalView(patient: PatientView): patient is PatientClinicalView {
  return "gender" in patient;
}

// The search runs on the server — a client-side filter over one page cannot find a patient among
// thousands — and is debounced. Columns follow the role's response shape.
export function PatientsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, can } = useSession();

  // The bar owns the term and writes it here as `?q=`, so the URL is what this reads — a state copy
  // seeded at mount would ignore a search typed from another screen.
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams(DEFAULT_PER_PAGE);
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The form edits the full record, which a list row does not carry for every role.
  const editing = usePatient(editingId ?? "");

  const raw = params.get("filter");
  const filter: PatientFilter = raw === BALANCE_FILTER || raw === VISITED_FILTER ? raw : "all";
  const sortBy: PatientSort | null = params.get("sort") === "balance" ? "balance" : null;
  const sortDir: SortDirection = params.get("dir") === "asc" ? "asc" : "desc";

  // One write, not two: this form replaces the whole query string, so the page goes with it — and a
  // second `resetPage()` here would land on the params as they were and put the filter back.
  const writeParams = (next: {
    readonly filter?: PatientFilter;
    readonly sort?: PatientSort | null;
    readonly dir?: SortDirection;
  }): void => {
    const nextFilter = next.filter ?? filter;
    const nextSort = next.sort === undefined ? sortBy : next.sort;
    const nextDir = next.dir ?? sortDir;

    setParams(
      {
        ...(search.trim() !== "" && { q: search }),
        ...(nextFilter !== "all" && { filter: nextFilter }),
        ...(nextSort !== null && { sort: nextSort }),
        ...(nextSort !== null && nextDir === "asc" && { dir: nextDir }),
        ...(perPage !== DEFAULT_PER_PAGE && { perPage: String(perPage) }),
      },
      { replace: true },
    );
  };
  const setFilter = (next: PatientFilter): void => writeParams({ filter: next });

  const debouncedSearch = useDebounced(search);

  const lastSearch = useRef(debouncedSearch);

  useEffect(() => {
    if (lastSearch.current !== debouncedSearch) {
      lastSearch.current = debouncedSearch;
      resetPage();
    }
  }, [debouncedSearch]);

  const showClinical = user ? seesClinicalPatientFields(user.role) : false;
  const showBalance = user ? canSeeBilling(user.role) : false;
  const showDelete = canDeletePatient(can);
  const showEdit = canEditPatient(can);
  const toast = useToast();
  const { mutateAsync: deletePatient } = useDeletePatient();

  const destroy = useCallback(
    async (patient: PatientView): Promise<void> => {
      if (!window.confirm(t("patients.confirmDelete", { name: patient.fullName }))) {
        return;
      }

      try {
        await deletePatient(patient.id);
        toast.success("patients.deleted");
      } catch (error) {
        toast.error(errorMessageKey(error));
      }
    },
    [deletePatient, t, toast],
  );
  const clinic = useClinic();
  const currency = clinic.data?.currency;

  const query = usePatients({
    page,
    limit: perPage,
    ...(debouncedSearch.trim() !== "" && { search: debouncedSearch.trim() }),
    ...(filter === BALANCE_FILTER && showBalance && { hasBalance: true }),
    ...(filter === VISITED_FILTER && { visitedSince: startOfThisMonth() }),
    ...(sortBy !== null && showBalance && { sort: sortBy, dir: sortDir }),
  });

  // `limit: 1` — the chip wants the total, not the rows, and the API returns it either way.
  const owing = usePatients({ page: 1, limit: 1, hasBalance: true }, { enabled: showBalance });

  const columns = useMemo<Column<PatientView>[]>(() => {
    const base: Column<PatientView>[] = [
      {
        key: "fullName",
        header: "patients.fullName",
        primary: true,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Link
              to={`/patients/${row.id}`}
              data-testid="patient-link"
              className="group flex min-w-0 items-center gap-3 rounded-control"
            >
              <Avatar name={row.fullName} tintKey={row.id} data-testid="patient-avatar" />
              <span className="flex min-w-0 flex-col leading-label">
                <span
                  data-testid="patient-name"
                  className="truncate font-medium text-ink group-hover:text-primary-700 group-hover:underline"
                >
                  {row.fullName}
                </span>
                <Ltr className="text-micro tabular-nums text-ink-subtle">{row.fileNumber}</Ltr>
              </span>
            </Link>
            {/* Registered mid-booking or online, and never finished — the reminder to take the
                rest of it when they walk in. */}
            {row.profileIncomplete && (
              <Badge tone="warning" data-testid="patient-incomplete">
                {t("patients.incomplete")}
              </Badge>
            )}
          </span>
        ),
      },
      {
        key: "phone",
        header: "patients.phone",
        render: (row) => <PhoneLink value={row.phone} />,
      },
      {
        key: "age",
        header: "patients.age",
        render: (row) =>
          row.dateOfBirth ? t("patients.years", { count: ageInYears(row.dateOfBirth) }) : "—",
      },
    ];

    if (showClinical) {
      base.push({
        key: "address",
        hideOnMobile: true,
        header: "patients.address",
        render: (row) => (isClinicalView(row) ? (row.address ?? "—") : "—"),
      });
    }

    // The API computes `balance` for every role but the technician, so the column exists exactly
    // when the response carries it.
    if (showBalance) {
      base.push({
        key: "balance",
        header: "patients.balance",
        align: "numeric",
        sortKey: "balance",
        render: (row) => {
          if (row.balance === undefined) {
            return "—";
          }

          const owes = Number(row.balance) > 0;

          // The reference's `.bal`: a pill either way, so the column reads as one shape and the
          // colour is the only thing carrying the news.
          return (
            <Money
              amount={row.balance}
              currency={currency}
              className={cn(
                "pill-text inline-flex items-center h-(--control-h-sm) justify-center rounded-pill px-3",
                "text-label font-medium",
                owes ? "bg-danger-100 text-danger-600" : "bg-quiet-bg text-quiet-ink",
              )}
            />
          );
        },
      });
    }

    if (showEdit || showDelete) {
      base.push({
        key: "actions",
        header: "common.actions",
        actions: true,
        besideTitleOnMobile: true,
        render: (row) => (
          <RowMenu label={t("patients.rowMenu")} data-testid="patient-menu">
            {showEdit && (
              <MenuItem
                icon="edit"
                data-testid="patient-menu-edit"
                onSelect={() => setEditingId(row.id)}
              >
                {t("patients.edit")}
              </MenuItem>
            )}
            {showDelete && (
              <MenuItem
                icon="trash"
                tone="danger"
                data-testid="patient-menu-delete"
                onSelect={() => void destroy(row)}
              >
                {t("common.delete")}
              </MenuItem>
            )}
          </RowMenu>
        ),
      });
    }

    return base;
  }, [showClinical, showBalance, showEdit, showDelete, destroy, currency, t]);

  const canCreate = canCreatePatient(can);
  const isSearching = search.trim() !== "";
  const rows = query.data?.items ?? [];

  return (
    <div data-testid="patients-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="patients-header"
        title="patients.title"
        subtitle="patients.subtitle"
        primaryAction={
          canCreate ? (
            <Button
              icon={<Icon name="user-plus" />}
              data-testid="patients-create"
              onClick={() => setCreateOpen(true)}
            >
              {t("patients.create")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <SegmentedControl<PatientFilter>
          data-testid="patients-filter"
          label={t("patients.filterLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("common.all") },
            ...(showBalance
              ? [
                  {
                    value: BALANCE_FILTER as PatientFilter,
                    label: t("patients.owing"),
                    ...(owing.data !== undefined && { count: owing.data.total }),
                  },
                ]
              : []),
            { value: VISITED_FILTER, label: t("patients.visitedThisMonth") },
          ]}
        />

        {query.data !== undefined && (
          <Badge tone="wash" plain data-testid="patients-count" className="shrink-0">
            {t("pagination.total", { total: query.data.total })}
          </Badge>
        )}
      </div>

      <Table
        data-testid="patients-table"
        columns={columns}
        {...(showBalance && {
          sort: {
            key: sortBy,
            dir: sortDir,
            onChange: (key, dir) =>
              writeParams({ sort: key === "balance" ? "balance" : null, dir }),
          },
        })}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
        empty={
          <EmptyState
            data-testid="patients-empty"
            title={isSearching ? "patients.noMatches" : "patients.empty"}
            hint={isSearching ? "patients.noMatchesHint" : "patients.emptyHint"}
            action={
              canCreate && !isSearching ? (
                <Button
                  icon={<Icon name="user-plus" />}
                  data-testid="patients-empty-create"
                  onClick={() => setCreateOpen(true)}
                >
                  {t("patients.create")}
                </Button>
              ) : undefined
            }
          />
        }
        pagination={{
          page,
          totalPages: query.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      {editing.data && (
        <PatientFormModal
          data-testid="patients-edit-modal"
          open={editingId !== null}
          onOpenChange={(open) => !open && setEditingId(null)}
          patient={editing.data}
        />
      )}

      <PatientFormModal
        data-testid="patients-create-modal"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(patientId) => navigate(`/patients/${patientId}`)}
      />
    </div>
  );
}
