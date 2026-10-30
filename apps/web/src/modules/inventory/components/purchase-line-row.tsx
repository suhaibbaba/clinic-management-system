import { useId, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  DatePicker,
  Icon,
  InfoTip,
  Input,
  Money,
  MoneyInput,
  QuantityInput,
  Select,
  Switch,
} from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { DiscountInput } from "@web/modules/inventory/components/discount-input";
import { PackSizeSelect } from "@web/modules/inventory/components/pack-size-select";
import {
  PURCHASE_LINE_GRID,
  PURCHASE_UNIT_COLUMN,
  type PurchaseLineLayout,
} from "@web/modules/inventory/constants";
import {
  expectedPrice,
  lineCost,
  type PurchaseLineDraft,
} from "@web/modules/inventory/lib/purchase-form";
import { useItemPrices } from "@web/modules/inventory/queries";

function Cell({
  label,
  htmlFor,
  className,
  persistentLabel = false,
  hint,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly className?: string | undefined;
  readonly persistentLabel?: boolean | undefined;
  readonly hint?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className={cn("flex items-center gap-1", !persistentLabel && "@min-[40rem]:sr-only")}>
        <label htmlFor={htmlFor} className="text-label font-medium text-ink">
          {label}
        </label>
        {hint !== undefined && (
          <InfoTip
            label={t("common.moreInfo")}
            className={cn(!persistentLabel && "@min-[40rem]:hidden")}
          >
            {hint}
          </InfoTip>
        )}
      </span>
      {children}
    </div>
  );
}

export function PurchaseLineRow({
  line,
  layout,
  itemOptions,
  baseUnit,
  minExpiry,
  currency,
  cost,
  removable,
  ordering = false,
  supplierId = "",
  mayPrice = false,
  onChange,
  onRemove,
  onCreateItem,
}: {
  readonly line: PurchaseLineDraft;
  readonly layout: PurchaseLineLayout;
  readonly itemOptions: readonly { readonly value: string; readonly label: string }[];
  readonly baseUnit: string;
  readonly minExpiry: string;
  readonly currency: string | undefined;
  readonly cost: string | undefined;
  readonly removable: boolean;
  readonly ordering?: boolean | undefined;
  readonly supplierId?: string | undefined;
  readonly mayPrice?: boolean | undefined;
  readonly onChange: (patch: Partial<PurchaseLineDraft>) => void;
  readonly onRemove: () => void;
  readonly onCreateItem: ((name: string) => void) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const detailsId = useId();
  const [open, setOpen] = useState(line.batchNo !== "" || line.expiryDate !== "" || line.gift);
  const id = (field: string): string => `line-${field}-${line.key}`;
  const priced = layout === "invoice" || layout === "priced";
  const prices = useItemPrices(line.itemId, ordering && priced && mayPrice);
  const expected = ordering ? expectedPrice(prices.data ?? [], supplierId) : null;
  const shownCost = ordering ? (lineCost(line.quantity, expected) ?? undefined) : cost;
  const laterHint = ordering ? t("inventory.purchase.orderFieldHint") : undefined;

  return (
    <li data-testid="purchase-line" data-line={line.key} className="py-3">
      <div
        className={cn(
          "grid grid-cols-2 gap-3 @min-[40rem]:gap-2 @min-[56rem]:gap-3",
          PURCHASE_LINE_GRID[layout],
        )}
      >
        <div
          className={cn(
            "col-span-2 flex min-w-0 flex-col gap-3 @min-[40rem]:col-span-1 @min-[40rem]:gap-1.5",
            PURCHASE_UNIT_COLUMN[layout].cell,
          )}
        >
          <Cell label={t("inventory.movement.item")} htmlFor={id("item")}>
            <Select
              searchable
              id={id("item")}
              data-testid="purchase-line-item"
              value={line.itemId}
              placeholder={t("inventory.movement.selectItem")}
              onChange={(event) => onChange({ itemId: event.target.value, packSizeId: "" })}
              onCreate={onCreateItem}
              options={itemOptions}
            />
          </Cell>
          <Cell label={t("inventory.purchase.unitShort")} htmlFor={id("pack")}>
            <PackSizeSelect
              id={id("pack")}
              itemId={line.itemId}
              baseUnit={baseUnit}
              fixed={ordering}
              value={line.packSizeId ?? ""}
              onChange={(packSizeId) => onChange({ packSizeId })}
            />
          </Cell>
        </div>

        <Cell label={t("inventory.movement.quantity")} htmlFor={id("qty")}>
          <QuantityInput
            id={id("qty")}
            data-testid="purchase-line-quantity"
            placeholder="0"
            value={line.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
          />
        </Cell>

        <Cell
          label={t("inventory.purchase.free")}
          htmlFor={id("free")}
          hint={laterHint ?? t("inventory.purchase.freeHint")}
        >
          <QuantityInput
            id={id("free")}
            data-testid="purchase-line-free"
            placeholder="0"
            disabled={ordering}
            value={ordering ? "" : line.freeQuantity}
            onChange={(event) => onChange({ freeQuantity: event.target.value })}
          />
        </Cell>

        {priced && (
          <Cell
            label={t("inventory.movement.unitPrice")}
            htmlFor={id("price")}
            hint={ordering ? t("inventory.purchase.orderPriceHint") : undefined}
          >
            {line.gift && !ordering ? (
              <span className="flex h-(--control-h) items-center">
                <Badge tone="info" data-testid="purchase-line-gift-badge">
                  {t("inventory.purchase.giftShort")}
                </Badge>
              </span>
            ) : (
              <MoneyInput
                cents
                id={id("price")}
                data-testid="purchase-line-price"
                currency={currency}
                placeholder={ordering ? "—" : "0"}
                disabled={ordering}
                value={ordering ? (expected ?? "") : line.unitPrice}
                onChange={(event) => onChange({ unitPrice: event.target.value })}
              />
            )}
          </Cell>
        )}

        {priced && (
          <Cell
            label={t("inventory.purchase.lineDiscount")}
            htmlFor={id("discount")}
            hint={
              laterHint ??
              (layout === "priced" ? t("inventory.purchase.discountNeedsInvoice") : undefined)
            }
          >
            {!line.gift && (
              <DiscountInput
                id={id("discount")}
                data-testid="purchase-line-discount"
                disabled={layout === "priced"}
                kind={line.discountKind}
                value={layout === "priced" ? "" : line.discountValue}
                currency={currency}
                onKindChange={(discountKind) => onChange({ discountKind })}
                onValueChange={(discountValue) => onChange({ discountValue })}
              />
            )}
          </Cell>
        )}

        {priced && (
          <div
            data-testid="purchase-line-cost"
            className={cn(
              "col-span-2 flex h-(--control-h) items-center justify-between gap-2 font-semibold",
              "@min-[26rem]:col-span-1 @min-[40rem]:justify-end",
            )}
          >
            <span className="text-label font-medium text-ink-muted @min-[40rem]:sr-only">
              {t("inventory.purchase.lineTotal")}
            </span>
            {shownCost === undefined ||
            (!ordering && (line.gift || line.unitPrice.trim() === "")) ? (
              <span className="text-ink-subtle">—</span>
            ) : (
              <Money cents amount={shownCost} currency={currency} />
            )}
          </div>
        )}

        <div
          className={cn(
            "col-span-2 flex items-center justify-between gap-1 @min-[26rem]:justify-end @min-[40rem]:col-span-1",
            priced && "@min-[26rem]:col-span-1",
          )}
        >
          <Button
            size="sm"
            variant="secondary"
            aria-hidden={ordering || undefined}
            className={cn(
              ordering && "invisible",
              "@min-[40rem]:border-transparent @min-[40rem]:bg-transparent @min-[40rem]:text-ink-muted",
              "@min-[40rem]:hover:border-transparent @min-[40rem]:hover:bg-inset @min-[40rem]:hover:text-ink",
            )}
            data-testid="purchase-line-details"
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={t("inventory.purchase.lineDetails")}
            icon={<Icon name={open ? "chevron-up" : "chevron-down"} />}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="@min-[40rem]:sr-only">{t("inventory.purchase.lineDetails")}</span>
          </Button>
          <Button
            size="sm"
            variant="quiet"
            data-testid="purchase-line-remove"
            aria-label={t("inventory.purchase.removeLine")}
            aria-hidden={!removable || undefined}
            icon={<Icon name="trash" />}
            className={cn(
              "text-danger-600 hover:bg-danger-50 hover:text-danger-700 active:bg-danger-100",
              !removable && "invisible",
            )}
            onClick={onRemove}
          />
        </div>
      </div>

      {open && !ordering && (
        <div
          id={detailsId}
          data-testid="purchase-line-extra"
          className="mt-3 grid items-end gap-3 border-t border-line pt-3 @min-[26rem]:grid-cols-2 @min-[40rem]:grid-cols-3"
        >
          <Cell label={t("inventory.movement.batchNo")} htmlFor={id("batch")} persistentLabel>
            <Input
              id={id("batch")}
              data-testid="purchase-line-batch"
              dir="ltr"
              placeholder={t("inventory.purchase.batchPlaceholder")}
              value={line.batchNo}
              onChange={(event) => onChange({ batchNo: event.target.value })}
            />
          </Cell>
          <Cell label={t("inventory.movement.expiry")} htmlFor={id("expiry")} persistentLabel>
            <DatePicker
              id={id("expiry")}
              data-testid="purchase-line-expiry"
              label={t("inventory.movement.expiry")}
              value={line.expiryDate}
              min={minExpiry}
              onChange={(expiryDate) => onChange({ expiryDate })}
            />
          </Cell>
          {layout === "invoice" && (
            <div className="flex min-h-(--control-h) items-center @min-[26rem]:col-span-2 @min-[40rem]:col-span-1">
              <Switch
                checked={line.gift}
                onCheckedChange={(gift) => onChange({ gift })}
                label={t("inventory.purchase.gift")}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
