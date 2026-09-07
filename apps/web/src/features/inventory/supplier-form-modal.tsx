import type { SupplierSummary } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Modal, Switch, Textarea, useToast } from '@web/components/ui';
import { useCreateSupplier, useUpdateSupplier } from '@web/features/inventory/queries';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * A supplier.
 *
 * Retiring one is a switch rather than a delete: purchases point at them, and
 * a statement whose counterparty has vanished is unreadable. The switch keeps
 * them out of the pickers and leaves every line intact.
 */
export function SupplierFormModal({
  open,
  onOpenChange,
  supplier,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly supplier?: SupplierSummary | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const create = useCreateSupplier();
  const update = useUpdateSupplier();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(supplier?.name ?? '');
    setPhone(supplier?.phone ?? '');
    setContactPerson(supplier?.contactPerson ?? '');
    setNotes(supplier?.notes ?? '');
    setIsActive(supplier?.isActive ?? true);
  }, [open, supplier]);

  const submit = async (): Promise<void> => {
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
        contactPerson: contactPerson.trim() === '' ? null : contactPerson.trim(),
        notes: notes.trim() === '' ? null : notes.trim(),
        isActive,
      };

      if (supplier) {
        await update.mutateAsync({ id: supplier.id, body });
      } else {
        await create.mutateAsync(body);
      }

      toast.success(supplier ? 'inventory.suppliers.updated' : 'inventory.suppliers.created');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(supplier ? 'inventory.suppliers.editTitle' : 'inventory.suppliers.newTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={name.trim().length < 2}
            isLoading={create.isPending || update.isPending}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="inventory.suppliers.name" htmlFor="supplier-name" required>
          <Input
            id="supplier-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="inventory.suppliers.phone" htmlFor="supplier-phone" optional>
            <Input
              id="supplier-phone"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </FormField>

          <FormField label="inventory.suppliers.contact" htmlFor="supplier-contact" optional>
            <Input
              id="supplier-contact"
              value={contactPerson}
              onChange={(event) => setContactPerson(event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="inventory.notes" htmlFor="supplier-notes" optional>
          <Textarea
            id="supplier-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>

        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={t('inventory.suppliers.active')}
        />
      </div>
    </Modal>
  );
}
