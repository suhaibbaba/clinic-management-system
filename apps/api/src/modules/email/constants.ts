import type { LanguageCode } from "@clinic/shared";

export const LOGO_CONTENT_ID = "clinic-logo";

const ARABIC_COPY = {
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
  loginCode: {
    subject: (clinic: string) => `رمز الدخول إلى ${clinic}`,
    heading: "رمز الدخول",
    body: (who: string, clinic: string, minutes: number) => [
      `مرحباً ${who},`,
      `استخدم هذا الرمز للدخول إلى حسابك في ${clinic}.`,
      `الرمز صالح لمدة ${minutes} دقائق ولمرة واحدة فقط.`,
    ],
    footer: "إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة — لا أحد يستطيع الدخول دونه.",
  },
};

type AccountEmailCopy = typeof ARABIC_COPY;

const ENGLISH_COPY: AccountEmailCopy = {
  activate: {
    subject: (clinic: string) => `Activate your account at ${clinic}`,
    heading: "Activate your account",
    body: (who: string, clinic: string, hours: number) => [
      `Hello ${who},`,
      `An account has been created for you at ${clinic}. Choose your password to sign in.`,
      `The link is valid for ${hours} hours.`,
    ],
    action: "Activate account",
    footer: "If you were not expecting this email, ignore it and no password will be set.",
  },
  reset: {
    subject: (clinic: string) => `Reset your password — ${clinic}`,
    heading: "Reset your password",
    body: (who: string, clinic: string, hours: number) => [
      `Hello ${who},`,
      `We received a request to reset the password of your account at ${clinic}.`,
      `The link is valid for ${hours} hours.`,
    ],
    action: "Set a new password",
    footer:
      "If you did not ask for this, ignore this email — your current password stays as it is.",
  },
  loginCode: {
    subject: (clinic: string) => `Your sign-in code for ${clinic}`,
    heading: "Sign-in code",
    body: (who: string, clinic: string, minutes: number) => [
      `Hello ${who},`,
      `Use this code to sign in to your account at ${clinic}.`,
      `The code is valid for ${minutes} minutes and works once.`,
    ],
    footer: "If you did not ask for this code, ignore this email — nobody can sign in without it.",
  },
};

const TURKISH_COPY: AccountEmailCopy = {
  activate: {
    subject: (clinic: string) => `${clinic} hesabınızı etkinleştirin`,
    heading: "Hesabı etkinleştir",
    body: (who: string, clinic: string, hours: number) => [
      `Merhaba ${who},`,
      `${clinic} için sizin adınıza bir hesap oluşturuldu. Giriş yapmak için şifrenizi belirleyin.`,
      `Bağlantı ${hours} saat geçerlidir.`,
    ],
    action: "Hesabı etkinleştir",
    footer: "Bu e-postayı beklemiyorsanız dikkate almayın; hiçbir şifre belirlenmeyecektir.",
  },
  reset: {
    subject: (clinic: string) => `Şifre sıfırlama — ${clinic}`,
    heading: "Şifre sıfırlama",
    body: (who: string, clinic: string, hours: number) => [
      `Merhaba ${who},`,
      `${clinic} hesabınızın şifresini sıfırlama talebi aldık.`,
      `Bağlantı ${hours} saat geçerlidir.`,
    ],
    action: "Yeni şifre belirle",
    footer: "Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın; mevcut şifreniz aynı kalır.",
  },
  loginCode: {
    subject: (clinic: string) => `${clinic} giriş kodunuz`,
    heading: "Giriş kodu",
    body: (who: string, clinic: string, minutes: number) => [
      `Merhaba ${who},`,
      `${clinic} hesabınıza giriş yapmak için bu kodu kullanın.`,
      `Kod ${minutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir.`,
    ],
    footer:
      "Bu kodu siz istemediyseniz bu e-postayı dikkate almayın; kod olmadan kimse giriş yapamaz.",
  },
};

export const ACCOUNT_EMAIL_COPY: Readonly<Record<LanguageCode, AccountEmailCopy>> = {
  ar: ARABIC_COPY,
  en: ENGLISH_COPY,
  tr: TURKISH_COPY,
};

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");
