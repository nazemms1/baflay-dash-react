import type { ItemBranchDetails, ItemDetailsPatch } from "@/services";

/**
 * صورة الصنف ووصفه الخاصّان بفرع داخل قائمته. ما لا يغيّره الفرع يبقى العام. المنطق هنا (قراءة
 * `branch_details`، وما يُرسل عند الحفظ) خالٍ من الواجهة، ليختبره Node مباشرة.
 */

/** صلاحية تعيين صورة ووصف خاصّين بالفرع لصنف، بالاسم الذي يعرفه الخادم. */
export const ITEM_DETAILS_UPDATE_PERMISSION = "menus.items.details.update";

/** صلاحية إرجاع الصورة والوصف في الفرع إلى العامّين. */
export const ITEM_DETAILS_DESTROY_PERMISSION = "menus.items.details.destroy";

/** أقصى طول للوصف كما يقبله الخادم. */
export const ITEM_DESCRIPTION_MAX = 20000;

/** نسخة الصنف داخل القائمة كما تُعرض: الصورة التي يراها زبون الفرع، ومعها العامة والخاصة بالفرع. */
export interface ItemDetailsView {
  id: number;
  name: string;
  /** الصورة التي تظهر للزبون في هذا الفرع: الخاصة إن وُجدت، وإلا العامة. */
  image: string | null;
  /** الصورة العامة للصنف، و`null` إن لم تُرفع. */
  defaultImage: string | null;
  /** تفاصيل الفرع الخاصة، و`null` إن لم يغيّر الفرع شيئاً. */
  branch: ItemBranchDetails | null;
  defaultDescription: string;
  defaultDescriptionAr: string;
}

/** ما هو محفوظ للفرع الآن: وصفاه الخاصان، وهل للفرع صورة خاصة. */
export interface ItemDetailsSaved {
  description: string;
  description_ar: string;
  hasOwnImage: boolean;
}

/** مسودة النموذج: الوصفان كما كتبهما المستخدم، والملف الذي اختاره، وطلب إرجاع الصورة إلى العامة. */
export interface ItemDetailsDraft {
  description: string;
  description_ar: string;
  image: File | null;
  removeImage: boolean;
}

/** نص أو `null` للقيم غير النصية والفارغة. */
export function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * يقرأ `branch_details` من صف الصنف. `null` أو كائن لا يحمل قيمة واحدة يعني أن الفرع يعرض النسخة العامة.
 */
export function branchDetailsOf(value: unknown): ItemBranchDetails | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const details: ItemBranchDetails = {
    image: textOrNull(row.image),
    description: textOrNull(row.description),
    description_ar: textOrNull(row.description_ar),
  };
  return details.image || details.description || details.description_ar ? details : null;
}

/**
 * الطلب الذي يُرسل عند الحفظ: الحقول التي تغيّرت وحدها، أو `null` إن لم يتغيّر شيء. الوصف الذي
 * يُفرَّغ يرجع إلى العام، ورفع ملف جديد يغلب طلب إرجاع الصورة، وإرجاع الصورة لا معنى له إن لم
 * يكن للفرع صورة خاصة.
 */
export function itemDetailsPatch(saved: ItemDetailsSaved, draft: ItemDetailsDraft): ItemDetailsPatch | null {
  const patch: ItemDetailsPatch = {};
  if (draft.description.trim() !== saved.description.trim()) patch.description = draft.description.trim();
  if (draft.description_ar.trim() !== saved.description_ar.trim()) patch.description_ar = draft.description_ar.trim();
  if (draft.image) patch.image = draft.image;
  else if (draft.removeImage && saved.hasOwnImage) patch.remove_image = true;
  return Object.keys(patch).length > 0 ? patch : null;
}
