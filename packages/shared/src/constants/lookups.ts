/**
 * The lists a clinic may edit, and what they start out holding.
 *
 * Every user-facing choice list in this system is data (CLAUDE.md): a clinic
 * adds "veneer" to the tooth chart or "شيك" to the payment methods without a
 * deploy, and the list it edits is the same list every dropdown reads.
 *
 * What is **not** here is deliberate. A status that drives a state machine —
 * an appointment's, a lab order's, a stock movement's direction — stays a code
 * enum, because the transition table, the permissions and the arithmetic are
 * written against those exact values. Making them editable would let a clinic
 * add a status nothing knows how to move out of.
 *
 * This file is the seed *and* the migration's mapping table: the rows below
 * are written for every clinic with `isSystem: true`, keyed by the same codes
 * the enum columns already hold, so widening those columns to text loses
 * nothing and the data keeps meaning what it meant.
 */

/** Every editable list, by the key rows are grouped under. */
export const LOOKUP_LIST = {
  /** What the tooth chart paints, and what a finished procedure leaves behind. */
  TOOTH_STATE: 'tooth_state',
  /** The kinds of work a lab does. Prices stay per lab; the names are shared. */
  LAB_WORK_TYPE: 'lab_work_type',
  LAB_MATERIAL: 'lab_material',
  LAB_SHADE: 'lab_shade',
  ATTACHMENT_TYPE: 'attachment_type',
  APPOINTMENT_TYPE: 'appointment_type',
  ITEM_CATEGORY: 'item_category',
  ITEM_UNIT: 'item_unit',
  PAYMENT_METHOD: 'payment_method',
  /** The drugs a clinic prescribes most, offered before the free-text field. */
  FREQUENT_DRUG: 'frequent_drug',
} as const;

export type LookupListKey = (typeof LOOKUP_LIST)[keyof typeof LOOKUP_LIST];

export const LOOKUP_LIST_KEYS = [
  LOOKUP_LIST.TOOTH_STATE,
  LOOKUP_LIST.LAB_WORK_TYPE,
  LOOKUP_LIST.LAB_MATERIAL,
  LOOKUP_LIST.LAB_SHADE,
  LOOKUP_LIST.ATTACHMENT_TYPE,
  LOOKUP_LIST.APPOINTMENT_TYPE,
  LOOKUP_LIST.ITEM_CATEGORY,
  LOOKUP_LIST.ITEM_UNIT,
  LOOKUP_LIST.PAYMENT_METHOD,
  LOOKUP_LIST.FREQUENT_DRUG,
] as const;

/**
 * Lists whose rows carry a colour.
 *
 * Only the tooth chart paints with one. Offering a colour picker on the
 * payment methods would be a control that changes nothing, which is worse than
 * no control.
 */
export const COLOURED_LOOKUP_LISTS: readonly LookupListKey[] = [LOOKUP_LIST.TOOTH_STATE];

/**
 * Which half of the tooth a state describes, and whether the chart draws it
 * specially.
 *
 * A custom state has neither: it paints the whole tooth in its own colour,
 * which is the honest default — the chart cannot know that somebody's new
 * "veneer" belongs on the crown, and guessing would put it in the wrong place.
 */
export type ToothArea = 'crown' | 'root' | 'whole';

export interface ToothChartBehaviour {
  readonly area: ToothArea;
  /** Drawing the shape itself changes: an outline, a post, a retainer bar. */
  readonly shape?: 'missing' | 'implant' | 'bridge';
  /**
   * A state a tooth can be *in* but no procedure produces: healthy, planned,
   * under way. They belong on the chart's legend and nowhere near the
   * catalogue's "what does this leave behind" field, so the chart and the
   * procedure outcomes are one editable list without a filling being an
   * acceptable answer to "is this tooth healthy".
   *
   * Only the built-in rows carry it. Anything a clinic adds is something they
   * do to a tooth, so it is offered as an outcome.
   */
  readonly stateOnly?: boolean;
}

export interface SystemLookupRow {
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly color?: string;
  readonly meta?: Record<string, unknown>;
}

/**
 * The rows every clinic starts with — today's enum values, verbatim.
 *
 * The codes are load-bearing: they are what the columns already contain, what
 * the chart's built-in styling is keyed by, and what the seeded data refers
 * to. Names and colours are editable; codes are not.
 */
export const SYSTEM_LOOKUPS: Readonly<Record<LookupListKey, readonly SystemLookupRow[]>> = {
  [LOOKUP_LIST.TOOTH_STATE]: [
    {
      code: 'healthy',
      nameAr: 'سليم',
      nameEn: 'Healthy',
      meta: { chartBehavior: { area: 'whole', stateOnly: true } },
    },
    {
      code: 'planned',
      nameAr: 'نخر / مخطّط',
      nameEn: 'Planned',
      meta: { chartBehavior: { area: 'whole', stateOnly: true } },
    },
    {
      code: 'in_progress',
      nameAr: 'قيد المعالجة',
      nameEn: 'In progress',
      meta: { chartBehavior: { area: 'whole', stateOnly: true } },
    },
    {
      code: 'filling',
      nameAr: 'حشوة',
      nameEn: 'Filling',
      meta: { chartBehavior: { area: 'crown' } },
    },
    {
      code: 'root_canal',
      nameAr: 'معالجة لبية',
      nameEn: 'Root canal',
      meta: { chartBehavior: { area: 'root' } },
    },
    { code: 'crown', nameAr: 'تاج', nameEn: 'Crown', meta: { chartBehavior: { area: 'crown' } } },
    {
      code: 'implant',
      nameAr: 'زرعة',
      nameEn: 'Implant',
      meta: { chartBehavior: { area: 'root', shape: 'implant' } },
    },
    {
      code: 'bridge',
      nameAr: 'جسر',
      nameEn: 'Bridge',
      meta: { chartBehavior: { area: 'crown', shape: 'bridge' } },
    },
    {
      code: 'missing',
      nameAr: 'مفقود',
      nameEn: 'Missing',
      meta: { chartBehavior: { area: 'whole', shape: 'missing' } },
    },
  ],

  [LOOKUP_LIST.LAB_WORK_TYPE]: [
    { code: 'zirconia_crown', nameAr: 'تاج زيركون', nameEn: 'Zirconia crown' },
    { code: 'pfm_crown', nameAr: 'تاج خزف على معدن', nameEn: 'Porcelain-fused-to-metal crown' },
    { code: 'bridge_3_unit', nameAr: 'جسر ثلاثي', nameEn: 'Three-unit bridge' },
    { code: 'full_denture', nameAr: 'طقم كامل', nameEn: 'Full denture' },
    { code: 'partial_denture', nameAr: 'طقم جزئي', nameEn: 'Partial denture' },
    { code: 'veneer', nameAr: 'فينير', nameEn: 'Veneer' },
    { code: 'night_guard', nameAr: 'حارس ليلي', nameEn: 'Night guard' },
    {
      code: 'ortho_appliance',
      nameAr: 'جهاز تقويم متحرك',
      nameEn: 'Removable orthodontic appliance',
    },
  ],

  [LOOKUP_LIST.LAB_MATERIAL]: [
    { code: 'zirconia', nameAr: 'زيركون', nameEn: 'Zirconia' },
    { code: 'emax', nameAr: 'إي ماكس', nameEn: 'E.max' },
    { code: 'pfm', nameAr: 'خزف على معدن', nameEn: 'Porcelain-fused-to-metal' },
    { code: 'acrylic', nameAr: 'أكريل', nameEn: 'Acrylic' },
    { code: 'chrome_cobalt', nameAr: 'كروم كوبالت', nameEn: 'Chrome cobalt' },
  ],

  /**
   * VITA classical, which is what a Syrian clinic and its lab both say out
   * loud. A clinic on a different guide edits the list rather than the code.
   */
  [LOOKUP_LIST.LAB_SHADE]: [
    { code: 'A1', nameAr: 'A1', nameEn: 'A1' },
    { code: 'A2', nameAr: 'A2', nameEn: 'A2' },
    { code: 'A3', nameAr: 'A3', nameEn: 'A3' },
    { code: 'A3.5', nameAr: 'A3.5', nameEn: 'A3.5' },
    { code: 'B1', nameAr: 'B1', nameEn: 'B1' },
    { code: 'B2', nameAr: 'B2', nameEn: 'B2' },
    { code: 'C2', nameAr: 'C2', nameEn: 'C2' },
    { code: 'D3', nameAr: 'D3', nameEn: 'D3' },
  ],

  [LOOKUP_LIST.ATTACHMENT_TYPE]: [
    { code: 'xray_panoramic', nameAr: 'بانوراما', nameEn: 'Panoramic X-ray' },
    { code: 'xray_periapical', nameAr: 'ذروية', nameEn: 'Periapical X-ray' },
    { code: 'xray_bitewing', nameAr: 'عضّية', nameEn: 'Bitewing X-ray' },
    { code: 'cbct', nameAr: 'طبقي مخروطي', nameEn: 'CBCT' },
    { code: 'clinical_photo', nameAr: 'صورة سريرية', nameEn: 'Clinical photo' },
    { code: 'document', nameAr: 'مستند', nameEn: 'Document' },
  ],

  [LOOKUP_LIST.APPOINTMENT_TYPE]: [
    { code: 'checkup', nameAr: 'فحص', nameEn: 'Check-up' },
    { code: 'treatment', nameAr: 'معالجة', nameEn: 'Treatment' },
    { code: 'followup', nameAr: 'مراجعة', nameEn: 'Follow-up' },
    { code: 'emergency', nameAr: 'طارئ', nameEn: 'Emergency' },
  ],

  [LOOKUP_LIST.ITEM_CATEGORY]: [
    { code: 'medication', nameAr: 'أدوية', nameEn: 'Medication' },
    { code: 'consumable', nameAr: 'مستهلكات', nameEn: 'Consumable' },
    { code: 'tool', nameAr: 'أدوات', nameEn: 'Tool' },
    { code: 'sterilization', nameAr: 'تعقيم', nameEn: 'Sterilisation' },
  ],

  [LOOKUP_LIST.ITEM_UNIT]: [
    { code: 'piece', nameAr: 'قطعة', nameEn: 'piece' },
    { code: 'box', nameAr: 'علبة', nameEn: 'box' },
    { code: 'pack', nameAr: 'رزمة', nameEn: 'pack' },
    { code: 'ml', nameAr: 'مل', nameEn: 'ml' },
    { code: 'g', nameAr: 'غ', nameEn: 'g' },
    { code: 'ampoule', nameAr: 'أمبولة', nameEn: 'ampoule' },
  ],

  [LOOKUP_LIST.PAYMENT_METHOD]: [
    { code: 'cash', nameAr: 'نقداً', nameEn: 'Cash' },
    { code: 'card', nameAr: 'بطاقة', nameEn: 'Card' },
    { code: 'transfer', nameAr: 'حوالة', nameEn: 'Transfer' },
  ],

  /**
   * A starting point rather than a formulary: the six a dental clinic reaches
   * for, offered above the free-text field so the common case is two taps.
   */
  [LOOKUP_LIST.FREQUENT_DRUG]: [
    { code: 'amoxicillin_500', nameAr: 'أموكسيسيلين 500 ملغ', nameEn: 'Amoxicillin 500 mg' },
    {
      code: 'amoxiclav_1g',
      nameAr: 'أموكسيسيلين/كلافولانيك 1 غ',
      nameEn: 'Amoxicillin/clavulanate 1 g',
    },
    { code: 'metronidazole_500', nameAr: 'ميترونيدازول 500 ملغ', nameEn: 'Metronidazole 500 mg' },
    { code: 'ibuprofen_400', nameAr: 'إيبوبروفين 400 ملغ', nameEn: 'Ibuprofen 400 mg' },
    { code: 'paracetamol_500', nameAr: 'باراسيتامول 500 ملغ', nameEn: 'Paracetamol 500 mg' },
    { code: 'chlorhexidine_rinse', nameAr: 'غسول كلورهيكسيدين', nameEn: 'Chlorhexidine rinse' },
  ],
};

/**
 * The chart behaviour of a system tooth state, or `undefined` for one a clinic
 * added — which is what tells the chart to fall back to painting the whole
 * tooth in the row's own colour.
 */
export function systemChartBehaviour(code: string): ToothChartBehaviour | undefined {
  const row = SYSTEM_LOOKUPS[LOOKUP_LIST.TOOTH_STATE].find((entry) => entry.code === code);
  const behaviour = row?.meta?.['chartBehavior'];

  return behaviour as ToothChartBehaviour | undefined;
}
