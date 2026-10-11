import { toNullableNumber } from "@/lib/coerce";

/**
 * رسوم التوصيل كما يحسبها الخادم: الأساس، ثم سعر الكيلومتر مضروباً في المسافة مُقرَّبةً
 * للأعلى (السائق يقطع الكيلومتر الذي بدأه). سعر الكيلومتر الفارغ أو الصفر يعني رسماً ثابتاً.
 */
export function estimateDeliveryFee(base: number, pricePerKm: number | null, distanceKm: number | null): number {
  if (pricePerKm === null || pricePerKm <= 0 || distanceKm === null || distanceKm < 0) return base;
  return base + Math.ceil(distanceKm) * pricePerKm;
}

/** الفرع يسعّر حسب المسافة فقط حين يكون لسعر الكيلومتر قيمة أكبر من صفر. */
export const chargesByDistance = (pricePerKm: number | null) => pricePerKm !== null && pricePerKm > 0;

export const numberOrNull = (value: unknown) => toNullableNumber(value);
