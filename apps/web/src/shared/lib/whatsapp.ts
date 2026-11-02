export const whatsAppNumber = (patient: {
  readonly whatsapp?: string | null | undefined;
  readonly phone: string | null;
}): string | null => patient.whatsapp ?? patient.phone;
