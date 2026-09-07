import type { PatientClinicalView } from '@clinic/shared';
import { LOOKUP_LIST, MOVEMENT_TYPE } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Modal, Select } from '@web/components/ui';
import { useLookupLabels } from '@web/features/lookups/queries';
import { MovementModal } from '@web/features/inventory/movement-modal';
import { useInventoryItems } from '@web/features/inventory/queries';

/**
 * صرف مواد, from the chair.
 *
 * Two steps rather than one long form: which item, then how much of it. The
 * item list is the only thing that needs searching, and the second step is the
 * ordinary consumption modal with the patient already filled in — so what a
 * doctor sees here is the same form the technician uses, minus the question it
 * can answer for them.
 *
 * The patient link is what puts the ampoule on their timeline, which is the
 * whole reason to record it here rather than at the end of the day.
 */
export function ConsumeForVisit({
  open,
  onClose,
  patient,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly patient: PatientClinicalView | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const [itemId, setItemId] = useState('');

  const items = useInventoryItems({ limit: 100 });

  useEffect(() => {
    if (open) {
      setItemId('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const chosen = items.data?.items.find((item) => item.id === itemId);

  if (chosen) {
    return (
      <MovementModal
        type={MOVEMENT_TYPE.CONSUME}
        item={chosen}
        onClose={onClose}
        {...(patient && {
          patient: {
            id: patient.id,
            fullName: patient.fullName,
            phone: patient.phone,
            fileNumber: patient.fileNumber,
          },
        })}
      />
    );
  }

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('inventory.movement.consumeFromVisit')}
      description={t('inventory.movement.consumeFromVisitDescription')}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      }
    >
      <FormField label="inventory.movement.item" htmlFor="consume-item" required>
        <Select
          id="consume-item"
          value={itemId}
          placeholder={t('inventory.movement.selectItem')}
          onChange={(event) => setItemId(event.target.value)}
          options={(items.data?.items ?? []).map((item) => ({
            value: item.id,
            label: `${item.nameAr} — ${item.quantity} ${unitLabel(item.unit)}`,
          }))}
        />
      </FormField>
    </Modal>
  );
}
