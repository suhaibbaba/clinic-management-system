import {
  COUNTRY_PRESETS,
  SPECIALTY_CODE,
  missingModules,
  type CreateClinicInput,
  type SpecialtyCode,
} from "@clinic/shared";
import { Button } from "@clinic/ui/components/button";
import { Checkbox } from "@clinic/ui/components/checkbox";
import { Drawer } from "@clinic/ui/components/drawer";
import { FormField } from "@clinic/ui/components/form-field";
import { Input } from "@clinic/ui/components/input";
import { PasswordInput } from "@clinic/ui/components/password-input";
import { Select } from "@clinic/ui/components/select";
import { type JSX } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type FieldError } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { VENDOR_TRIAL_DAYS } from "@web/vendor/constants";
import { slugFrom } from "@web/vendor/lib/clinic-actions";
import { clinicAddresses, parseDomain } from "@web/vendor/lib/domain";
import {
  NEW_CLINIC_DEFAULTS,
  newClinicFormSchema,
  type NewClinicValues,
} from "@web/vendor/lib/new-clinic";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { useCreateClinic } from "@web/vendor/queries";
import { ModulePicker } from "@web/vendor/components/module-picker";

const TRIAL_CHOICES = [0, 14, VENDOR_TRIAL_DAYS, 60, 90] as const;

export function NewClinicDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (id: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const countryNames = new Intl.DisplayNames([i18n.language], { type: "region" });
  const create = useCreateClinic();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getFieldState,
    formState: { errors, isSubmitted },
  } = useForm<NewClinicValues, unknown, CreateClinicInput>({
    mode: "onTouched",
    defaultValues: NEW_CLINIC_DEFAULTS,
    resolver: zodResolver(newClinicFormSchema),
  });

  const wholeNameError =
    errors.name && "type" in errors.name ? (errors.name as FieldError) : undefined;
  const parsedDomain = parseDomain(watch("domain"));
  const website = parsedDomain ? clinicAddresses(parsedDomain, null).website : null;
  const modulesMissing = missingModules(watch("modules")).length > 0;

  const submit = handleSubmit((input) => {
    if (!modulesMissing) {
      create.mutate(input, { onSuccess: ({ id }) => onCreated(id) });
    }
  });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("vendor.newClinic.title")}
      descriptionKey="vendor.newClinic.subtitle"
      data-testid="vendor-new-clinic"
      footer={
        <div className="flex flex-col gap-2">
          {create.isError && (
            <p role="alert" className="text-label text-danger-700">
              {t(vendorErrorKey(create.error))}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              isLoading={create.isPending}
              onClick={() => void submit()}
              data-testid="vendor-new-clinic-submit"
            >
              {t("vendor.newClinic.submit")}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label font-bold text-primary-700">
            {t("vendor.newClinic.clinic")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="vendor.newClinic.nameAr"
              htmlFor="new-clinic-name-ar"
              error={errors.name?.ar ?? wholeNameError}
              errorKey="vendor.newClinic.problems.name"
            >
              <Input id="new-clinic-name-ar" {...register("name.ar")} />
            </FormField>
            <FormField
              label="vendor.newClinic.nameEn"
              htmlFor="new-clinic-name-en"
              error={errors.name?.en}
              errorKey="vendor.newClinic.problems.name"
            >
              <Input
                id="new-clinic-name-en"
                dir="ltr"
                {...register("name.en", {
                  onChange: (event: { target: { value: string } }) => {
                    if (!getFieldState("slug").isDirty) {
                      setValue("slug", slugFrom(event.target.value));
                    }
                  },
                })}
              />
            </FormField>
            <FormField
              label="vendor.newClinic.slug"
              htmlFor="new-clinic-slug"
              hint="vendor.newClinic.slugHint"
              error={errors.slug}
              errorKey="vendor.newClinic.problems.slug"
            >
              <Controller
                control={control}
                name="slug"
                render={({ field }) => (
                  <Input
                    id="new-clinic-slug"
                    dir="ltr"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(slugFrom(event.target.value))}
                    data-testid="new-clinic-slug"
                  />
                )}
              />
            </FormField>
            <FormField label="vendor.newClinic.country" htmlFor="new-clinic-country">
              <Controller
                control={control}
                name="country"
                render={({ field }) => (
                  <Select
                    id="new-clinic-country"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    searchable
                    options={Object.keys(COUNTRY_PRESETS).map((code) => ({
                      value: code,
                      label: countryNames.of(code) ?? code,
                    }))}
                  />
                )}
              />
            </FormField>
          </div>
          <FormField
            label="vendor.clinic.domain"
            htmlFor="new-clinic-domain"
            optional
            hint="vendor.clinic.domainHint"
            error={errors.domain}
            errorKey="vendor.newClinic.problems.domain"
          >
            <Input
              id="new-clinic-domain"
              dir="ltr"
              inputMode="url"
              placeholder={t("vendor.clinic.domainPlaceholder")}
              hasError={parsedDomain === undefined}
              {...register("domain")}
            />
          </FormField>
          {website && (
            <p className="text-meta text-ink-muted" dir="ltr">
              {website}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink-muted">{t("vendor.newClinic.specialty")}</span>
            <Controller
              control={control}
              name="specialties"
              render={({ field }) => (
                <div className="flex flex-wrap gap-4">
                  {Object.values(SPECIALTY_CODE).map((code: SpecialtyCode) => (
                    <Checkbox
                      key={code}
                      checked={field.value.includes(code)}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on
                            ? [...field.value.filter((entry) => entry !== code), code]
                            : field.value.filter((entry) => entry !== code),
                        )
                      }
                      label={t(`vendor.specialtyNames.${code}`)}
                    />
                  ))}
                </div>
              )}
            />
            {errors.specialties && (
              <p role="alert" className="text-label text-danger-700">
                {t("vendor.newClinic.problems.specialty")}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label font-bold text-primary-700">
            {t("vendor.newClinic.subscription")}
          </legend>
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink-muted">{t("vendor.clinic.tabs.modules")}</span>
            <Controller
              control={control}
              name="modules"
              render={({ field }) => (
                <ModulePicker
                  value={field.value}
                  onChange={field.onChange}
                  data-testid="new-clinic-modules"
                />
              )}
            />
            {isSubmitted && modulesMissing && (
              <p role="alert" className="text-label text-danger-700">
                {t("vendor.newClinic.problems.modules")}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="vendor.newClinic.trial" htmlFor="new-clinic-trial">
              <Controller
                control={control}
                name="trialDays"
                render={({ field }) => (
                  <Select
                    id="new-clinic-trial"
                    value={String(field.value)}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                    options={TRIAL_CHOICES.map((days) => ({
                      value: String(days),
                      label:
                        days === 0
                          ? t("vendor.newClinic.noTrial")
                          : t("vendor.newClinic.trialDays", { count: days }),
                    }))}
                  />
                )}
              />
            </FormField>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label font-bold text-primary-700">
            {t("vendor.newClinic.admin")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="vendor.newClinic.firstName"
              htmlFor="new-clinic-first"
              error={errors.admin?.firstName}
              errorKey="vendor.newClinic.problems.admin"
            >
              <Input id="new-clinic-first" {...register("admin.firstName")} />
            </FormField>
            <FormField
              label="vendor.newClinic.lastName"
              htmlFor="new-clinic-last"
              error={errors.admin?.lastName}
              errorKey="vendor.newClinic.problems.admin"
            >
              <Input id="new-clinic-last" {...register("admin.lastName")} />
            </FormField>
            <FormField
              label="vendor.newClinic.phone"
              htmlFor="new-clinic-phone"
              hint="vendor.newClinic.phoneHint"
              error={errors.admin?.phone}
              errorKey="vendor.newClinic.problems.phone"
            >
              <Input
                id="new-clinic-phone"
                dir="ltr"
                inputMode="tel"
                placeholder="+970…"
                {...register("admin.phone")}
              />
            </FormField>
            <FormField
              label="vendor.newClinic.email"
              htmlFor="new-clinic-email"
              optional
              error={errors.admin?.email}
              errorKey="vendor.newClinic.problems.email"
            >
              <Input id="new-clinic-email" dir="ltr" type="email" {...register("admin.email")} />
            </FormField>
            <FormField
              label="vendor.newClinic.password"
              htmlFor="new-clinic-password"
              hint="vendor.newClinic.passwordHint"
              optional
              error={errors.admin?.password}
              errorKey="vendor.newClinic.problems.password"
            >
              <PasswordInput
                id="new-clinic-password"
                dir="ltr"
                autoComplete="new-password"
                data-testid="new-clinic-password"
                {...register("admin.password")}
              />
            </FormField>
          </div>
        </fieldset>
      </form>
    </Drawer>
  );
}
