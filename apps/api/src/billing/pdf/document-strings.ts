// Rendered on the server, so labels cannot come from the web app's i18n — and the language is the
// clinic's setting, not the printer's.
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
  // First name only: the sheet travels to an outside business in a box, and a full name on it is a
  // medical record leaving the clinic for no clinical benefit.
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

// Typed as `typeof AR` so the compiler refuses a document string that exists in one language and
// not the other.
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

export type DocumentLanguage = 'ar' | 'en';

export type DocumentStrings = typeof AR;

export const documentStrings = (language: DocumentLanguage): DocumentStrings =>
  language === 'en' ? EN : AR;

export const documentDirection = (language: DocumentLanguage): 'rtl' | 'ltr' =>
  language === 'en' ? 'ltr' : 'rtl';
