import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Icon,
  MenuItem,
  PhoneLink,
  RowMenu,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import {
  canDeleteSupplier,
  canInvoiceReceipts,
  canManageSuppliers,
  canPaySupplier,
  canPostPurchase,
  canRecordCreditNote,
  canReturnToSupplier,
  canSeeCosts,
} from "@web/shared/permissions/inventory";
import { useDeleteSupplier, useSupplier } from "@web/modules/inventory/queries";
import { SupplierAccount } from "@web/modules/inventory/components/supplier-account";
import { UninvoicedLines } from "@web/modules/inventory/components/uninvoiced-lines";
import { SupplierReturnModal } from "@web/modules/inventory/components/supplier-return-modal";
import { CreditNoteModal } from "@web/modules/inventory/components/credit-note-modal";
import { SupplierFormModal } from "@web/modules/inventory/components/supplier-form-modal";
import { SupplierPaymentModal } from "@web/modules/inventory/components/supplier-payment-modal";
import { SUPPLIERS_TAB_PATH } from "@web/modules/inventory/constants";
import { errorToast } from "@web/shared/lib/api-error";

export function SupplierPage(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useSession();
  const currency = useCurrency();
  const toast = useToast();
  const supplier = useSupplier(id);
  const remove = useDeleteSupplier();
  const { confirm, dialog } = useConfirm("supplier-confirm-delete");

  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [returning, setReturning] = useState(false);
  const [crediting, setCrediting] = useState(false);

  const row = supplier.data;
  const seesCosts = canSeeCosts(can);
  const mayPay = seesCosts && canPaySupplier(can);
  const mayEdit = canManageSuppliers(can);
  const mayDelete = canDeleteSupplier(can);
  const mayReturn = canReturnToSupplier(can);
  const mayCredit = seesCosts && canRecordCreditNote(can);

  const askDelete = (): void => {
    if (!row) {
      return;
    }

    confirm({
      title: "inventory.suppliers.confirmDelete.title",
      titleValues: { name: row.name },
      consequences: [
        t("inventory.suppliers.confirmDelete.history"),
        t("inventory.suppliers.confirmDelete.items"),
      ],
      onConfirm: async () => {
        try {
          await remove.mutateAsync(row.id);
          toast.success("inventory.suppliers.deleted");
          void navigate(SUPPLIERS_TAB_PATH, { replace: true });
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });
  };

  return (
    <div data-testid="supplier-page" className="flex flex-col gap-5">
      <header data-testid="supplier-header" className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1
            data-testid="supplier-name"
            className="truncate text-title font-medium text-primary-900"
          >
            {row ? <bdi>{row.name}</bdi> : <Skeleton className="h-7 w-56 max-w-full" />}
          </h1>
          {row && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-value text-ink-muted">
              {row.contactPerson && <bdi>{row.contactPerson}</bdi>}
              {row.phone && <PhoneLink value={row.phone} />}
              {!row.isActive && (
                <Badge tone="neutral" data-testid="supplier-inactive">
                  {t("inventory.suppliers.inactive")}
                </Badge>
              )}
            </p>
          )}
        </div>

        {row && (
          <div className="flex shrink-0 items-center gap-2">
            {canPostPurchase(can) && (
              <Button
                variant="secondary"
                icon={<Icon name="package" />}
                data-testid="supplier-new-purchase"
                onClick={() => void navigate(`/inventory/purchases/new?supplier=${row.id}`)}
              >
                {t("inventory.purchase.action")}
              </Button>
            )}
            {mayPay && (
              <Button
                icon={<Icon name="money" />}
                data-testid="supplier-pay"
                onClick={() => setPaying(true)}
              >
                {t("inventory.suppliers.pay")}
              </Button>
            )}
            {(mayEdit || mayDelete || mayReturn || mayCredit) && (
              <RowMenu
                size="target"
                label={t("inventory.suppliers.menu")}
                data-testid="supplier-actions"
              >
                {mayReturn && (
                  <MenuItem
                    icon="reset"
                    data-testid="supplier-return"
                    onSelect={() => setReturning(true)}
                  >
                    {t("inventory.supplierReturn.action")}
                  </MenuItem>
                )}
                {mayCredit && (
                  <MenuItem
                    icon="receipt"
                    data-testid="supplier-credit-note"
                    onSelect={() => setCrediting(true)}
                  >
                    {t("inventory.creditNote.action")}
                  </MenuItem>
                )}
                {mayEdit && (
                  <MenuItem
                    icon="edit"
                    data-testid="supplier-edit"
                    onSelect={() => setEditing(true)}
                  >
                    {t("common.edit")}
                  </MenuItem>
                )}
                {mayDelete && (
                  <MenuItem
                    icon="trash"
                    tone="danger"
                    data-testid="supplier-delete"
                    onSelect={askDelete}
                  >
                    {t("common.delete")}
                  </MenuItem>
                )}
              </RowMenu>
            )}
          </div>
        )}
      </header>

      {dialog}

      {seesCosts && canInvoiceReceipts(can) && <UninvoicedLines supplierId={id} />}
      {seesCosts && <SupplierAccount supplier={{ id }} />}

      <SupplierFormModal
        data-testid="supplier-edit-modal"
        open={editing}
        onOpenChange={setEditing}
        supplier={row}
      />

      <SupplierReturnModal
        supplierId={id}
        open={returning}
        mayCredit={mayCredit}
        onClose={() => setReturning(false)}
      />
      <CreditNoteModal supplierId={id} open={crediting} onClose={() => setCrediting(false)} />

      <SupplierPaymentModal
        supplier={paying && row ? row : null}
        currency={currency}
        onClose={() => setPaying(false)}
      />
    </div>
  );
}
