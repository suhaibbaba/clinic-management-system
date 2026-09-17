import { GENDER, type Gender } from "@clinic/shared";

import type { Rng } from "@api/database/seed/random";

const AREAS: readonly string[] = [
  "نابلس، رفيديا",
  "نابلس، شارع فيصل",
  "نابلس، المخفية",
  "نابلس، جبل النار",
  "نابلس، البلدة القديمة",
  "بيت وزن",
  "حوارة",
  "عصيرة الشمالية",
  "بيتا",
  "سبسطية",
  "عورتا",
  "برقة",
];

const MALE_FIRST: readonly string[] = [
  "أحمد",
  "محمود",
  "يوسف",
  "خليل",
  "عمر",
  "إبراهيم",
  "مصعب",
  "زيد",
  "كرم",
  "عبد الرحمن",
  "باسل",
  "رامي",
  "وسام",
  "أنس",
  "معتز",
  "سامي",
  "نادر",
  "حمزة",
];

const FEMALE_FIRST: readonly string[] = [
  "ليان",
  "سلمى",
  "جنى",
  "تالا",
  "حلا",
  "رهف",
  "دانا",
  "مريم",
  "نور",
  "ريم",
  "شهد",
  "لين",
  "يارا",
  "إسراء",
  "هبة",
  "آية",
  "سجى",
  "رغد",
];

const MIDDLE: readonly string[] = [
  "أحمد",
  "محمد",
  "خالد",
  "سامي",
  "نبيل",
  "عادل",
  "فادي",
  "رياض",
  "زياد",
  "ماهر",
  "عصام",
  "جمال",
];

const FAMILIES: readonly string[] = [
  "طوقان",
  "النابلسي",
  "المصري",
  "كنعان",
  "عنبتاوي",
  "الشكعة",
  "حجاوي",
  "دويكات",
  "أبو صالح",
  "قبلاوي",
  "الأقرع",
  "عاصي",
  "حنبلي",
  "جرار",
  "صلاح",
  "عودة",
  "دراغمة",
  "البرغوثي",
  "الحاج",
  "أبو بكر",
];

const SPELLING_VARIANTS: readonly string[] = ["أحمد خالد النابلسي", "احمد خالد النابلسي"];
const SPELLING_VARIANTS_FEMALE: readonly string[] = ["فاطمة سامي طوقان", "فاطمه سامي طوقان"];

// Three names that a table column cannot hold, because the truncation has to be looked at.
const LONG_NAMES: readonly string[] = [
  "عبد الرحمن بن محمد بن عبد الله الشيخ البرغوثي المقدسي",
  "محمد نور الدين عبد الفتاح أبو صالح الدويكات",
  "فاطمة الزهراء عبد المعطي الحاج قاسم النابلسي",
];

export interface SeedPerson {
  readonly fullName: string;
  readonly gender: Gender;
  readonly dateOfBirth: string;
  readonly phone: string;
  readonly address: string | null;
  /** A file reception started and never finished — the list flags it. */
  readonly incomplete: boolean;
}

export function buildPeople(rng: Rng, count: number, today: Date): SeedPerson[] {
  const people: SeedPerson[] = [];
  const takenNames = new Set<string>();

  const addName = (name: string): string => {
    let candidate = name;
    let attempt = 0;

    while (takenNames.has(candidate) && attempt < FAMILIES.length) {
      candidate = `${name.split(" ").slice(0, -1).join(" ")} ${FAMILIES[attempt] as string}`;
      attempt += 1;
    }

    takenNames.add(candidate);
    return candidate;
  };

  const fixed = [
    ...SPELLING_VARIANTS.map((name) => ({ name, gender: GENDER.MALE })),
    ...SPELLING_VARIANTS_FEMALE.map((name) => ({ name, gender: GENDER.FEMALE })),
    ...LONG_NAMES.map((name, index) => ({
      name,
      gender: index === 2 ? GENDER.FEMALE : GENDER.MALE,
    })),
  ];

  for (let index = 0; index < count; index += 1) {
    const preset = fixed[index];
    const gender = preset?.gender ?? (rng.bool(0.5) ? GENDER.MALE : GENDER.FEMALE);
    const first = rng.pick(gender === GENDER.MALE ? MALE_FIRST : FEMALE_FIRST);
    const fullName = preset
      ? addName(preset.name)
      : addName(`${first} ${rng.pick(MIDDLE)} ${rng.pick(FAMILIES)}`);

    const age = rng.bool(0.2) ? rng.int(5, 15) : rng.int(16, 78);
    const incomplete = index >= count - 4;

    people.push({
      fullName,
      gender,
      dateOfBirth: birthDate(rng, today, age),
      phone: palestinianMobile(rng, index),
      address: incomplete ? null : rng.pick(AREAS),
      incomplete,
    });
  }

  return people;
}

/** `+9705x…`, which is what every mobile in the West Bank starts with. */
function palestinianMobile(rng: Rng, index: number): string {
  const prefix = rng.pick(["59", "56", "52"]);
  const serial = String(100_000 + index * 7 + rng.int(0, 6)).slice(-6);

  return `+9705${prefix.slice(1)}${serial}`;
}

function birthDate(rng: Rng, today: Date, age: number): string {
  const year = today.getUTCFullYear() - age;
  const month = rng.int(1, 12);
  const day = rng.int(1, 28);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
