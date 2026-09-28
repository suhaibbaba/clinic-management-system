import { type UserRole } from "@clinic/shared";
import { useMemo, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  EmptyState,
  Icon,
  PageHeader,
  SegmentedControl,
  Switch,
  useTabParam,
  useToast,
} from "@clinic/ui";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";
import { usePermissions, useUpdateRolePermission } from "@web/modules/permissions/queries";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { ellipsis } from "@web/i18n/ellipsis";
import {
  EDITABLE_ROLES,
  FOLDED_CAPABILITIES,
  PAIRED_CAPABILITIES,
  ROLE_TABS,
} from "@web/modules/permissions/constants";

interface Permission {
  readonly keys: readonly string[];
  readonly label: string;
}

interface Section {
  readonly title: string;
  hint: string;
  readonly permissions: Permission[];
}

export function PermissionsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const permissions = usePermissions();
  const update = useUpdateRolePermission();
  const { showSkeleton } = useQueryLoading(permissions);

  const [role, setRole] = useTabParam<UserRole>("role", ROLE_TABS, EDITABLE_ROLES[0]);

  const current = permissions.data?.roles.find((entry) => entry.role === role);
  const locked = current?.locked ?? false;

  const sections = useMemo<Section[]>(() => {
    const byTitle = new Map<string, Section>();

    for (const capability of permissions.data?.capabilities ?? []) {
      if (FOLDED_CAPABILITIES.has(capability.key)) {
        continue;
      }

      const title = t(`permissions.resources.${capability.resource}`, {
        defaultValue: capability.resource,
      });
      const section = byTitle.get(title) ?? { title, hint: "", permissions: [] };
      const paired = PAIRED_CAPABILITIES[capability.key];

      section.hint ||= t(`permissions.hints.${capability.resource}`, { defaultValue: "" });
      section.permissions.push({
        keys: paired ? [capability.key, paired] : [capability.key],
        label: t(`permissions.capabilities.${capability.key}`, { defaultValue: capability.key }),
      });
      byTitle.set(title, section);
    }

    for (const section of byTitle.values()) {
      section.permissions.sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    }

    return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title, i18n.language));
  }, [permissions.data, t, i18n.language]);

  const toggle = async (keys: readonly string[], allowed: boolean): Promise<void> => {
    try {
      for (const capability of keys) {
        await update.mutateAsync({ role, capability, allowed });
      }
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div data-testid="permissions-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="permissions-header"
        title="permissions.title"
        subtitle="permissions.subtitle"
      />

      <p data-testid="permissions-intro" className="text-value text-ink-muted">
        {t("permissions.intro")}
      </p>

      <SegmentedControl
        data-testid="permissions-role"
        label={t("permissions.role")}
        value={role}
        onChange={setRole}
        options={ROLE_TABS.map((value) => ({ value, label: t(`roles.${value}`) }))}
      />

      {locked && (
        <p
          data-testid="permissions-admin-locked"
          className="flex items-center gap-2 rounded-panel border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-value text-primary-900"
        >
          <Icon name="lock" className="size-4 shrink-0" />
          {t("permissions.adminLocked")}
        </p>
      )}

      {showSkeleton && <p className="text-value text-ink-muted">{ellipsis(t("common.loading"))}</p>}

      {permissions.isError && (
        <EmptyState icon="alert" data-testid="permissions-error" title="errors.unknown" />
      )}

      {!showSkeleton &&
        current &&
        sections.map((section) => (
          <Card key={section.title} data-testid={`permissions-section-${section.title}`}>
            <h2 className="text-heading font-medium text-ink">{section.title}</h2>
            {section.hint && <p className="mt-0.5 text-meta text-ink-muted">{section.hint}</p>}

            <ul className="mt-3 grid gap-x-8 lg:grid-cols-2">
              {section.permissions.map((permission) => (
                <li
                  key={permission.keys[0]}
                  data-testid={`permission-${permission.keys[0] ?? ""}`}
                  className="flex items-center justify-between gap-4 border-t border-line py-2"
                >
                  <span className="min-w-0 truncate text-value text-ink">{permission.label}</span>

                  <Switch
                    data-testid={`permission-switch-${permission.keys[0] ?? ""}`}
                    checked={permission.keys.every((key) => current.allows[key])}
                    disabled={locked}
                    onCheckedChange={(next) => void toggle(permission.keys, next)}
                    label={permission.label}
                    hideLabel
                  />
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}
