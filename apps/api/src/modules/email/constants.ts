export const LOGO_CONTENT_ID = "clinic-logo";

export const COPY = {
  activate: {
    subject: (clinic: string) => `تفعيل حسابك في ${clinic}`,
    heading: "تفعيل الحساب",
    body: (who: string, clinic: string, hours: number) => [
      `مرحباً ${who},`,
      `تم إنشاء حساب لك في ${clinic}. اختر كلمة المرور الخاصة بك لتتمكن من الدخول.`,
      `الرابط صالح لمدة ${hours} ساعة.`,
    ],
    action: "تفعيل الحساب",
    footer: "إذا لم تكن تتوقع هذه الرسالة، تجاهلها ولن يتم إنشاء أي كلمة مرور.",
  },
  reset: {
    subject: (clinic: string) => `إعادة تعيين كلمة المرور — ${clinic}`,
    heading: "إعادة تعيين كلمة المرور",
    body: (who: string, clinic: string, hours: number) => [
      `مرحباً ${who},`,
      `وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في ${clinic}.`,
      `الرابط صالح لمدة ${hours} ساعة.`,
    ],
    action: "تعيين كلمة مرور جديدة",
    footer: "إذا لم تطلب ذلك، تجاهل هذه الرسالة — كلمة المرور الحالية تبقى كما هي.",
  },
} as const;

export const LOGIN_CODE_COPY = {
  subject: (clinic: string) => `رمز الدخول إلى ${clinic}`,
  heading: "رمز الدخول",
  body: (who: string, clinic: string, minutes: number) => [
    `مرحباً ${who},`,
    `استخدم هذا الرمز للدخول إلى حسابك في ${clinic}.`,
    `الرمز صالح لمدة ${minutes} دقائق ولمرة واحدة فقط.`,
  ],
  footer: "إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة — لا أحد يستطيع الدخول دونه.",
} as const;

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");
