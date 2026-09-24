/** The number to open a WhatsApp chat with: the patient's own WhatsApp, else their phone. */
export const whatsAppNumber = (patient: {
  readonly whatsapp?: string | null | undefined;
  readonly phone: string;
}): string => patient.whatsapp ?? patient.phone;
