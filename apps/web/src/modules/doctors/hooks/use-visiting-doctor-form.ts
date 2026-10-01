import {
  createVisitingDoctorSchema,
  type CreateVisitingDoctorInput,
  type Doctor,
} from "@clinic/shared";
import { useEffect, type FormEvent } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useToast } from "@clinic/ui";
import { useCreateVisitingDoctor } from "@web/modules/doctors/queries";
import { EMPTY_VISITING_DOCTOR } from "@web/modules/doctors/constants";
import { errorToast } from "@web/shared/lib/api-error";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { payloadResolver } from "@web/shared/lib/payload-resolver";

export interface VisitingDoctorForm {
  readonly form: UseFormReturn<CreateVisitingDoctorInput>;
  readonly submit: (event?: FormEvent) => Promise<void>;
}

export function useVisitingDoctorForm(
  open: boolean,
  onCreated: (doctor: Doctor) => void,
): VisitingDoctorForm {
  const toast = useToast();
  const create = useCreateVisitingDoctor();

  const form = useForm<CreateVisitingDoctorInput>({
    mode: "onTouched",
    resolver: payloadResolver(
      createVisitingDoctorSchema,
      (values: CreateVisitingDoctorInput) => values,
    ),
    defaultValues: EMPTY_VISITING_DOCTOR,
  });
  const { reset, handleSubmit } = form;

  useEffect(() => {
    if (open) {
      reset(EMPTY_VISITING_DOCTOR);
    }
  }, [open, reset]);

  const submit = handleSubmit(
    async (values) => {
      try {
        const doctor = await create.mutateAsync(values);
        toast.success("doctors.visiting.created");
        onCreated(doctor);
      } catch (error) {
        toast.error(...errorToast(error));
      }
    },
    () => revealFirstError(),
  );

  return { form, submit };
}
