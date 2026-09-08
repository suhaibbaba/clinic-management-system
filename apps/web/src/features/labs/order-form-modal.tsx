import { USER_ROLE, type CreateLabOrderInput, type LabOrderRow } from '@clinic/shared';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { PatientPicker, type PickedPatient } from '@web/features/appointments/patient-picker';
import { useDoctors } from '@web/features/doctors/queries';
import {
  useCreateLabOrder,
  useLabWorkTypes,
  useLabs,
  useUpdateLabOrder,
} from '@web/features/labs/queries';
import { TeethField } from '@web/features/labs/teeth-field';
import { errorMessageKey } from '@web/lib/api-error';
import { useCurrency } from '@web/features/clinic/queries';

/** What the patient page hands in when the order starts from a tooth. */
export interface LabOrderDefaults {
  readonly patient?: PickedPatient | undefined;
  readonly teeth?: readonly number[] | undefined;
  readonly performedProcedureId?: string | undefined;
  readonly doctorId?: string | undefined;
}

export interface OrderFormModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Editing when present — only a draft may be edited, which the API enforces. */
  readonly order?: LabOrderRow | undefined;
  readonly defaults?: LabOrderDefaults | undefined;
}

/**
 * Placing work with a lab.
 *
 * Two things here are deliberate. The price is a **snapshot**: choosing a work
 * type copies that lab's current price into the order, and the lab's price list
 * moving later never rewrites what the clinic already owes. And a doctor never
 * sees the price field at all — ROLES.md gives them the order but not its
 * financial fields, and the API drops any price a doctor sends and substitutes
 * the list price, so a box they could type into would be a lie.
 */
export function OrderFormModal({
  open,
  onOpenChange,
  order,
  defaults,
}: OrderFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const doctorName = usePersonName();
  const toast = useToast();
  const { user } = useSession();

  const create = useCreateLabOrder();
  const update = useUpdateLabOrder();

  const labs = useLabs({ limit: 100 }, open);
  const doctors = useDoctors({ limit: 100 });

  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [labId, setLabId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [workTypeId, setWorkTypeId] = useState('');
  const [teeth, setTeeth] = useState<readonly number[]>([]);
  const [shade, setShade] = useState('');
  const [material, setMaterial] = useState('');
  const [instructions, setInstructions] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [price, setPrice] = useState('');

  const workTypes = useLabWorkTypes(labId);
  const mayPrice = user?.role === USER_ROLE.ADMIN;

  /** The doctor's own record, so their orders default to themselves. */
  const ownDoctorId = useMemo(
    () => doctors.data?.items.find((doctor) => doctor.userId === user?.id)?.id ?? '',
    [doctors.data, user?.id],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (order) {
      setPatient({
        id: order.patientId,
        fullName: order.patientName,
        phone: '',
        fileNumber: order.patientFileNumber,
      });
      setLabId(order.labId);
      setDoctorId(order.doctorId);
      setWorkTypeId(order.workTypeId ?? '');
      setTeeth(order.teeth);
      setShade(order.shade ?? '');
      setMaterial(order.material ?? '');
      setInstructions(order.instructions ?? '');
      setExpectedAt(order.expectedAt ? order.expectedAt.slice(0, 10) : '');
      setPrice(order.price);
      return;
    }

    setPatient(defaults?.patient ?? null);
    setLabId('');
    setDoctorId(defaults?.doctorId ?? ownDoctorId);
    setWorkTypeId('');
    setTeeth(defaults?.teeth ?? []);
    setShade('');
    setMaterial('');
    setInstructions('');
    setExpectedAt('');
    setPrice('');
  }, [open, order, defaults, ownDoctorId]);

  /**
   * Picking the work fills the price from the list — visibly, so whoever may
   * change it can see what they are changing away from.
   */
  const chooseWorkType = (id: string): void => {
    setWorkTypeId(id);

    const listed = workTypes.data?.find((type) => type.id === id);
    if (listed) {
      setPrice(listed.defaultPrice);
    }
  };

  const canSubmit = Boolean(labId) && Boolean(doctorId) && (Boolean(patient) || Boolean(order));

  const submit = async (): Promise<void> => {
    try {
      const body: CreateLabOrderInput = {
        labId,
        patientId: patient?.id ?? order?.patientId ?? '',
        doctorId,
        teeth: [...teeth],
        ...(workTypeId !== '' && { workTypeId }),
        ...(shade.trim() !== '' && { shade: shade.trim() }),
        ...(material.trim() !== '' && { material: material.trim() }),
        ...(instructions.trim() !== '' && { instructions: instructions.trim() }),
        ...(expectedAt !== '' && { expectedAt }),
        ...(defaults?.performedProcedureId && {
          performedProcedureId: defaults.performedProcedureId,
        }),
        // Only sent by a role allowed to set it; otherwise the list price stands.
        ...(mayPrice && price.trim() !== '' && { price: price.trim() }),
      };

      if (order) {
        const { patientId: _patientId, doctorId: _doctorId, ...editable } = body;
        await update.mutateAsync({ id: order.id, body: editable });
      } else {
        await create.mutateAsync(body);
      }

      toast.success(order ? 'labs.order.updated' : 'labs.order.created');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(order ? 'labs.order.editTitle' : 'labs.order.newTitle')}
      description={t('labs.order.description')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!canSubmit}
            isLoading={create.isPending || update.isPending}
            onClick={() => void submit()}
          >
            {t(order ? 'common.save' : 'labs.order.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Editing never moves an order to another patient: the API refuses it,
            and the file it belongs to is the one fact that must not drift. */}
        {order ? (
          <FormField label="labs.order.patient" htmlFor="lab-order-patient">
            <p id="lab-order-patient" className="text-value text-ink">
              {order.patientName}
            </p>
          </FormField>
        ) : (
          <FormField label="labs.order.patient" htmlFor="lab-order-patient" required>
            <PatientPicker id="lab-order-patient" value={patient} onChange={setPatient} />
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="labs.order.lab" htmlFor="lab-order-lab" required>
            <Select
              id="lab-order-lab"
              value={labId}
              placeholder={t('labs.order.selectLab')}
              onChange={(event) => {
                setLabId(event.target.value);
                setWorkTypeId('');
              }}
              options={(labs.data?.items ?? [])
                .filter((lab) => lab.isActive)
                .map((lab) => ({ value: lab.id, label: lab.name }))}
            />
          </FormField>

          <FormField
            label="labs.order.workType"
            htmlFor="lab-order-work-type"
            hint={t('labs.order.workTypeHint')}
          >
            <Select
              id="lab-order-work-type"
              value={workTypeId}
              disabled={labId === ''}
              placeholder={t('labs.order.selectWorkType')}
              onChange={(event) => chooseWorkType(event.target.value)}
              options={(workTypes.data ?? []).map((type) => ({
                value: type.id,
                label: type.nameAr,
              }))}
            />
          </FormField>

          <FormField label="labs.order.doctor" htmlFor="lab-order-doctor" required>
            <Select
              id="lab-order-doctor"
              value={doctorId}
              disabled={Boolean(order)}
              placeholder={t('labs.order.selectDoctor')}
              onChange={(event) => setDoctorId(event.target.value)}
              options={(doctors.data?.items ?? []).map((doctor) => ({
                value: doctor.id,
                label: doctorName(doctor.user.name),
              }))}
            />
          </FormField>

          <FormField label="labs.order.expected" htmlFor="lab-order-expected" optional>
            <DatePicker
              id="lab-order-expected"
              label={t('labs.order.expected')}
              value={expectedAt}
              onChange={setExpectedAt}
            />
          </FormField>
        </div>

        <FormField label="labs.order.teeth" htmlFor="lab-order-teeth" optional>
          <TeethField id="lab-order-teeth" value={teeth} onChange={setTeeth} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="labs.order.shade" htmlFor="lab-order-shade" optional>
            <Input
              id="lab-order-shade"
              placeholder="A2"
              value={shade}
              onChange={(event) => setShade(event.target.value)}
            />
          </FormField>

          <FormField label="labs.order.material" htmlFor="lab-order-material" optional>
            <Input
              id="lab-order-material"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            />
          </FormField>
        </div>

        {/* ROLES.md: a doctor raises the order, an admin owns the money on it. */}
        {mayPrice && (
          <FormField
            label="labs.order.price"
            htmlFor="lab-order-price"
            hint={t('labs.prices.snapshotNote')}
          >
            <MoneyInput
              id="lab-order-price"
              currency={currency}
              placeholder="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </FormField>
        )}

        <FormField label="labs.order.instructions" htmlFor="lab-order-instructions" optional>
          <Textarea
            id="lab-order-instructions"
            rows={3}
            placeholder={t('labs.order.instructionsPlaceholder')}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
