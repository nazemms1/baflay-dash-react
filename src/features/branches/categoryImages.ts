import type { BranchCategoryImage } from "@/services";

/** مصدر الصورة المعروضة للتصنيف في فرع: صورة الفرع الخاصة، أو الصورة العامة، أو لا صورة. */
export type CategoryImageSource = "branch" | "default" | "none";

/**
 * يحدد مصدر الصورة التي يراها الزبون. صورة الفرع تغلب العامة دائماً، فإن وُجدت صورة للفرع
 * كانت هي المعروضة، وإلا فالعامة إن وُجدت، وإلا فلا صورة.
 */
export function categoryImageSource(row: Pick<BranchCategoryImage, "image" | "branch_image">): CategoryImageSource {
  if (row.branch_image) return "branch";
  if (row.image) return "default";
  return "none";
}
