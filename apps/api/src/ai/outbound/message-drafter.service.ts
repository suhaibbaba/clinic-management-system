import { Injectable, Logger } from "@nestjs/common";
import { AI_OUTBOUND_TARGET, renderTemplate, type AiOutboundTarget } from "@clinic/shared";
import { ChatProviderResolver } from "@api/ai/chat-provider.resolver";
import type { Candidate } from "@api/ai/outbound/outbound-recipients.service";

export const DRAFT_MAX_LENGTH = 600;

const COMMON_PLACEHOLDERS = ["name", "clinic"] as const;

export const PLACEHOLDERS: Record<AiOutboundTarget, readonly string[]> = {
  [AI_OUTBOUND_TARGET.OVERDUE_LABS]: [...COMMON_PLACEHOLDERS, "days"],
  [AI_OUTBOUND_TARGET.UNPAID_INVOICES]: [...COMMON_PLACEHOLDERS, "balance"],
  [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]: [...COMMON_PLACEHOLDERS, "time", "doctor"],
  [AI_OUTBOUND_TARGET.PATIENT_IDS]: COMMON_PLACEHOLDERS,
};

// Patient-facing, so Arabic like the notification defaults. Used when no model is configured and
// when the model's draft fails validation — a person still reads every message before it goes.
export const DEFAULT_TEMPLATES: Record<AiOutboundTarget, string> = {
  [AI_OUTBOUND_TARGET.OVERDUE_LABS]:
    "مرحباً {name}، نعتذر عن تأخر العمل المخبري الخاص بك في {clinic}. سنتواصل معك فور وصوله.",
  [AI_OUTBOUND_TARGET.UNPAID_INVOICES]:
    "مرحباً {name}، نود تذكيرك بوجود رصيد مستحق بقيمة {balance} لدى {clinic}. يسعدنا تواصلك معنا لأي استفسار.",
  [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]:
    "مرحباً {name}، نذكّرك بموعدك غداً في {clinic} مع {doctor} الساعة {time}.",
  [AI_OUTBOUND_TARGET.PATIENT_IDS]: "مرحباً {name}، {intent}\n{clinic}",
};

export interface DraftedMessage {
  readonly patientId: string;
  readonly name: string;
  readonly phone: string;
  readonly text: string;
}

// One template per proposal, filled per patient on the server: the model phrases the message once
// and never sees a recipient's name, number or balance.
@Injectable()
export class MessageDrafterService {
  private readonly logger = new Logger("Assistant");

  constructor(private readonly providers: ChatProviderResolver) {}

  async draft(
    clinicId: string,
    target: AiOutboundTarget,
    intent: string,
    candidates: readonly Candidate[],
  ): Promise<DraftedMessage[]> {
    const template = await this.template(clinicId, target, intent);

    return candidates.map((candidate) => ({
      patientId: candidate.patientId,
      name: candidate.name,
      phone: candidate.phone,
      text: renderTemplate(template, { ...candidate.vars, intent }).slice(0, DRAFT_MAX_LENGTH),
    }));
  }

  private async template(
    clinicId: string,
    target: AiOutboundTarget,
    intent: string,
  ): Promise<string> {
    try {
      const provider = await this.providers.for(clinicId);

      // The echo provider would phrase the prompt back at the patient.
      if (provider.name === "log") {
        return DEFAULT_TEMPLATES[target];
      }

      let text = "";

      for await (const chunk of provider.stream({
        messages: [
          { role: "system", content: phrasingPrompt(PLACEHOLDERS[target]) },
          { role: "user", content: intent },
        ],
        tools: [],
      })) {
        if (chunk.type === "completed") {
          text = chunk.text;
        }
      }

      const candidate = cleanTemplate(text);

      if (isValidTemplate(candidate, PLACEHOLDERS[target])) {
        return candidate;
      }

      this.logger.warn(`The drafted ${target} template failed validation; using the default.`);
    } catch (error) {
      this.logger.warn(`Drafting a ${target} template failed: ${String(error)}`);
    }

    return DEFAULT_TEMPLATES[target];
  }
}

function phrasingPrompt(placeholders: readonly string[]): string {
  return [
    "You write one short WhatsApp message that a clinic sends to its patients.",
    "The user's text is the staff member's intent; turn it into the message a patient receives.",
    "Write in Arabic, polite and warm, in a Palestinian/Jordanian register, unless the intent asks",
    "for another language. At most 400 characters. No links, no phone numbers, no emojis.",
    `You may use only these placeholders, written exactly with braces: ${placeholders
      .map((name) => `{${name}}`)
      .join(", ")}. They are filled per patient; never write a name or an amount yourself.`,
    "No other braces anywhere. Reply with the message text only — no quotes, no explanation.",
  ].join("\n");
}

const cleanTemplate = (text: string): string =>
  text
    .trim()
    .replace(/^["'`«“]+|["'`»”]+$/g, "")
    .trim();

/** Exported for the tests. A template is refused, not repaired: the default is always safe. */
export function isValidTemplate(template: string, allowed: readonly string[]): boolean {
  if (template.length < 10 || template.length > DRAFT_MAX_LENGTH) {
    return false;
  }

  // A link in a message nobody typed is how an injected instruction would phish a patient.
  if (/https?:\/\/|www\./i.test(template)) {
    return false;
  }

  const braces = template.match(/[{}]/g) ?? [];
  const placeholders = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");

  return (
    braces.length === placeholders.length * 2 &&
    placeholders.every((name) => allowed.includes(name))
  );
}
