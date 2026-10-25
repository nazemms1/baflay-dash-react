import type { MarketContact, MarketContactType } from "@/services";

/** أنواع وسائل التواصل بالترتيب الذي يظهر في القائمة المنسدلة. */
export const CONTACT_TYPES: readonly MarketContactType[] = [
  "phone",
  "whatsapp",
  "email",
  "address",
  "working_hours",
  "social",
];

/** الهاتف وواتساب يحملان رقماً دولياً يبدأ برمز الدولة. */
export const isPhoneType = (type: MarketContactType): boolean => type === "phone" || type === "whatsapp";

/** العنوان وساعات العمل لهما نسخة عربية في `value_ar`، والباقي لا نسخة له. */
export const hasArabicValue = (type: MarketContactType): boolean => type === "address" || type === "working_hours";

/** الترتيب كما يراه الزائر: حسب `sort_order`، والتعادل بالمعرّف. */
export const sortContacts = (contacts: MarketContact[]): MarketContact[] =>
  [...contacts].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

/** يطابق تنظيف الخادم: الفراغات والشحطات تُحذف، و`00` في بداية الرقم تصير `+`. */
export function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

export type PhoneProblem = "start" | "country" | "format";

/**
 * مشكلة الرقم كمفتاح، أو `null` إن كان صالحاً. رمز الدولة يُفحص إن عُرف لدولة السوق، لأن الخادم
 * يرفض الرقم المحلي أو رقم دولة أخرى. الخادم يبقى الحكم النهائي، وهذا يمنع الخطأ قبل الإرسال.
 */
export function phoneProblem(value: string, dialCode: string | null): PhoneProblem | null {
  const phone = normalizePhone(value);
  if (!phone.startsWith("+")) return "start";
  const dial = (dialCode ?? "").replace(/\D/g, "");
  if (dial && !phone.slice(1).startsWith(dial)) return "country";
  if (!/^\+\d{6,15}$/.test(phone)) return "format";
  return null;
}

/** الرابط الكامل المطلوب لوسيلة `social`: يبدأ بـ`https://`. */
export const isFullUrl = (value: string): boolean => /^https:\/\/\S+$/i.test(value.trim());

/** صيغة بريد بسيطة تمنع الخطأ الواضح قبل الإرسال. */
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
