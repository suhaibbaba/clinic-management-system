/**
 * Arabic wording for the printed documents.
 *
 * A receipt is rendered on the server, so its labels cannot come from the web
 * app's i18n files. They are collected here for the same reason those files
 * exist: one place to read the wording, and no Arabic scattered through the
 * services that decide what a document says.
 */
export const DOCUMENT_STRINGS = {
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
  methods: {
    cash: 'نقداً',
    card: 'بطاقة',
    transfer: 'حوالة',
  },
} as const;
