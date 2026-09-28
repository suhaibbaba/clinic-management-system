import { type LabStatement } from "@clinic/shared";
import { documentDate } from "@api/modules/billing/pdf/document-format";

export const shortId = (id: string): string => id.slice(0, 8).toUpperCase();

export const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

export function formatPeriod(statement: LabStatement, timeZone: string): string {
  const to = documentDate(statement.to ?? new Date().toISOString(), timeZone);

  return statement.from ? `${documentDate(statement.from, timeZone)} – ${to}` : to;
}
