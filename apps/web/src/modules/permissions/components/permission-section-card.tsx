import { type UserRole } from "@clinic/shared";
import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Icon, Switch } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { EDITABLE_ROLES } from "@web/modules/permissions/constants";
import {
  type PermissionRow,
  type PermissionSection,
} from "@web/modules/permissions/lib/permission-sections";

type Allows = Readonly<Record<string, boolean>>;

interface PermissionSectionCardProps {
  readonly section: PermissionSection;
  readonly allows: ReadonlyMap<UserRole, Allows>;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onChange: (role: UserRole, row: PermissionRow, allowed: boolean) => void;
}

export function PermissionSectionCard({
  section,
  allows,
  expanded,
  onToggle,
  onChange,
}: PermissionSectionCardProps): JSX.Element {
  const { t } = useTranslation();
  const testId = `permissions-section-${section.id}`;
  const bodyId = `${testId}-body`;
  const total = section.permissions.length;

  const granted = (role: UserRole, row: PermissionRow): boolean =>
    row.keys.every((key) => allows.get(role)?.[key] === true);

  return (
    <Card flush data-testid={testId} className="overflow-hidden">
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 px-5 py-4 text-start",
          "transition-colors hover:bg-inset",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600",
        )}
      >
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          className="mt-0.5 size-5 shrink-0 text-ink-muted"
        />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-heading font-medium text-ink">{section.title}</span>
          </span>
          {section.hint && (
            <span className="mt-0.5 block text-meta text-ink-muted">{section.hint}</span>
          )}
        </span>

        <span
          data-testid={`${testId}-summary`}
          className="hidden shrink-0 flex-wrap justify-end gap-1.5 md:flex"
        >
          {EDITABLE_ROLES.map((role) => {
            const count = section.permissions.filter((row) => granted(role, row)).length;

            return (
              <Badge
                key={role}
                data-testid={`${testId}-summary-${role}`}
                tone={count === total ? "success" : count === 0 ? "neutral" : "info"}
              >
                {`${t(`roles.${role}`)} `}
                <span className="tabular-nums">
                  {count}/{total}
                </span>
              </Badge>
            );
          })}
        </span>
      </button>

      {expanded && (
        <div id={bodyId} data-testid={bodyId} className="overflow-x-auto border-t border-line">
          <table className="w-full border-collapse text-value">
            <thead>
              <tr className="bg-table-head">
                <th
                  scope="col"
                  className="sticky start-0 z-10 bg-table-head px-5 py-2.5 text-start text-micro font-medium text-ink-muted"
                >
                  {t("permissions.permission")}
                </th>
                {EDITABLE_ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="w-28 whitespace-nowrap px-3 py-2.5 text-center text-micro font-medium text-ink-muted"
                  >
                    {t(`roles.${role}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.permissions.map((row) => (
                <tr
                  key={row.keys[0]}
                  data-testid={`permission-${row.keys[0] ?? ""}`}
                  className="group border-t border-line"
                >
                  <th
                    scope="row"
                    className="sticky start-0 z-10 min-w-38 bg-surface px-5 py-2 text-start font-normal text-ink group-hover:bg-inset"
                  >
                    {row.label}
                  </th>
                  {EDITABLE_ROLES.map((role) => (
                    <td key={role} className="px-3 py-2 text-center group-hover:bg-inset">
                      <span className="inline-flex align-middle">
                        <Switch
                          data-testid={`permission-switch-${row.keys[0] ?? ""}-${role}`}
                          checked={granted(role, row)}
                          onCheckedChange={(next) => onChange(role, row, next)}
                          label={t("permissions.cell", {
                            permission: row.label,
                            role: t(`roles.${role}`),
                          })}
                          hideLabel
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
