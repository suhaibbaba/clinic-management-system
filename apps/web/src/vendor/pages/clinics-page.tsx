import {
  localized,
  shortDate,
  SUBSCRIPTION_STATUSES,
  VENDOR_CLINIC_FILTER,
  type VendorClinicSummary,
  type VendorClinicsQuery,
} from "@clinic/shared";
import { Input } from "@clinic/ui/components/input";
import { Select } from "@clinic/ui/components/select";
import { StatCard } from "@clinic/ui/components/stat-card";
import { Table, type Column } from "@clinic/ui/components/table";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { ModuleList } from "@web/vendor/components/module-list";
import { StatusBadge } from "@web/vendor/components/status-badge";
import { VENDOR_PAGE_SIZE, VENDOR_PARAM } from "@web/vendor/constants";
import type { VendorLocation } from "@web/vendor/hooks/use-location";
import { vendorPath } from "@web/vendor/lib/route";
import { useClinics, useOverview } from "@web/vendor/queries";

const ALL = "all";

const statusParam = (value: string | null): VendorClinicsQuery["status"] =>
  value === VENDOR_CLINIC_FILTER.NONE ||
  SUBSCRIPTION_STATUSES.includes(value as (typeof SUBSCRIPTION_STATUSES)[number])
    ? (value as VendorClinicsQuery["status"])
    : undefined;

export function ClinicsPage({ location }: { readonly location: VendorLocation }): JSX.Element {
  const { t, i18n } = useTranslation();
  const { params, navigate } = location;
  const search = params.get(VENDOR_PARAM.SEARCH) ?? "";
  const status = statusParam(params.get(VENDOR_PARAM.STATUS));
  const page = Math.max(1, Number(params.get(VENDOR_PARAM.PAGE)) || 1);
  const overview = useOverview();
  const clinics = useClinics({ search, status, page, limit: VENDOR_PAGE_SIZE });

  const setParam = (key: string, value: string | undefined): void => {
    const next = new URLSearchParams(params);

    if (value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    if (key !== VENDOR_PARAM.PAGE) {
      next.delete(VENDOR_PARAM.PAGE);
    }

    const text = next.toString();
    navigate(`${vendorPath({ kind: "clinics" })}${text ? `?${text}` : ""}`, { replace: true });
  };

  const columns: Column<VendorClinicSummary>[] = [
    {
      key: "clinic",
      header: t("vendor.clinics.columns.clinic"),
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{localized(row.name, i18n.language)}</span>
          <span className="text-meta text-ink-muted" dir="ltr">
            {row.domain ?? row.slug}
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
      render: (row) => <ModuleList modules={row.modules} />,
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
      render: (row) => <StatusBadge status={row.subscription?.status ?? null} />,
    },
  ];

  const stats = overview.data;

  return (
    <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3" data-testid="vendor-overview">
        <StatCard label={t("vendor.overview.clinics")} value={stats?.clinics ?? "—"} icon="users" />
        <StatCard label={t("vendor.overview.active")} value={stats?.active ?? "—"} tone="success" />
        <StatCard label={t("vendor.overview.trial")} value={stats?.trial ?? "—"} tone="primary" />
        <StatCard
          label={t("vendor.overview.endingSoon")}
          value={stats?.endingSoon ?? "—"}
          tone={stats && stats.endingSoon > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label={t("vendor.overview.readOnly")}
          value={stats?.readOnly ?? "—"}
          tone={stats && stats.readOnly > 0 ? "danger" : "neutral"}
        />
        <StatCard label={t("vendor.overview.unmanaged")} value={stats?.unmanaged ?? "—"} />
      </section>

      <Table
        data-testid="vendor-clinics"
        header={
          <div className="flex flex-wrap gap-3">
            <Input
              type="search"
              aria-label={t("vendor.clinics.search")}
              placeholder={t("vendor.clinics.search")}
              defaultValue={search}
              className="max-w-(--field-max)"
              onChange={(event) => setParam(VENDOR_PARAM.SEARCH, event.target.value.trim())}
              data-testid="vendor-clinics-search"
            />
            <Select
              aria-label={t("vendor.clinics.columns.status")}
              value={status ?? ALL}
              onChange={(event) =>
                setParam(
                  VENDOR_PARAM.STATUS,
                  event.target.value === ALL ? undefined : event.target.value,
                )
              }
              options={[
                { value: ALL, label: t("vendor.clinics.allStatuses") },
                ...SUBSCRIPTION_STATUSES.map((value) => ({
                  value,
                  label: t(`vendor.status.${value}`),
                })),
                { value: VENDOR_CLINIC_FILTER.NONE, label: t("vendor.clinics.noSubscription") },
              ]}
              data-testid="vendor-clinics-status"
            />
          </div>
        }
        columns={columns}
        rows={clinics.data?.items ?? []}
        rowKey={(row) => row.id}
        rowLabel={(row) => localized(row.name, i18n.language)}
        isLoading={clinics.isPending}
        isRefreshing={clinics.isFetching && !clinics.isPending}
        onRowClick={(row) => navigate(vendorPath({ kind: "clinic", id: row.id }))}
        empty={<p className="p-6 text-center text-ink-muted">{t("vendor.clinics.empty")}</p>}
        pagination={{
          page,
          totalPages: clinics.data?.totalPages ?? 1,
          onPageChange: (next) => setParam(VENDOR_PARAM.PAGE, String(next)),
        }}
      />
    </>
  );
}
