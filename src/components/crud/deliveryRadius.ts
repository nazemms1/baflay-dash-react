/**
 * نطاق التوصيل بالكيلومتر. الخادم يقبل أي رقم من 0 إلى 20 بمنزلتين عشريتين كحد أقصى، مثل `0.3`
 * أو `1.25`. لا يستورد هذا الملف شيئاً من المشروع، ليعمل في اختبارات Node مباشرة.
 */
export const RADIUS_MIN = 0.1;
export const RADIUS_MAX = 20;
/** خطوة المنزلق، وللرقم المكتوب منزلتان عشريتان. */
export const RADIUS_STEP = 0.1;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** ما يُسمح بكتابته في خانة النطاق: رقمان صحيحان على الأكثر، وبعدهما فاصلة ومنزلتان. الفارغ مسموح. */
const DRAFT = /^\d{0,2}(?:[.,]\d{0,2})?$/;

export const isRadiusDraft = (text: string): boolean => DRAFT.test(text);

/**
 * قيمة ما كتبه المشغّل: `null` للفارغ أو غير الرقم، وما عداه مقصوص إلى 0–20 ومقرّب إلى منزلتين.
 * الفاصلة العربية أو الأوروبية تُقبل كفاصلة عشرية.
 */
export function parseRadius(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "" || normalized === ".") return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return round2(Math.min(RADIUS_MAX, Math.max(0, value)));
}

/** قيمة المنزلق إلى رقم من منزلتين، لتفادي ذيول الفاصلة العائمة مثل 0.30000000000000004. */
export const radiusFromSlider = (raw: number): number => round2(Math.min(RADIUS_MAX, Math.max(0, raw)));
