import {
  type AiPlanStepStatus,
  type AiProposalStatus,
  type ClinicSecretKind,
  AI_PROPOSAL_STATUS,
  CLINIC_SECRET_KIND,
} from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui";

export const SUGGESTIONS = [
  { key: "today", labelKey: "assistant.suggestions.today" },
  { key: "tomorrow", labelKey: "assistant.suggestions.tomorrow" },
  { key: "finances", labelKey: "assistant.suggestions.finances" },
  { key: "lapsed", labelKey: "assistant.suggestions.lapsed" },
] as const;

export const TOPICS = [
  { key: "appointments", icon: "calendar", prefix: "assistant.topics.appointments" },
  { key: "patients", icon: "user", prefix: "assistant.topics.patients" },
  { key: "finance", icon: "trend-up", prefix: "assistant.topics.finance" },
] as const;

export const ASSISTANT_SETTINGS_PATH = "/settings";

export const ASSISTANT_SETTINGS_TABS = ["rules", "actions", "outbound", "keys"] as const;

export const AI_ACTION_STATUS_TONES: Record<AiProposalStatus, BadgeTone> = {
  [AI_PROPOSAL_STATUS.DRAFT]: "info",
  [AI_PROPOSAL_STATUS.SENDING]: "info",
  [AI_PROPOSAL_STATUS.SENT]: "success",
  [AI_PROPOSAL_STATUS.DONE]: "success",
  [AI_PROPOSAL_STATUS.FAILED]: "danger",
  [AI_PROPOSAL_STATUS.CANCELLED]: "neutral",
  [AI_PROPOSAL_STATUS.EXPIRED]: "warning",
};

export const AI_PLAN_STEP_TONES: Record<AiPlanStepStatus, BadgeTone> = {
  pending: "neutral",
  done: "success",
  failed: "danger",
};

export const AI_SEND_CAPABILITY = "ai-outbound.send";

export const AI_PROPOSAL_STATUS_TONES: Record<AiProposalStatus, BadgeTone> = {
  [AI_PROPOSAL_STATUS.DRAFT]: "info",
  [AI_PROPOSAL_STATUS.SENDING]: "info",
  [AI_PROPOSAL_STATUS.SENT]: "success",
  [AI_PROPOSAL_STATUS.CANCELLED]: "neutral",
  [AI_PROPOSAL_STATUS.EXPIRED]: "warning",
  [AI_PROPOSAL_STATUS.DONE]: "success",
  [AI_PROPOSAL_STATUS.FAILED]: "danger",
};

export const OUTBOUND_OUTCOMES = ["sent", "failed"] as const;

export const PROVIDER_KEY_GROUPS: readonly {
  readonly id: string;
  readonly kinds: readonly ClinicSecretKind[];
}[] = [
  { id: "openai", kinds: [CLINIC_SECRET_KIND.OPENAI_API_KEY] },
  {
    id: "whatsapp",
    kinds: [
      CLINIC_SECRET_KIND.WHATSAPP_ACCESS_TOKEN,
      CLINIC_SECRET_KIND.WHATSAPP_PHONE_NUMBER_ID,
      CLINIC_SECRET_KIND.WHATSAPP_TEMPLATE_NAME,
      CLINIC_SECRET_KIND.WHATSAPP_DOCUMENT_TEMPLATE_NAME,
    ],
  },
];
