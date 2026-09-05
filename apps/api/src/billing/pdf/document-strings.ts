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
  methods: {
    cash: 'نقداً',
    card: 'بطاقة',
    transfer: 'حوالة',
  },
} as const;
