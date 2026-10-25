import type { TFunction } from "i18next";

/**
 * اسم الصلاحية كما يولّده الخادم، مقاطعه بالنقاط: `branches.categories.order.update`. المقطع الأول
 * هو القسم، والبقية تصف الإجراء.
 */
export const permissionSegments = (name: string): string[] => name.split(".").filter(Boolean);

/** القسم الذي تنتمي إليه الصلاحية، كـ`branches` في `branches.categories.order.update`. */
export const permissionGroupOf = (name: string): string => permissionSegments(name)[0] ?? "";

/**
 * تسمية الصلاحية بالعربية: مقاطع اسمها بعد القسم مترجمة، كـ«التصنيفات · ترتيب · تعديل». الاسم الذي
 * لا مقاطع له يُعرض بتسمية الخادم كما هي.
 */
export function permissionLabel(name: string, serverLabel: string, t: TFunction): string {
  const segments = permissionSegments(name);
  if (segments.length < 2) return serverLabel;
  return segments
    .slice(1)
    .map((segment) => t(`permissions.segments.${segment}`, { defaultValue: segment }))
    .join(" · ");
}
