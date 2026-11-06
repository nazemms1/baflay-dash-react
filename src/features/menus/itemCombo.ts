/**
 * الكومبو لكل صنف داخل القائمة. سعر الكومبو واحد للقائمة كلها، لكن الصنف قد يُستثنى منه، كالمشروبات
 * أو أي صنف لا يُباع كوجبة. الخادم يعيد في كل صنف من أصناف القائمة `has_combo`: true يعني أن خيار
 * الوجبة يظهر له، وfalse أنه لا يظهر. لا يستورد هذا الملف شيئاً من المشروع، ليعمل في اختبارات Node مباشرة.
 */

/** صلاحية تعديل كومبو الصنف داخل القائمة، بالاسم الذي يعرفه الخادم. */
export const ITEM_COMBO_PERMISSION = "menus.items.combo.update";

/**
 * قيمة `has_combo` من صف صنف في القائمة. `null` يعني أن الخادم لم يرسل الحقل بعد، فلا نعرف حالة الصنف
 * ولا نعرض له مفتاحاً.
 */
export function hasComboOf(row: Record<string, unknown>): boolean | null {
  const value = row.has_combo;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return null;
}

/**
 * هل يظهر خيار الوجبة للصنف؟ false الصريحة وحدها تمنعه. غياب الحقل يبقي السلوك كما كان قبله: الكومبو
 * لكل أصناف القائمة، فلا يتعطل البيع إن لم يرسل الخادم الحقل.
 */
export const comboAllowed = (row: Record<string, unknown> | undefined): boolean =>
  row === undefined ? true : hasComboOf(row) !== false;
