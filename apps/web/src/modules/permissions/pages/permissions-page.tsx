import { type UserRole } from "@clinic/shared";
import { useEffect, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button, EmptyState, Icon, PageHeader, SearchField, useToast } from "@clinic/ui";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";
import { usePermissions, useUpdateRolePermission } from "@web/modules/permissions/queries";
import { PermissionSectionCard } from "@web/modules/permissions/components/permission-section-card";
import { buildSections, filterSections } from "@web/modules/permissions/lib/permission-sections";
import { useDebounced } from "@web/shared/hooks/use-debounced";
import { errorToast } from "@web/shared/lib/api-error";
import { ellipsis } from "@web/i18n/ellipsis";

type Allows = Readonly<Record<string, boolean>>;

export function PermissionsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const permissions = usePermissions();
  const update = useUpdateRolePermission();
  const { showSkeleton } = useQueryLoading(permissions);
  const [params, setParams] = useSearchParams();

  const query = params.get("q") ?? "";
  const [search, setSearch] = useState(query);
  const debounced = useDebounced(search);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (debounced.trim() === "") next.delete("q");
        else next.set("q", debounced);
        return next;
      },
      { replace: true },
    );
  }, [debounced, setParams]);

  const allows = useMemo(() => {
    const map = new Map<UserRole, Allows>();
    for (const entry of permissions.data?.roles ?? []) {
      map.set(entry.role, entry.allows);
    }
    return map;
  }, [permissions.data]);

  const sections = useMemo(
    () => buildSections(permissions.data?.capabilities ?? [], t, i18n.language),
    [permissions.data, t, i18n.language],
  );

  const shown = useMemo(() => filterSections(sections, query), [sections, query]);
  const searching = query.trim() !== "";
  const [openedFor, setOpenedFor] = useState("");

  if (openedFor !== query && permissions.data) {
    setOpenedFor(query);
    setOpen(new Set(searching ? shown.map((section) => section.id) : []));
  }

  const allOpen = shown.length > 0 && shown.every((section) => open.has(section.id));

  const toggleSection = (id: string): void => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggle = async (
    role: UserRole,
    keys: readonly string[],
    allowed: boolean,
  ): Promise<void> => {
    try {
      for (const capability of keys) {
        await update.mutateAsync({ role, capability, allowed });
      }
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div data-testid="permissions-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="permissions-header"
        title="permissions.title"
        subtitle="permissions.subtitle"
      />

      <p data-testid="permissions-intro" className="max-w-(--form-max) text-value text-ink-muted">
        {t("permissions.intro")}
      </p>

      <p
        data-testid="permissions-admin-locked"
        className="flex items-start gap-2 rounded-panel border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-value text-primary-900"
      >
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        {t("permissions.adminLocked")}
      </p>

      <div data-testid="permissions-toolbar" className="flex flex-wrap items-center gap-3">
        <SearchField
          data-testid="permissions-search"
          className="min-w-0 flex-1 md:max-w-(--field-max)"
          label={t("permissions.search")}
          placeholder={t("permissions.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          clearLabel={t("common.clear")}
        />

        {shown.length > 0 && (
          <Button
            data-testid="permissions-expand-all"
            variant="secondary"
            icon={<Icon name={allOpen ? "chevron-up" : "chevron-down"} />}
            onClick={() =>
              setOpen(allOpen ? new Set() : new Set(shown.map((section) => section.id)))
            }
          >
            {t(allOpen ? "permissions.collapseAll" : "permissions.expandAll")}
          </Button>
        )}
      </div>

      {showSkeleton && <p className="text-value text-ink-muted">{ellipsis(t("common.loading"))}</p>}

      {permissions.isError && (
        <EmptyState icon="alert" data-testid="permissions-error" title="errors.unknown" />
      )}

      {!showSkeleton && permissions.data && shown.length === 0 && (
        <EmptyState icon="search" data-testid="permissions-empty" title="permissions.noMatch" />
      )}

      {!showSkeleton && permissions.data && (
        <div className="flex flex-col gap-3">
          {shown.map((section) => (
            <PermissionSectionCard
              key={section.id}
              section={section}
              allows={allows}
              expanded={open.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              onChange={(role, row, allowed) => void toggle(role, row.keys, allowed)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
