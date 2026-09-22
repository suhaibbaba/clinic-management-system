import { AI_OUTBOUND_TARGET } from "@clinic/shared";
import type { ChatProvider } from "@api/ai/chat-provider";
import type { ChatProviderResolver } from "@api/ai/chat-provider.resolver";
import {
  DEFAULT_TEMPLATES,
  isValidTemplate,
  MessageDrafterService,
  PLACEHOLDERS,
} from "@api/ai/outbound/message-drafter.service";

const CANDIDATE = {
  patientId: "11111111-1111-4111-8111-111111111111",
  name: "سمير",
  phone: "+970599000000",
  vars: { name: "سمير", clinic: "عيادة الابتسامة", balance: "120 ₪" },
};

function drafter(reply: string): MessageDrafterService {
  const provider: ChatProvider = {
    name: "scripted",
    async *stream() {
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
    );

    expect(message?.text).toBe("مرحباً سمير، عليك 120 ₪ لدى عيادة الابتسامة.");
  });

  // Prompt injection would arrive as a link or a placeholder the server never fills.
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
    );

    expect(message?.text).toBe(
      DEFAULT_TEMPLATES[AI_OUTBOUND_TARGET.UNPAID_INVOICES]
        .replace("{name}", "سمير")
        .replace("{balance}", "120 ₪")
        .replace("{clinic}", "عيادة الابتسامة"),
    );
  });

  it("accepts only its own target's placeholders", () => {
    expect(isValidTemplate("مرحباً {name}، موعدك {time}", PLACEHOLDERS.overdue_labs)).toBe(false);
    expect(isValidTemplate("مرحباً {name}، موعدك {time}", PLACEHOLDERS.tomorrow_appointments)).toBe(
      true,
    );
  });
});
