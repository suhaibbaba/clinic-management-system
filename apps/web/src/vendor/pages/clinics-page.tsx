import {
  localized,
  shortDate,
  SUBSCRIPTION_STATUS,
  VENDOR_CLINIC_FILTER,
  type VendorClinicSummary,
  type VendorClinicsQuery,
  type VendorOverview,
} from "@clinic/shared";
import { Button } from "@clinic/ui/components/button";
import { Icon } from "@clinic/ui/components/icon";
import { MenuItem, MenuSeparator, RowMenu } from "@clinic/ui/components/menu";
import { Table, type Column } from "@clinic/ui/components/table";
import { Tabs } from "@clinic/ui/components/tabs";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { ClinicMark } from "@web/vendor/components/clinic-mark";
import { NewClinicDrawer } from "@web/vendor/components/new-clinic-drawer";
import { StatusBadge } from "@web/vendor/components/status-badge";
import { VENDOR_PAGE_SIZE, VENDOR_PARAM } from "@web/vendor/constants";
import { useClinicActions } from "@web/vendor/hooks/use-clinic-actions";
import type { VendorLocation } from "@web/vendor/hooks/use-location";
import { clinicAddresses } from "@web/vendor/lib/domain";
import { vendorPath } from "@web/vendor/lib/route";
import { useClinics, useOverview } from "@web/vendor/queries";

const ALL = "all";

type Filter = typeof ALL | NonNullable<VendorClinicsQuery["status"]>;

const FILTERS: readonly {
  readonly id: Filter;
  readonly count: (overview: VendorOverview) => number;
}[] = [
  { id: ALL, count: (overview) => overview.clinics },
  { id: SUBSCRIPTION_STATUS.ACTIVE, count: (overview) => overview.active },
  { id: SUBSCRIPTION_STATUS.TRIAL, count: (overview) => overview.trial },
  { id: SUBSCRIPTION_STATUS.GRACE, count: (overview) => overview.grace },
  { id: SUBSCRIPTION_STATUS.SUSPENDED, count: (overview) => overview.suspended },
  { id: SUBSCRIPTION_STATUS.CANCELLED, count: (overview) => overview.cancelled },
  { id: VENDOR_CLINIC_FILTER.NONE, count: (overview) => overview.unmanaged },
  { id: VENDOR_CLINIC_FILTER.REMOVED, count: (overview) => overview.removed },
];

const filterOf = (value: string | null): Filter =>
  FILTERS.find((filter) => filter.id === value)?.id ?? ALL;

export function ClinicsPage({ location }: { readonly location: VendorLocation }): JSX.Element {
  const { t, i18n } = useTranslation();
  const { params, navigate } = location;
  const search = params.get(VENDOR_PARAM.SEARCH) ?? "";
  const filter = filterOf(params.get(VENDOR_PARAM.STATUS));
  const page = Math.max(1, Number(params.get(VENDOR_PARAM.PAGE)) || 1);
  const creating = params.get(VENDOR_PARAM.NEW) === "1";
  const overview = useOverview();
  const clinics = useClinics({
    search,
    ...(filter !== ALL && { status: filter }),
    page,
    limit: VENDOR_PAGE_SIZE,
  });
  const { actionsFor, dialog } = useClinicActions();
  const removedView = filter === VENDOR_CLINIC_FILTER.REMOVED;

  const setParams = (changes: Readonly<Record<string, string | undefined>>): void => {
    const next = new URLSearchParams(params);

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    const text = next.toString();
    navigate(`${vendorPath({ kind: "clinics" })}${text ? `?${text}` : ""}`, { replace: true });
  };

  const rows = clinics.data?.items ?? [];

  const columns: Column<VendorClinicSummary>[] = [
    {
      key: "clinic",
      header: t("vendor.clinics.columns.clinic"),
      primary: true,
      render: (row) => (
        <span className="flex items-center gap-3">
          <ClinicMark clinic={row} />
          <span className="flex min-w-0 flex-col">
            <span className="font-bold text-ink">{localized(row.name, i18n.language)}</span>
            <span className="truncate text-meta text-ink-muted" dir="ltr">
              {row.domain ?? row.slug}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "plan",
      header: t("vendor.clinics.columns.plan"),
      render: (row) => row.subscription?.planName ?? "—",
    },
    {
      key: "specialties",
      header: t("vendor.clinics.columns.specialties"),
      hideOnMobile: true,
      render: (row) =>
        row.specialties.length === 0
          ? "—"
          : new Intl.ListFormat(i18n.language).format(
              row.specialties.map((code) => t(`vendor.specialtyNames.${code}`, code)),
            ),
    },
    {
      key: "modules",
      header: t("vendor.clinics.columns.modules"),
      hideOnMobile: true,
      render: (row) => (
        <span className="rounded-pill bg-primary-50 px-2.5 py-0.5 text-meta text-primary-700">
          {t("vendor.clinics.moduleCount", { count: row.modules.length })}
        </span>
      ),
    },
    {
      key: "users",
      header: t("vendor.clinics.columns.users"),
      align: "numeric",
      render: (row) => row.users,
    },
    {
      key: "endsOn",
      header: t("vendor.clinics.columns.endsOn"),
      render: (row) =>
        row.subscription?.endsOn ? (
          <span dir="ltr" className="whitespace-nowrap">
            {shortDate(row.subscription.endsOn)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: t("vendor.clinics.columns.status"),
      render: (row) =>
        row.removedAt ? (
          <span className="rounded-pill bg-sunken px-2.5 py-0.5 text-meta font-bold text-ink-muted">
            {t("vendor.clinics.removed")}
          </span>
        ) : (
          <StatusBadge status={row.subscription?.status ?? null} />
        ),
    },
    {
      key: "actions",
      header: t("vendor.clinics.columns.actions"),
      actions: true,
      render: (row) => {
        const act = actionsFor(row);

        return (
          <RowMenu label={t("vendor.actions.label")} data-testid={`vendor-row-menu-${row.id}`}>
            <MenuItem
              icon="eye"
              onSelect={() => navigate(vendorPath({ kind: "clinic", id: row.id }))}
            >
              {t("vendor.actions.open")}
            </MenuItem>
            {row.removedAt ? (
              <MenuItem icon="reset" onSelect={act.restore} data-testid="vendor-action-restore">
                {t("vendor.actions.restore")}
              </MenuItem>
            ) : (
              <>
                {act.extend && (
                  <MenuItem
                    icon="calendar"
                    onSelect={act.extend}
                    data-testid="vendor-action-extend"
                  >
                    {t("vendor.actions.extend")}
                  </MenuItem>
                )}
                {row.domain && (
                  <MenuItem
                    icon="monitor"
                    onSelect={() =>
                      window.open(clinicAddresses(row.domain ?? "").dashboard, "_blank", "noopener")
                    }
                  >
                    {t("vendor.actions.openDashboard")}
                  </MenuItem>
                )}
                {act.suspend && (
                  <MenuItem icon="stop" onSelect={act.suspend} data-testid="vendor-action-suspend">
                    {t("vendor.actions.suspend")}
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem
                  icon="trash"
                  tone="danger"
                  onSelect={act.remove}
                  data-testid="vendor-action-remove"
                >
                  {t("vendor.actions.remove")}
                </MenuItem>
              </>
            )}
          </RowMenu>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline font-extrabold text-ink">{t("vendor.nav.clinics")}</h1>
          {overview.data && (
            <p className="text-label text-ink-muted">
              {t("vendor.clinics.summary", { count: overview.data.clinics })}
              {overview.data.endingSoon > 0 &&
                ` · ${t("vendor.clinics.endingSoon", { count: overview.data.endingSoon })}`}
            </p>
          )}
        </div>
        <Button
          icon={<Icon name="plus" />}
          onClick={() => setParams({ [VENDOR_PARAM.NEW]: "1" })}
          data-testid="vendor-new-clinic-open"
        >
          {t("vendor.newClinic.open")}
        </Button>
      </div>

      <Tabs
        label={t("vendor.clinics.columns.status")}
        value={filter}
        onChange={(id) =>
          setParams({
            [VENDOR_PARAM.STATUS]: id === ALL ? undefined : id,
            [VENDOR_PARAM.PAGE]: undefined,
          })
        }
        tabs={FILTERS.map((entry) => ({
          id: entry.id,
          label: t(`vendor.filters.${entry.id}`),
          ...(overview.data && { count: entry.count(overview.data) }),
        }))}
        data-testid="vendor-filters"
      />

      {search && (
        <p className="flex items-center gap-2 text-label text-ink-muted">
          {t("vendor.clinics.searching", { search })}
          <button
            type="button"
            className="cursor-pointer text-primary-700 underline"
            onClick={() =>
              setParams({ [VENDOR_PARAM.SEARCH]: undefined, [VENDOR_PARAM.PAGE]: undefined })
            }
          >
            {t("vendor.clinics.clearSearch")}
          </button>
        </p>
      )}

      <Table
        data-testid="vendor-clinics"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => localized(row.name, i18n.language)}
        isLoading={clinics.isPending}
        isRefreshing={clinics.isFetching && !clinics.isPending}
        onRowClick={(row) => navigate(vendorPath({ kind: "clinic", id: row.id }))}
        empty={
          <p className="p-6 text-center text-ink-muted">
            {t(removedView ? "vendor.clinics.noneRemoved" : "vendor.clinics.empty")}
          </p>
        }
        pagination={{
          page,
          totalPages: clinics.data?.totalPages ?? 1,
          onPageChange: (next) => setParams({ [VENDOR_PARAM.PAGE]: String(next) }),
        }}
      />

      {dialog}

      <NewClinicDrawer
        open={creating}
        onOpenChange={(open) => !open && setParams({ [VENDOR_PARAM.NEW]: undefined })}
        onCreated={(id) => navigate(vendorPath({ kind: "clinic", id }))}
      />
    </>
  );
}
