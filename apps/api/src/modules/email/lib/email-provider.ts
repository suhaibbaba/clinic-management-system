export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentId: string;
}

export interface OutboundEmail {
  readonly to: string;
  readonly fromName?: string | undefined;
  readonly replyTo?: string | undefined;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly attachments?: readonly EmailAttachment[] | undefined;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutboundEmail): Promise<void>;
}
