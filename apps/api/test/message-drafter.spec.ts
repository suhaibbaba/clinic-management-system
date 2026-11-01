import { AI_OUTBOUND_TARGET, LANGUAGE_CODES } from "@clinic/shared";
import type { ChatProvider } from "@api/modules/ai/lib/chat-provider";
import type { ChatProviderResolver } from "@api/modules/ai/services/chat-provider.resolver";
import {
  DEFAULT_TEMPLATES,
  isValidTemplate,
  MessageDrafterService,
  PLACEHOLDERS,
} from "@api/modules/ai/outbound/message-drafter.service";

const CANDIDATE = {
  patientId: "11111111-1111-4111-8111-111111111111",
  name: "سمير",
  phone: "+970599000000",
  vars: { name: "سمير", clinic: "عيادة الابتسامة", balance: "120 ₪" },
};

function drafter(reply: string, prompts: string[] = []): MessageDrafterService {
  const provider: ChatProvider = {
    name: "scripted",
    async *stream(request) {
      prompts.push(request.messages[0]?.content ?? "");
      yield await Promise.resolve({
        type: "completed" as const,
        text: reply,
        toolCalls: [],
        usage: { inputTokens: 0, outputTokens: 0 },
      });
    },
  };

  return new MessageDrafterService({
    for: () => Promise.resolve(provider),
  } as unknown as ChatProviderResolver);
}

describe("drafting a patient message", () => {
  it("fills the model's template per patient, on the server", async () => {
    const [message] = await drafter("مرحباً {name}، عليك {balance} لدى {clinic}.").draft(
      "clinic",
      AI_OUTBOUND_TARGET.UNPAID_INVOICES,
      "ذكّرهم",
      [CANDIDATE],
      "ar",
    );

    expect(message?.text).toBe("مرحباً سمير، عليك 120 ₪ لدى عيادة الابتسامة.");
  });

  it.each([
    ["a link", "مرحباً {name}، ادفع هنا https://evil.example"],
    ["an unknown placeholder", "مرحباً {name}، رقمك {phone}"],
    ["a stray brace", "مرحباً {name}، {"],
    ["nothing", ""],
  ])("falls back to the default template on %s", async (_label, reply) => {
    const [message] = await drafter(reply).draft(
      "clinic",
      AI_OUTBOUND_TARGET.UNPAID_INVOICES,
      "ذكّرهم",
      [CANDIDATE],
      "ar",
    );

    expect(message?.text).toBe(
      DEFAULT_TEMPLATES.ar[AI_OUTBOUND_TARGET.UNPAID_INVOICES]
        .replace("{name}", "سمير")
        .replace("{balance}", "120 ₪")
        .replace("{clinic}", "عيادة الابتسامة"),
    );
  });

  it("writes in the clinic's document language", async () => {
    const prompts: string[] = [];
    const [message] = await drafter("", prompts).draft(
      "clinic",
      AI_OUTBOUND_TARGET.UNPAID_INVOICES,
      "remind them",
      [CANDIDATE],
      "tr",
    );

    expect(prompts[0]).toContain("Write in Türkçe (tr)");
    expect(message?.text).toBe(
      DEFAULT_TEMPLATES.tr[AI_OUTBOUND_TARGET.UNPAID_INVOICES]
        .replace("{name}", "سمير")
        .replace("{balance}", "120 ₪")
        .replace("{clinic}", "عيادة الابتسامة"),
    );
    expect(message?.text).toMatch(/^Merhaba/);
  });

  it("has a default message for every language and target, using only its placeholders", () => {
    for (const language of LANGUAGE_CODES) {
      for (const target of Object.values(AI_OUTBOUND_TARGET)) {
        expect(
          isValidTemplate(DEFAULT_TEMPLATES[language][target], [...PLACEHOLDERS[target], "intent"]),
        ).toBe(true);
      }
    }
  });

  it("accepts only its own target's placeholders", () => {
    expect(isValidTemplate("مرحباً {name}، موعدك {time}", PLACEHOLDERS.overdue_labs)).toBe(false);
    expect(isValidTemplate("مرحباً {name}، موعدك {time}", PLACEHOLDERS.tomorrow_appointments)).toBe(
      true,
    );
  });
});
