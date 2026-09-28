import type { LabOrderRow } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useSearchParams } from "react-router-dom";
import { OrderDrawer } from "@web/modules/labs/components/order-drawer";
import { OrderFormModal } from "@web/modules/labs/components/order-form-modal";
import { useLabOrder } from "@web/modules/labs/queries";

export function OrderDetails({ rows }: { readonly rows: readonly LabOrderRow[] }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<LabOrderRow | undefined>();
  const id = params.get("order") ?? "";
  const fetched = useLabOrder(id);
  const order = id === "" ? undefined : (fetched.data ?? rows.find((row) => row.id === id));

  const close = (): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.delete("order");

        return next;
      },
      { replace: true },
    );

  return (
    <>
      <OrderDrawer
        data-testid="lab-order-drawer"
        order={order}
        onClose={close}
        onEdit={(row) => {
          close();
          setEditing(row);
        }}
      />
      <OrderFormModal
        data-testid="lab-order-edit-modal"
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        order={editing}
      />
    </>
  );
}
