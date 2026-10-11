/**
 * تحويلات آمنة لجواب الخادم. الخادم يرسل الأرقام أحياناً نصوصاً والحقول
 * الغائبة `null`، فنقرأ كل حقل بقيمة افتراضية واضحة بدل أن يتعطل العرض.
 */

export type UnknownRecord = Record<string, unknown>;

export const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

export const asArray = <T = UnknownRecord>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** للنِّسب والقيم التي قد تغيب فعلاً: الغياب يبقى `null` لا صفراً. */
export const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toText = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value == null ? fallback : String(value);
