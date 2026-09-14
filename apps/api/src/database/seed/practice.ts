import { ITEM_CATEGORY, ITEM_UNIT } from '@clinic/shared';

export interface LabSeed {
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly contactPerson: string;
  readonly workTypes: readonly { readonly nameAr: string; readonly defaultPrice: string }[];
}

export const LABS: readonly LabSeed[] = [
  {
    name: 'مخبر الدقة للتركيبات',
    phone: '+97092380011',
    address: 'نابلس، شارع سفيان',
    contactPerson: 'أبو أحمد',
    workTypes: [
      { nameAr: 'تاج زيركون', defaultPrice: '320.00' },
      { nameAr: 'تاج خزف على معدن', defaultPrice: '180.00' },
      { nameAr: 'جسر ثلاثي', defaultPrice: '760.00' },
      { nameAr: 'فينير', defaultPrice: '400.00' },
    ],
  },
  {
    name: 'مخبر النخبة',
    phone: '+97092380022',
    address: 'نابلس، رفيديا',
    contactPerson: 'م. سامر',
    workTypes: [
      { nameAr: 'طقم كامل', defaultPrice: '900.00' },
      { nameAr: 'طقم جزئي', defaultPrice: '600.00' },
      { nameAr: 'حارس ليلي', defaultPrice: '250.00' },
    ],
  },
  {
    name: 'مخبر فلسطين للتركيبات',
    phone: '+97092380033',
    address: 'نابلس، المخفية',
    contactPerson: 'أ. هيثم',
    workTypes: [
      { nameAr: 'تاج زيركون', defaultPrice: '300.00' },
      { nameAr: 'جهاز تقويم متحرك', defaultPrice: '450.00' },
      { nameAr: 'جسر ثلاثي', defaultPrice: '720.00' },
    ],
  },
];

export const LAB_MATERIALS: readonly string[] = ['zirconia', 'emax', 'pfm', 'acrylic'];
export const LAB_SHADES: readonly string[] = ['A1', 'A2', 'A3', 'A3.5', 'B1', 'B2'];

export const LAB_INSTRUCTIONS: readonly string[] = [
  'مراعاة خط الابتسامة',
  'تخفيف نقاط التماس',
  'اللون حسب العينة المرفقة',
  'تسليم مستعجل',
  'إعادة تلميح الحواف',
];

export interface SupplierSeed {
  readonly name: string;
  readonly phone: string;
  readonly contactPerson: string;
}

export const SUPPLIERS: readonly SupplierSeed[] = [
  { name: 'مستودع القدس لمواد الأسنان', phone: '+97092390011', contactPerson: 'أ. وائل' },
  { name: 'شركة بيرزيت للأدوية', phone: '+97092390022', contactPerson: 'أ. لؤي' },
];

export interface ItemSeed {
  readonly nameAr: string;
  readonly category: string;
  readonly unit: string;
  readonly minQuantity: string;
  readonly unitPrice: string;
  /** Batches carry an expiry; a handpiece does not. */
  readonly perishable: boolean;
  readonly supplier: number;
}

export const ITEMS: readonly ItemSeed[] = [
  {
    nameAr: 'قفازات فحص لاتكس — قياس M',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '10',
    unitPrice: '22.00',
    perishable: false,
    supplier: 0,
  },
  {
    nameAr: 'كمامات جراحية ثلاثية',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '8',
    unitPrice: '18.00',
    perishable: false,
    supplier: 0,
  },
  {
    nameAr: 'مخدر موضعي ليدوكائين 2%',
    category: ITEM_CATEGORY.MEDICATION,
    unit: ITEM_UNIT.AMPOULE,
    minQuantity: '30',
    unitPrice: '4.50',
    perishable: true,
    supplier: 1,
  },
  {
    nameAr: 'مخدر أرتيكائين 4%',
    category: ITEM_CATEGORY.MEDICATION,
    unit: ITEM_UNIT.AMPOULE,
    minQuantity: '20',
    unitPrice: '6.00',
    perishable: true,
    supplier: 1,
  },
  {
    nameAr: 'حشوة كومبوزيت A2',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.PIECE,
    minQuantity: '15',
    unitPrice: '55.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'حشوة كومبوزيت A3',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.PIECE,
    minQuantity: '15',
    unitPrice: '55.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'أسيد إتش 37%',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.ML,
    minQuantity: '20',
    unitPrice: '30.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'مادة لاصقة (بوندنغ)',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.ML,
    minQuantity: '10',
    unitPrice: '90.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'مبارد لبية K-File',
    category: ITEM_CATEGORY.TOOL,
    unit: ITEM_UNIT.PACK,
    minQuantity: '5',
    unitPrice: '45.00',
    perishable: false,
    supplier: 0,
  },
  {
    nameAr: 'كون غوتا بيركا',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '4',
    unitPrice: '38.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'هيبوكلوريت الصوديوم 5%',
    category: ITEM_CATEGORY.MEDICATION,
    unit: ITEM_UNIT.ML,
    minQuantity: '200',
    unitPrice: '0.30',
    perishable: true,
    supplier: 1,
  },
  {
    nameAr: 'أكياس تعقيم ذاتية اللصق',
    category: ITEM_CATEGORY.STERILIZATION,
    unit: ITEM_UNIT.BOX,
    minQuantity: '5',
    unitPrice: '40.00',
    perishable: false,
    supplier: 0,
  },
  {
    nameAr: 'شرائط اختبار الأوتوكلاف',
    category: ITEM_CATEGORY.STERILIZATION,
    unit: ITEM_UNIT.PACK,
    minQuantity: '3',
    unitPrice: '55.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'إبر تخدير 27G',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '6',
    unitPrice: '35.00',
    perishable: false,
    supplier: 1,
  },
  {
    nameAr: 'شفاطات لعاب',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.PACK,
    minQuantity: '10',
    unitPrice: '12.00',
    perishable: false,
    supplier: 0,
  },
  {
    nameAr: 'قوالب طبعة سيليكون',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.PACK,
    minQuantity: '4',
    unitPrice: '160.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'جبس أسنان من النوع الرابع',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.G,
    minQuantity: '2000',
    unitPrice: '0.02',
    perishable: false,
    supplier: 0,
  },
  {
    nameAr: 'فرايز ألماسية',
    category: ITEM_CATEGORY.TOOL,
    unit: ITEM_UNIT.PACK,
    minQuantity: '6',
    unitPrice: '48.00',
    perishable: false,
    supplier: 0,
  },
  {
    nameAr: 'خيط تراجع لثوي',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.PIECE,
    minQuantity: '3',
    unitPrice: '75.00',
    perishable: true,
    supplier: 0,
  },
  {
    nameAr: 'محلول كلورهيكسيدين للمضمضة',
    category: ITEM_CATEGORY.MEDICATION,
    unit: ITEM_UNIT.ML,
    minQuantity: '500',
    unitPrice: '0.10',
    perishable: true,
    supplier: 1,
  },
];

export const ADJUST_REASONS: readonly string[] = [
  'جرد شهري',
  'كسر أثناء الاستخدام',
  'إتلاف عبوة منتهية',
];

export const WAITING_REASONS: readonly string[] = [
  'ألم شديد ويريد أقرب موعد',
  'يريد موعداً مسائياً',
  'تورم وارتفاع حرارة',
];
