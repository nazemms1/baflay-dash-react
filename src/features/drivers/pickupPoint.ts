/**
 * نقطة استلام السائق من الفرع. لكل فرع نقطتان: `location_x/y` موقعه الظاهر في الموقع، و`delivery_location_x/y`
 * نقطة استلام سائقي التوصيل إن اختلفت عنه (باب خلفي مثلاً). الطلب يحمل الفرع في `branch`.
 * لا يستورد هذا الملف شيئاً من المشروع، ليعمل في اختبارات Node مباشرة.
 */
export interface MapPoint {
  lat: number;
  lng: number;
}

const coordinate = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** النقطة من إحداثيين، أو `null` إن غاب أحدهما: نصف النقطة لا يصلح للملاحة. */
const pointOf = (lat: unknown, lng: unknown): MapPoint | null => {
  const latitude = coordinate(lat);
  const longitude = coordinate(lng);
  return latitude === null || longitude === null ? null : { lat: latitude, lng: longitude };
};

/** نقطة الاستلام الخاصة إن وُجدت، وإلا موقع الفرع، وإلا `null` حين لا موقع للفرع. */
export function branchPickupPoint(order: Record<string, unknown>): MapPoint | null {
  const branch = order.branch;
  if (!branch || typeof branch !== "object" || Array.isArray(branch)) return null;
  const record = branch as Record<string, unknown>;
  return pointOf(record.delivery_location_x, record.delivery_location_y) ?? pointOf(record.location_x, record.location_y);
}

/** رابط اتجاهات الخرائط إلى النقطة. */
export const directionsUrl = (point: MapPoint): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
