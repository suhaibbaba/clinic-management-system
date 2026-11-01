import {
  COUNTRY_PRESETS,
  SPECIALTY_CODE,
  type CreateClinicInput,
  type SpecialtyCode,
} from "@clinic/shared";
import { Button } from "@clinic/ui/components/button";
import { Checkbox } from "@clinic/ui/components/checkbox";
import { Drawer } from "@clinic/ui/components/drawer";
import { FormField } from "@clinic/ui/components/form-field";
import { Input } from "@clinic/ui/components/input";
import { Select } from "@clinic/ui/components/select";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { VENDOR_TRIAL_DAYS } from "@web/vendor/constants";
import { slugFrom } from "@web/vendor/lib/clinic-actions";
import { defaultPlanId } from "@web/vendor/lib/subscription";
import { clinicAddresses, parseDomain } from "@web/vendor/lib/domain";
import { newClinicProblems } from "@web/vendor/lib/new-clinic";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { useCreateClinic, usePlans } from "@web/vendor/queries";

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
  const plans = usePlans();
  const countryNames = new Intl.DisplayNames([i18n.language], { type: "region" });
  const create = useCreateClinic();
  const offered = (plans.data?.items ?? []).filter((plan) => plan.isActive);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [country, setCountry] = useState("PS");
  const [domain, setDomain] = useState("");
  const [specialties, setSpecialties] = useState<SpecialtyCode[]>([SPECIALTY_CODE.DENTAL]);
  const [planId, setPlanId] = useState("");
  const [trialDays, setTrialDays] = useState<number>(VENDOR_TRIAL_DAYS);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);

  const parsedDomain = parseDomain(domain);
  const chosenPlan = planId || defaultPlanId(offered);
  const input: CreateClinicInput = {
    name: {
      ...(nameAr.trim() && { ar: nameAr.trim() }),
      ...(nameEn.trim() && { en: nameEn.trim() }),
    },
    slug: slug.trim(),
    country,
    domain: parsedDomain ?? null,
    specialties,
    planId: chosenPlan,
    trialDays,
    admin: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim() === "" ? null : email.trim(),
    },
  };
  const problems = newClinicProblems(input, parsedDomain === undefined);
  const addresses = parsedDomain ? clinicAddresses(parsedDomain) : null;

  const submit = (): void => {
    setTried(true);

    if (problems.length === 0) {
      create.mutate(input, { onSuccess: ({ id }) => onCreated(id) });
    }
  };

  const toggleSpecialty = (code: SpecialtyCode, on: boolean): void =>
    setSpecialties((current) =>
      on
        ? [...current.filter((entry) => entry !== code), code]
        : current.filter((entry) => entry !== code),
    );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("vendor.newClinic.title")}
      descriptionKey="vendor.newClinic.subtitle"
      data-testid="vendor-new-clinic"
      footer={
        <div className="flex flex-col gap-2">
          {tried && problems.length > 0 && (
            <p role="alert" className="text-label text-danger-700">
              {t(`vendor.newClinic.problems.${problems[0]}`)}
            </p>
          )}
          {create.isError && (
            <p role="alert" className="text-label text-danger-700">
              {t(vendorErrorKey(create.error))}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              isLoading={create.isPending}
              onClick={submit}
              data-testid="vendor-new-clinic-submit"
            >
              {t("vendor.newClinic.submit")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label font-bold text-primary-700">
            {t("vendor.newClinic.clinic")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="vendor.newClinic.nameAr" htmlFor="new-clinic-name-ar">
              <Input
                id="new-clinic-name-ar"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
              />
            </FormField>
            <FormField label="vendor.newClinic.nameEn" htmlFor="new-clinic-name-en">
              <Input
                id="new-clinic-name-en"
                dir="ltr"
                value={nameEn}
                onChange={(event) => {
                  setNameEn(event.target.value);
                  if (!slugTouched) {
                    setSlug(slugFrom(event.target.value));
                  }
                }}
              />
            </FormField>
            <FormField
              label="vendor.newClinic.slug"
              htmlFor="new-clinic-slug"
              hint="vendor.newClinic.slugHint"
            >
              <Input
                id="new-clinic-slug"
                dir="ltr"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugFrom(event.target.value));
                }}
                data-testid="new-clinic-slug"
              />
            </FormField>
            <FormField label="vendor.newClinic.country" htmlFor="new-clinic-country">
              <Select
                id="new-clinic-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                searchable
                options={Object.keys(COUNTRY_PRESETS).map((code) => ({
                  value: code,
                  label: countryNames.of(code) ?? code,
                }))}
              />
            </FormField>
          </div>
          <FormField
            label="vendor.clinic.domain"
            htmlFor="new-clinic-domain"
            optional
            hint="vendor.clinic.domainHint"
          >
            <Input
              id="new-clinic-domain"
              dir="ltr"
              inputMode="url"
              placeholder={t("vendor.clinic.domainPlaceholder")}
              value={domain}
              hasError={parsedDomain === undefined}
              onChange={(event) => setDomain(event.target.value)}
            />
          </FormField>
          {addresses && (
            <p className="text-meta text-ink-muted" dir="ltr">
              {addresses.website} · {addresses.dashboard}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink-muted">{t("vendor.newClinic.specialty")}</span>
            <div className="flex flex-wrap gap-4">
              {Object.values(SPECIALTY_CODE).map((code) => (
                <Checkbox
                  key={code}
                  checked={specialties.includes(code)}
                  onCheckedChange={(on) => toggleSpecialty(code, on)}
                  label={t(`vendor.specialtyNames.${code}`)}
                />
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label font-bold text-primary-700">
            {t("vendor.newClinic.subscription")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="vendor.clinic.plan" htmlFor="new-clinic-plan">
              <Select
                id="new-clinic-plan"
                searchable
                value={chosenPlan || undefined}
                placeholder={t("vendor.clinic.choosePlan")}
                onChange={(event) => setPlanId(event.target.value)}
                options={offered.map((plan) => ({ value: plan.id, label: plan.name }))}
              />
            </FormField>
            <FormField label="vendor.newClinic.trial" htmlFor="new-clinic-trial">
              <Select
                id="new-clinic-trial"
                value={String(trialDays)}
                onChange={(event) => setTrialDays(Number(event.target.value))}
                options={TRIAL_CHOICES.map((days) => ({
                  value: String(days),
                  label:
                    days === 0
                      ? t("vendor.newClinic.noTrial")
                      : t("vendor.newClinic.trialDays", { count: days }),
                }))}
              />
            </FormField>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label font-bold text-primary-700">
            {t("vendor.newClinic.admin")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="vendor.newClinic.firstName" htmlFor="new-clinic-first">
              <Input
                id="new-clinic-first"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </FormField>
            <FormField label="vendor.newClinic.lastName" htmlFor="new-clinic-last">
              <Input
                id="new-clinic-last"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </FormField>
            <FormField
              label="vendor.newClinic.phone"
              htmlFor="new-clinic-phone"
              hint="vendor.newClinic.phoneHint"
            >
              <Input
                id="new-clinic-phone"
                dir="ltr"
                inputMode="tel"
                placeholder="+970…"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormField>
            <FormField label="vendor.newClinic.email" htmlFor="new-clinic-email" optional>
              <Input
                id="new-clinic-email"
                dir="ltr"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          </div>
        </fieldset>
      </div>
    </Drawer>
  );
}
