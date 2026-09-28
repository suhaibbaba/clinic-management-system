import type { PatientClinicalView, PatientSort, PatientView, SortDirection } from "@clinic/shared";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  DEFAULT_PER_PAGE,
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
  TotalBadge,
  type Column,
  useConfirm,
  usePageParams,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/providers/session";
import { Money } from "@web/components/billing/money";
import { canSeeBilling } from "@web/permissions/billing";
import { useClinic } from "@web/queries/clinic";
import { PatientFormModal } from "@web/components/patients/patient-form-modal";
import {
  canCreatePatient,
  canDeletePatient,
  canEditPatient,
  seesClinicalPatientFields,
} from "@web/permissions/patients";
import { useDeletePatient, usePatient, usePatients } from "@web/queries/patients";
import { errorMessageKey } from "@web/lib/api-error";
import { ageInYears } from "@web/lib/patients/age";
import { cn } from "@clinic/ui/lib/cn";
import { useDebounced } from "@web/hooks/shared/use-debounced";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { PATIENTS_BALANCE_FILTER, PATIENTS_VISITED_FILTER } from "@web/constants/patients";

type PatientFilter = typeof PATIENTS_BALANCE_FILTER | typeof PATIENTS_VISITED_FILTER | "all";

function startOfThisMonth(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function isClinicalView(patient: PatientView): patient is PatientClinicalView {
  return "gender" in patient;
}

export function PatientsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, can } = useSession();

  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = usePatient(editingId ?? "");

  const raw = params.get("filter");
  const filter: PatientFilter =
    raw === PATIENTS_BALANCE_FILTER || raw === PATIENTS_VISITED_FILTER ? raw : "all";
  const sortBy: PatientSort | null = params.get("sort") === "balance" ? "balance" : null;
  const sortDir: SortDirection = params.get("dir") === "asc" ? "asc" : "desc";

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
  const { confirm, dialog } = useConfirm("patients-confirm-delete");

  const destroy = useCallback(
    (patient: PatientView): void =>
      confirm({
        title: "patients.confirmDelete.title",
        titleValues: { name: patient.fullName },
        consequences: [t("patients.confirmDelete.consequence")],
        onConfirm: async () => {
          try {
            await deletePatient(patient.id);
            toast.success("patients.deleted");
          } catch (error) {
            toast.error(errorMessageKey(error));
            throw error;
          }
        },
      }),
    [confirm, deletePatient, t, toast],
  );
  const clinic = useClinic();
  const currency = clinic.data?.currency;

  const query = usePatients({
    page,
    limit: perPage,
    ...(debouncedSearch.trim() !== "" && { search: debouncedSearch.trim() }),
    ...(filter === PATIENTS_BALANCE_FILTER && showBalance && { hasBalance: true }),
    ...(filter === PATIENTS_VISITED_FILTER && { visitedSince: startOfThisMonth() }),
    ...(sortBy !== null && showBalance && { sort: sortBy, dir: sortDir }),
  });

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
              <span
                className={cn(
                  "flex min-w-0 flex-col leading-label",
                  row.profileIncomplete && "gap-2",
                )}
              >
                <span
                  data-testid="patient-name"
                  className="truncate font-medium text-ink group-hover:text-primary-700 group-hover:underline"
                >
                  {row.fullName}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Ltr className="text-micro tabular-nums text-ink-subtle">{row.fileNumber}</Ltr>
                  {row.profileIncomplete && (
                    <Badge tone="warning" data-testid="patient-incomplete">
                      {t("patients.incomplete")}
                    </Badge>
                  )}
                </span>
              </span>
            </Link>
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
                onSelect={() => destroy(row)}
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
      {dialog}
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
                    value: PATIENTS_BALANCE_FILTER as PatientFilter,
                    label: t("patients.owing"),
                    ...(owing.data !== undefined && { count: owing.data.total }),
                  },
                ]
              : []),
            { value: PATIENTS_VISITED_FILTER, label: t("patients.visitedThisMonth") },
          ]}
        />

        {query.data !== undefined && (
          <TotalBadge data-testid="patients-count" total={query.data.total} />
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
