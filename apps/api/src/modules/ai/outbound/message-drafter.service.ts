import { Injectable, Logger } from "@nestjs/common";
import {
  AI_OUTBOUND_TARGET,
  languageDefinition,
  renderTemplate,
  type AiOutboundTarget,
  type LanguageCode,
} from "@clinic/shared";
import { ChatProviderResolver } from "@api/modules/ai/services/chat-provider.resolver";
import type { Candidate } from "@api/modules/ai/outbound/outbound-recipients.service";

export const DRAFT_MAX_LENGTH = 600;

const COMMON_PLACEHOLDERS = ["name", "clinic"] as const;

export const PLACEHOLDERS: Record<AiOutboundTarget, readonly string[]> = {
  [AI_OUTBOUND_TARGET.OVERDUE_LABS]: [...COMMON_PLACEHOLDERS, "days"],
  [AI_OUTBOUND_TARGET.UNPAID_INVOICES]: [...COMMON_PLACEHOLDERS, "balance"],
  [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]: [...COMMON_PLACEHOLDERS, "date", "time", "doctor"],
  [AI_OUTBOUND_TARGET.PATIENT_IDS]: COMMON_PLACEHOLDERS,
};

export const DEFAULT_TEMPLATES: Record<LanguageCode, Record<AiOutboundTarget, string>> = {
  ar: {
    [AI_OUTBOUND_TARGET.OVERDUE_LABS]:
      "مرحباً {name}، نعتذر عن تأخر العمل المخبري الخاص بك في {clinic}. سنتواصل معك فور وصوله.",
    [AI_OUTBOUND_TARGET.UNPAID_INVOICES]:
      "مرحباً {name}، نود تذكيرك بوجود رصيد مستحق بقيمة {balance} لدى {clinic}. يسعدنا تواصلك معنا لأي استفسار.",
    [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]:
      "مرحباً {name}، نذكّرك بموعدك غداً في {clinic} مع {doctor} الساعة {time}.",
    [AI_OUTBOUND_TARGET.PATIENT_IDS]: "مرحباً {name}، {intent}\n{clinic}",
  },
  en: {
    [AI_OUTBOUND_TARGET.OVERDUE_LABS]:
      "Hello {name}, we are sorry that your lab work at {clinic} is taking longer than expected. We will contact you as soon as it arrives.",
    [AI_OUTBOUND_TARGET.UNPAID_INVOICES]:
      "Hello {name}, a kind reminder that you have an outstanding balance of {balance} with {clinic}. Please get in touch with any question.",
    [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]:
      "Hello {name}, a reminder of your appointment tomorrow at {clinic} with {doctor} at {time}.",
    [AI_OUTBOUND_TARGET.PATIENT_IDS]: "Hello {name}, {intent}\n{clinic}",
  },
  tr: {
    [AI_OUTBOUND_TARGET.OVERDUE_LABS]:
      "Merhaba {name}, laboratuvar çalışmanızın beklenenden uzun sürdüğü için özür dileriz. Ulaşır ulaşmaz sizinle iletişime geçeceğiz.\n{clinic}",
    [AI_OUTBOUND_TARGET.UNPAID_INVOICES]:
      "Merhaba {name}, {balance} tutarında ödenmemiş bakiyeniz bulunduğunu hatırlatmak isteriz. Sorularınız için bize her zaman ulaşabilirsiniz.\n{clinic}",
    [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]:
      "Merhaba {name}, yarınki randevunuzu hatırlatmak isteriz: {clinic}, {doctor}, saat {time}.",
    [AI_OUTBOUND_TARGET.PATIENT_IDS]: "Merhaba {name}, {intent}\n{clinic}",
  },
};

export interface DraftedMessage {
  readonly patientId: string;
  readonly name: string;
  readonly phone: string;
  readonly text: string;
}

@Injectable()
export class MessageDrafterService {
  private readonly logger = new Logger("Assistant");

  constructor(private readonly providers: ChatProviderResolver) {}

  async draft(
    clinicId: string,
    target: AiOutboundTarget,
    intent: string,
    candidates: readonly Candidate[],
    language: LanguageCode,
  ): Promise<DraftedMessage[]> {
    const template = await this.template(clinicId, target, intent, language);

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
    language: LanguageCode,
  ): Promise<string> {
    try {
      const provider = await this.providers.for(clinicId);

      if (provider.name === "log") {
        return DEFAULT_TEMPLATES[language][target];
      }

      let text = "";

      for await (const chunk of provider.stream({
        messages: [
          { role: "system", content: phrasingPrompt(PLACEHOLDERS[target], language) },
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

    return DEFAULT_TEMPLATES[language][target];
  }
}

function phrasingPrompt(placeholders: readonly string[], language: LanguageCode): string {
  return [
    "You write one short WhatsApp message that a clinic sends to its patients.",
    "The user's text is the staff member's intent; turn it into the message a patient receives.",
    `Write in ${languageDefinition(language).nativeName} (${language}), polite and warm, unless the`,
    "intent asks for another language; Arabic is in a Palestinian/Jordanian register. At most 400",
    "characters. No links, no phone numbers, no emojis.",
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

export function isValidTemplate(template: string, allowed: readonly string[]): boolean {
  if (template.length < 10 || template.length > DRAFT_MAX_LENGTH) {
    return false;
  }

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
