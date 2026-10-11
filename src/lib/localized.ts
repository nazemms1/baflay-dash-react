import type { Language } from "@/i18n";
import { toText } from "@/lib/coerce";

/** النموذج داخل الواجهة: `nameAr` بصيغة camelCase. */
export interface Bilingual {
  name?: string | null;
  nameAr?: string | null;
}

/** السجل الخام كما يأتي من الخادم: `name_ar` بالشرطة السفلية، والقيم غير مُتحقَّق منها. */
export interface RawBilingual {
  name?: unknown;
  name_ar?: unknown;
}

function pickName(english: string, arabic: string, language: Language): string {
  return language === "ar" ? arabic || english : english || arabic;
}

/**
 * الاسم باللغة المعروضة لنموذج داخلي. يرجع للأخرى إن كانت الأولى فارغة حتى لا
 * تظهر شاشة بلا اسم.
 */
export function localizedName(entry: Bilingual | null | undefined, language: Language): string {
  if (!entry) return "";
  return pickName(entry.name || "", entry.nameAr || "", language);
}

/**
 * الاسم باللغة المعروضة لسجل خام من الخادم. الخادم يرسل `name_ar`، لذا لا يجوز
 * تمرير السجل الخام إلى `localizedName` مباشرة.
 */
export function localizedRecord(record: RawBilingual | null | undefined, language: Language): string {
  if (!record) return "";
  return pickName(toText(record.name), toText(record.name_ar), language);
}
