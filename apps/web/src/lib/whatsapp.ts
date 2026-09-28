export const whatsAppNumber = (patient: {
  readonly whatsapp?: string | null | undefined;
  readonly phone: string;
}): string => patient.whatsapp ?? patient.phone;
