import { Resend } from "resend";
import { type EmailProvider, type OutboundEmail } from "@api/modules/email/lib/email-provider";

export function resendSender(apiKey: string, from: string): EmailProvider {
  const resend = new Resend(apiKey);
  const fromAddress = from.match(/<([^>]+)>/)?.[1] ?? from;

  return {
    name: "resend",
    async send(email: OutboundEmail): Promise<void> {
      const { error } = await resend.emails.send({
        from: email.fromName ? `${email.fromName} <${fromAddress}>` : from,
        to: [email.to],
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.attachments?.length
          ? {
              attachments: email.attachments.map((file) => ({
                filename: file.filename,
                content: file.content.toString("base64"),
                contentId: file.contentId,
              })),
            }
          : {}),
      });

      if (error) {
        throw new Error(`Resend refused the message: ${error.message}`);
      }
    },
  };
}
