import { LOOKUP_LIST, type PurchaseRequest } from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Drawer, Ltr, Money, PersonName, PhoneLink } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { formatDate, formatDateTime } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { REQUEST_STATUS_TONES } from "@web/modules/inventory/constants";

function Field({
  label,
  wide = false,
  children,
}: {
  readonly label: string;
  readonly wide?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-ink">{children}</dd>
    </div>
  );
}

export function RequestDrawer({
  request,
  footer,
  onClose,
}: {
  readonly request: PurchaseRequest | undefined;
  readonly footer: ReactNode;
  readonly onClose: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);

  if (!request) {
    return null;
  }

  const priced = request.lines.some((line) => line.lastPrice != null);

  return (
    <Drawer
      data-testid="request-drawer"
      open
      onOpenChange={(next) => !next && onClose()}
      descriptionKey="inventory.requests.detailsDescription"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Ltr>{request.number}</Ltr>
          <Badge tone={REQUEST_STATUS_TONES[request.status]} data-testid="request-drawer-status">
            {t(`inventory.requests.status.${request.status}`)}
          </Badge>
        </span>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <dl
          data-testid="request-drawer-details"
          className="grid grid-cols-2 gap-x-4 gap-y-3 text-value"
        >
          <Field label={t("inventory.movement.supplier")}>
            <span className="flex flex-col items-start gap-0.5">
              <bdi>{request.supplierName ?? t("inventory.purchase.noSupplier")}</bdi>
              {request.supplierPhone && <PhoneLink value={request.supplierPhone} />}
            </span>
          </Field>
          <Field label={t("inventory.requests.createdBy")}>
            {request.createdByName ? <PersonName name={request.createdByName} /> : "—"}
            <span className="block text-meta text-ink-muted">
              <Ltr>{formatDateTime(request.createdAt)}</Ltr>
            </span>
          </Field>
          {request.neededBy && (
            <Field label={t("inventory.requests.neededBy")}>
              <Ltr>{formatDate(request.neededBy)}</Ltr>
            </Field>
          )}
          {request.sentAt && (
            <Field label={t("inventory.requests.sentAt")}>
              <Ltr>{formatDateTime(request.sentAt)}</Ltr>
              {request.sentTo && <PhoneLink value={request.sentTo} />}
            </Field>
          )}
          {request.note && (
            <Field wide label={t("inventory.requests.note")}>
              {request.note}
            </Field>
          )}
          {request.cancelReason && (
            <Field wide label={t("inventory.requests.cancelReason")}>
              {request.cancelReason}
            </Field>
          )}
        </dl>

        <table data-testid="request-drawer-lines" className="w-full text-value">
          <thead>
            <tr className="border-b border-line text-meta text-ink-muted">
              <th className="py-2 text-start font-normal">
                {t("inventory.requests.columns.items")}
              </th>
              <th className="py-2 text-end font-normal">{t("inventory.requests.ordered")}</th>
              <th className="py-2 text-end font-normal">{t("inventory.requests.received")}</th>
              <th className="py-2 text-end font-normal">{t("inventory.requests.remaining")}</th>
              {priced && (
                <th className="py-2 text-end font-normal">
                  {t("inventory.shoppingList.lastPrice")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {request.lines.map((line) => (
              <tr key={line.id} data-testid="request-drawer-line" data-id={line.id}>
                <td className="py-2 pe-3">
                  <bdi className="font-medium text-ink">{line.itemName}</bdi>
                  <span className="block text-meta text-ink-muted">{unitLabel(line.unit)}</span>
                  {line.note && <span className="block text-meta text-ink-muted">{line.note}</span>}
                </td>
                <td className="py-2 text-end tabular-nums">
                  <Ltr>{String(Number(line.quantity))}</Ltr>
                </td>
                <td className="py-2 text-end tabular-nums">
                  <Ltr>{String(Number(line.received))}</Ltr>
                </td>
                <td
                  className={cn(
                    "py-2 text-end tabular-nums",
                    Number(line.open) > 0 ? "font-medium text-warning-700" : "text-ink-muted",
                  )}
                >
                  <Ltr>{String(Number(line.open))}</Ltr>
                </td>
                {priced && (
                  <td className="py-2 text-end">
                    {line.lastPrice ? (
                      <Money cents amount={line.lastPrice} currency={currency} />
                    ) : (
                      "—"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Drawer>
  );
}
