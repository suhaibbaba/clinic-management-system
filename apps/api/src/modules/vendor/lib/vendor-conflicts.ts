import { ConflictException } from "@nestjs/common";
import {
  VENDOR_DOMAIN_TAKEN,
  VENDOR_EMAIL_TAKEN,
  VENDOR_PHONE_TAKEN,
  VENDOR_SLUG_TAKEN,
} from "@clinic/shared";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";

const CODE_OF_CONSTRAINT: Readonly<Record<string, string>> = {
  clinics_slug_uniq: VENDOR_SLUG_TAKEN,
  clinics_site_domain_uniq: VENDOR_DOMAIN_TAKEN,
  users_phone_uniq: VENDOR_PHONE_TAKEN,
  users_email_uniq: VENDOR_EMAIL_TAKEN,
};

export function conflictFor(error: unknown): ConflictException | undefined {
  const constraint = violatedConstraint(error, UNIQUE_VIOLATION);
  const code = constraint === undefined ? undefined : CODE_OF_CONSTRAINT[constraint];

  return code === undefined ? undefined : new ConflictException(code);
}
