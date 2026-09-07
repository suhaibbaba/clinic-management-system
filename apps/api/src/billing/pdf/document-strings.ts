/**
 * Wording for the printed documents, in both languages.
 *
 * A receipt is rendered on the server, so its labels cannot come from the web
 * app's i18n files — but it follows the same rule those files exist for: no
 * language scattered through the services that decide what a document says,
 * and nothing on a printed page that only exists in one language.
 *
 * Which one a clinic gets is its own setting (`settings.documents.language`),
 * not the language of whoever pressed print: a receipt is a document of the
 * clinic, and a practice that files everything in Arabic should not end up
 * with an English one because a locum had the interface switched over.
 *
 * The three code-keyed maps that used to live here — payment methods, item
 * categories, units — are gone. Those are editable lists now, so a document
 * reads them from `lookup_options` and prints what this clinic calls them.
 */
const AR = {
  receipt: {
    title: 'إيصال قبض',
    number: 'رقم الإيصال',
    date: 'التاريخ',
    patient: 'المريض',
    fileNumber: 'رقم الملف',
    amount: 'المبلغ',
    method: 'طريقة الدفع',
    note: 'ملاحظات',
    balanceAfter: 'الرصيد بعد الدفع',
    reversalTitle: 'إيصال إلغاء',
    reversalOf: 'إلغاء للإيصال رقم',
    signature: 'التوقيع',
  },
  statement: {
    title: 'كشف حساب',
    patient: 'المريض',
    fileNumber: 'رقم الملف',
    period: 'الفترة',
    periodUntil: 'الفترة حتى',
    openingBalance: 'رصيد أول المدة',
    closingBalance: 'الرصيد المستحق',
    printedAt: 'تاريخ الطباعة',
    columns: {
      date: 'التاريخ',
      description: 'البيان',
      charge: 'مدين',
      payment: 'دائن',
      balance: 'الرصيد',
    },
    reversal: 'قيد عكسي',
    empty: 'لا توجد حركات في هذه الفترة',
  },
  /**
   * The sheet that goes to the lab with the work.
   *
   * It names the patient by **first name only**. The lab is an outside
   * business, the sheet travels in a box with a plaster model, and a full name
   * on it is a medical record leaving the clinic for no clinical benefit — the
   * technician needs to know which box is which, not who the person is.
   */
  labOrder: {
    title: 'طلب عمل مخبري',
    number: 'رقم الطلب',
    lab: 'المخبر',
    date: 'التاريخ',
    patient: 'المريض',
    doctor: 'الطبيب',
    workType: 'نوع العمل',
    teeth: 'الأسنان',
    material: 'المادة',
    shade: 'اللون',
    expected: 'التسليم المتوقع',
    instructions: 'تعليمات',
    signature: 'توقيع المستلم',
  },
  labStatement: {
    title: 'كشف حساب مخبر',
    lab: 'المخبر',
    period: 'الفترة',
    periodUntil: 'الفترة حتى',
    openingBalance: 'رصيد أول المدة',
    closingBalance: 'الرصيد المستحق للمخبر',
    printedAt: 'تاريخ الطباعة',
    columns: {
      date: 'التاريخ',
      description: 'البيان',
      order: 'مستحق',
      payment: 'مدفوع',
      balance: 'الرصيد',
    },
    reversal: 'قيد عكسي',
    empty: 'لا توجد حركات في هذه الفترة',
  },
  shoppingList: {
    title: 'قائمة المشتريات',
    printedAt: 'تاريخ الطباعة',
    note: 'الكميات المقترحة تكفي لبلوغ ضعف الحد الأدنى — للاسترشاد لا للإلزام.',
    columns: {
      item: 'المادة',
      unit: 'الوحدة',
      current: 'المتوفر',
      minimum: 'الحد الأدنى',
      suggested: 'الكمية المقترحة',
      supplier: 'المورّد',
    },
    empty: 'لا توجد مواد تحت الحد الأدنى',
    signature: 'توقيع المسؤول',
  },
};

/**
 * The same shape in English, key for key.
 *
 * Typed as `typeof AR` so the compiler refuses a document string that exists
 * in one language and not the other — the printed equivalent of the i18n
 * guard that fails CI on a missing key.
 */
const EN: typeof AR = {
  receipt: {
    title: 'Payment receipt',
    number: 'Receipt no.',
    date: 'Date',
    patient: 'Patient',
    fileNumber: 'File no.',
    amount: 'Amount',
    method: 'Method',
    note: 'Notes',
    balanceAfter: 'Balance after payment',
    reversalTitle: 'Reversal receipt',
    reversalOf: 'Reverses receipt no.',
    signature: 'Signature',
  },
  statement: {
    title: 'Account statement',
    patient: 'Patient',
    fileNumber: 'File no.',
    period: 'Period',
    periodUntil: 'Period to',
    openingBalance: 'Opening balance',
    closingBalance: 'Balance due',
    printedAt: 'Printed',
    columns: {
      date: 'Date',
      description: 'Description',
      charge: 'Charge',
      payment: 'Payment',
      balance: 'Balance',
    },
    reversal: 'Reversal',
    empty: 'No entries in this period',
  },
  labOrder: {
    title: 'Laboratory work order',
    number: 'Order no.',
    lab: 'Laboratory',
    date: 'Date',
    patient: 'Patient',
    doctor: 'Doctor',
    workType: 'Work',
    teeth: 'Teeth',
    material: 'Material',
    shade: 'Shade',
    expected: 'Expected',
    instructions: 'Instructions',
    signature: 'Received by',
  },
  labStatement: {
    title: 'Laboratory statement',
    lab: 'Laboratory',
    period: 'Period',
    periodUntil: 'Period to',
    openingBalance: 'Opening balance',
    closingBalance: 'Balance due to the laboratory',
    printedAt: 'Printed',
    columns: {
      date: 'Date',
      description: 'Description',
      order: 'Owed',
      payment: 'Paid',
      balance: 'Balance',
    },
    reversal: 'Reversal',
    empty: 'No entries in this period',
  },
  shoppingList: {
    title: 'Shopping list',
    printedAt: 'Printed',
    note: 'Suggested quantities reach twice the minimum — a guide, not an order.',
    columns: {
      item: 'Item',
      unit: 'Unit',
      current: 'In stock',
      minimum: 'Minimum',
      suggested: 'Suggested',
      supplier: 'Supplier',
    },
    empty: 'Nothing below its minimum',
    signature: 'Signature',
  },
};

/** Which language a clinic's documents are printed in. */
export type DocumentLanguage = 'ar' | 'en';

export type DocumentStrings = typeof AR;

export const documentStrings = (language: DocumentLanguage): DocumentStrings =>
  language === 'en' ? EN : AR;

/** The page direction that goes with a document language. */
export const documentDirection = (language: DocumentLanguage): 'rtl' | 'ltr' =>
  language === 'en' ? 'ltr' : 'rtl';
