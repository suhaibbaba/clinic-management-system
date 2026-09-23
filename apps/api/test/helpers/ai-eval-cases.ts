import { AI_TOOL, type AiRiskTier } from "@clinic/shared";
import type { ToolGroup } from "@api/ai/tools/tool-groups";

export interface EvalCase {
  readonly question: string;
  /** The groups a good answer loads first; none for a core tool. */
  readonly groups: readonly ToolGroup[];
  readonly tool: string;
  /** Null for a read, which runs at once. */
  readonly tier: AiRiskTier | null;
}

// One or more questions per group, Arabic as the clinic writes it and English where staff mix it
// in. The same list drives the scripted regression spec and the live run against a real model.
export const EVAL_CASES: readonly EvalCase[] = [
  { question: "شو مواعيد اليوم؟", groups: [], tool: AI_TOOL.GET_APPOINTMENTS, tier: null },
  { question: "مين المريض أحمد خالد؟", groups: [], tool: AI_TOOL.SEARCH_PATIENTS, tier: null },
  { question: "افتحلي ملف سمير خليل", groups: [], tool: AI_TOOL.GET_PATIENT_SUMMARY, tier: null },
  { question: "مين الدكاترة اللي عنا؟", groups: [], tool: AI_TOOL.FIND_DOCTORS, tier: null },
  { question: "مين ما زار العيادة من ٦ شهور؟", groups: [], tool: AI_TOOL.QUERY_DATA, tier: null },
  {
    question: "ابعت تذكير للمرضى اللي عليهم ذمم",
    groups: [],
    tool: AI_TOOL.DRAFT_BULK_MESSAGE,
    tier: null,
  },
  { question: "رشا بتغطي باسل بكرا", groups: [], tool: AI_TOOL.PROPOSE_PLAN, tier: "confirm" },
  {
    question: "احجز لسمير بكرا الساعة ١٠",
    groups: ["appointments"],
    tool: AI_TOOL.CREATE_APPOINTMENT,
    tier: "confirm",
  },
  {
    question: "Move Ahmad's appointment to Friday 10am",
    groups: ["appointments"],
    tool: AI_TOOL.RESCHEDULE_APPOINTMENT,
    tier: "confirm",
  },
  {
    question: "الغي موعد يارا اليوم",
    groups: ["appointments"],
    tool: AI_TOOL.CANCEL_APPOINTMENTS,
    tier: "confirm",
  },
  {
    question: "سمير وصل",
    groups: ["appointments"],
    tool: AI_TOOL.SET_APPOINTMENT_STATUS,
    tier: "auto",
  },
  {
    question: "في وقت فاضي عند د. رشا الخميس؟",
    groups: ["appointments"],
    tool: AI_TOOL.FIND_AVAILABLE_SLOTS,
    tier: null,
  },
  {
    question: "حط سارة على قائمة الانتظار لد. باسل",
    groups: ["appointments"],
    tool: "waiting_list_create",
    tier: "confirm",
  },
  {
    question: "سجّل مريض جديد اسمه فادي حداد",
    groups: ["patients"],
    tool: AI_TOOL.CREATE_PATIENT,
    tier: "confirm",
  },
  {
    question: "ضيف ملاحظة لملف سمير: بدو متابعة بعد أسبوع",
    groups: ["patients"],
    tool: AI_TOOL.ADD_PATIENT_NOTE,
    tier: "auto",
  },
  {
    question: "Write the prescription Dr. Basel dictated for Samir",
    groups: ["patients"],
    tool: "prescriptions_create",
    tier: "confirm",
  },
  {
    question: "اعطي د. باسل إجازة بكرا",
    groups: ["schedule"],
    tool: AI_TOOL.ADD_DOCTOR_TIME_OFF,
    tier: "confirm",
  },
  {
    question: "كم موعد انلغى الشهر الماضي؟",
    groups: ["reports"],
    tool: AI_TOOL.GET_DAILY_STATS,
    tier: null,
  },
  {
    question: "رشا بتداوم الخميس من ١٠ لـ ٣ بس هالأسبوع",
    groups: ["schedule"],
    tool: AI_TOOL.ADD_DOCTOR_EXTRA_HOURS,
    tier: "confirm",
  },
  {
    question: "باسل ما عاد يداوم السبت",
    groups: ["schedule"],
    tool: AI_TOOL.SET_DOCTOR_SCHEDULE,
    tier: "confirm",
  },
  {
    question: "Which lab orders are late?",
    groups: ["labs"],
    tool: AI_TOOL.GET_OVERDUE_LAB_ORDERS,
    tier: null,
  },
  {
    question: "ابعت طلبية التاج تبعت سمير للمختبر",
    groups: ["labs"],
    tool: AI_TOOL.SET_LAB_ORDER_STATUS,
    tier: "confirm",
  },
  {
    question: "شو ناقص بالمخزون؟",
    groups: ["inventory"],
    tool: AI_TOOL.GET_LOW_STOCK_ITEMS,
    tier: null,
  },
  {
    question: "اشترينا ٢٠ علبة قفازات",
    groups: ["inventory"],
    tool: AI_TOOL.RECORD_STOCK_MOVEMENT,
    tier: "confirm",
  },
  { question: "سمير دفع ٥٠", groups: ["billing"], tool: AI_TOOL.RECORD_PAYMENT, tier: "confirm" },
];
