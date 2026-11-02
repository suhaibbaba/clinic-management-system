import {
  SPECIALTY_CODE,
  createClinicSchema,
  type ClinicModule,
  type CreateClinicInput,
  type SpecialtyCode,
} from "@clinic/shared";
import { z } from "zod";
import { VENDOR_TRIAL_DAYS } from "@web/vendor/constants";
import { parseDomain } from "@web/vendor/lib/domain";

export interface NewClinicValues {
  readonly name: { readonly ar: string; readonly en: string };
  readonly slug: string;
  readonly country: string;
  readonly domain: string;
  readonly specialties: SpecialtyCode[];
  readonly modules: ClinicModule[];
  readonly trialDays: number;
  readonly admin: {
    readonly firstName: string;
    readonly lastName: string;
    readonly phone: string;
    readonly email: string;
    readonly password: string;
  };
}

export const NEW_CLINIC_DEFAULTS: NewClinicValues = {
  name: { ar: "", en: "" },
  slug: "",
  country: "PS",
  domain: "",
  specialties: [SPECIALTY_CODE.DENTAL],
  modules: [],
  trialDays: VENDOR_TRIAL_DAYS,
  admin: { firstName: "", lastName: "", phone: "", email: "", password: "" },
};

export function newClinicPayload(values: NewClinicValues): unknown {
  const nameAr = values.name.ar.trim();
  const nameEn = values.name.en.trim();
  const domain = parseDomain(values.domain);
  const email = values.admin.email.trim();

  return {
    name: { ...(nameAr && { ar: nameAr }), ...(nameEn && { en: nameEn }) },
    slug: values.slug.trim(),
    country: values.country,
    domain: domain === undefined ? values.domain.trim() : domain,
    specialties: values.specialties,
    modules: values.modules,
    trialDays: values.trialDays,
    admin: {
      firstName: values.admin.firstName.trim(),
      lastName: values.admin.lastName.trim(),
      phone: values.admin.phone.trim(),
      email: email === "" ? null : email,
      ...(values.admin.password !== "" && { password: values.admin.password }),
    },
  };
}

export const newClinicFormSchema: z.ZodType<CreateClinicInput, NewClinicValues> = z.preprocess(
  (values) => newClinicPayload(values as NewClinicValues),
  createClinicSchema,
);
