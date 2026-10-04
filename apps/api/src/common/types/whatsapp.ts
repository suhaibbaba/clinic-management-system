export interface WhatsAppCredentials {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly templateName: string;
  readonly documentTemplateName: string | null;
}
