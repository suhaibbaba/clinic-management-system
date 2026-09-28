import type { StockMovementRow } from "@clinic/shared";
import { useTranslation } from "react-i18next";
import { Badge, type Column, Ltr, MenuItem, PersonName, RowMenu } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { MovementDetails } from "@web/modules/inventory/components/movement-details";
import { visitMoment } from "@web/shared/lib/format";
import { MOVEMENT_TONES, movementLabel } from "@web/modules/inventory/lib/display";
import { canReverseMovement } from "@web/modules/inventory/permissions";
import { useSession } from "@web/shared/providers/session";
import { useClinic } from "@web/modules/clinic/queries";

export function useMovementColumns(
  onReverse: (row: StockMovementRow) => void,
): readonly Column<StockMovementRow>[] {
  const { t } = useTranslation();
  const { can } = useSession();
  const clinic = useClinic();
  const mayReverse = canReverseMovement(can);

  return [
    {
      key: "date",
      header: "inventory.history.columns.date",
      primary: true,
      render: (row) => <Ltr className="whitespace-nowrap">{visitMoment(row.createdAt)}</Ltr>,
    },
    {
      key: "type",
      header: "inventory.history.columns.type",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={MOVEMENT_TONES[row.type]} data-testid="item-movement-type">
            {t(movementLabel(row.type))}
          </Badge>
          {row.reversesId && (
            <Badge tone="neutral" data-testid="item-movement-reversal">
              {t("inventory.history.reversal")}
            </Badge>
          )}
          {row.reversedAt && (
            <Badge tone="neutral" data-testid="item-movement-reversed">
              {t("inventory.history.reversed")}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "inventory.history.columns.quantity",
      align: "numeric",
      render: (row) => {
        const out = row.quantity.startsWith("-");

        return (
          <Ltr
            data-testid="item-movement-quantity"
            className={cn("font-semibold", out ? "text-danger-600" : "text-success-700")}
          >
            {out ? `−${row.quantity.slice(1)}` : `+${row.quantity}`}
          </Ltr>
        );
      },
    },
    {
      key: "after",
      header: "inventory.history.after",
      align: "numeric",
      render: (row) => <Ltr data-testid="item-movement-after">{row.runningQuantity}</Ltr>,
    },
    {
      key: "details",
      header: "inventory.history.columns.details",
      render: (row) => <MovementDetails row={row} currency={clinic.data?.currency} />,
    },
    {
      key: "by",
      header: "inventory.history.columns.by",
      hideOnMobile: true,
      render: (row) => (row.createdByName ? <PersonName name={row.createdByName} /> : "—"),
    },
    ...(mayReverse
      ? [
          {
            key: "actions",
            header: "inventory.history.menu",
            actions: true,
            besideTitleOnMobile: true,
            render: (row: StockMovementRow) =>
              row.reversedAt === null && row.reversesId === null ? (
                <RowMenu
                  label={t("inventory.history.menu")}
                  data-testid={`item-movement-${row.id}-menu`}
                >
                  <MenuItem
                    icon="reset"
                    data-testid="item-movement-reverse"
                    onSelect={() => onReverse(row)}
                  >
                    {t("inventory.history.reverse")}
                  </MenuItem>
                </RowMenu>
              ) : null,
          } satisfies Column<StockMovementRow>,
        ]
      : []),
  ];
}
