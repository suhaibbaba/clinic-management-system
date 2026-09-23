/** The openers on an empty conversation. The key is stable; the wording is the clinic's. */
export const SUGGESTIONS = [
  { key: "today", labelKey: "assistant.suggestions.today" },
  { key: "tomorrow", labelKey: "assistant.suggestions.tomorrow" },
  { key: "finances", labelKey: "assistant.suggestions.finances" },
  { key: "lapsed", labelKey: "assistant.suggestions.lapsed" },
] as const;

/** The three things the assistant is for, on an empty conversation; each asks its own opener. */
export const TOPICS = [
  { key: "appointments", icon: "calendar", prefix: "assistant.topics.appointments" },
  { key: "patients", icon: "user", prefix: "assistant.topics.patients" },
  { key: "finance", icon: "trend-up", prefix: "assistant.topics.finance" },
] as const;
