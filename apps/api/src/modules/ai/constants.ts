import { AI_MESSAGE_ROLE, USER_ROLE } from "@clinic/shared";

export const VIEW_REPLY_TOKENS = 200;

export const MAX_LOADS = 3;

export const HOUR_MS = 3_600_000;

export const SERVED_ROLES = [AI_MESSAGE_ROLE.USER, AI_MESSAGE_ROLE.ASSISTANT];

export const REPLAYED_ROLES = [...SERVED_ROLES, AI_MESSAGE_ROLE.TOOL];

export const REPLAY_MAX_CHARS = 4000;

export const REPLAYED_RESULTS = 2;

export const REPLAY_BUDGET_CHARS = 6000;

export const STAFF = [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST] as const;

export const HEARTBEAT = ": ping\n\n";

export const HEARTBEAT_MS = 15_000;

export const CHAT_PROVIDER = Symbol("CHAT_PROVIDER");

export const MAX_CLINIC_CLIENTS = 50;
