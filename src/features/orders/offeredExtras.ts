/**
 * الإضافات التي يعرضها فرع على الطلب. الخادم يرفض أي إضافة خارج هذه القائمة برمز
 * `extra_not_offered`، والمصدر الموثوق هو `extras` في القائمة العامة، لأنها تطرح ما أطفأه الفرع
 * من إضافات البراند.
 *
 * هذا الملف بلا استيرادات، فيُختبر مباشرة بـ Node بمعزل عن الواجهة.
 */

export interface VisibleExtras {
  sauces: number[];
  addOns: number[];
}

/** معرّفات الإضافات المعروضة في القائمة، أو `null` إن لم يرسل الخادم القائمة فلا يُفلتر شيء. */
export function offeredExtraIds(menu: unknown): number[] | null {
  const extras = menu !== null && typeof menu === "object" ? (menu as { extras?: unknown }).extras : undefined;
  if (!Array.isArray(extras)) return null;

  return extras
    .map((entry) => {
      if (entry !== null && typeof entry === "object") {
        const row = entry as { id?: unknown; ingredient_id?: unknown };
        return Number(row.id ?? row.ingredient_id);
      }
      return Number(entry);
    })
    .filter((id) => Number.isInteger(id) && id > 0);
}

/**
 * ما يظهر للكاشير، وكل مكوّن يظهر في مكان واحد فقط:
 * - إضافات الصنف (Add-on): إضافات الصنف، بعد استبعاد ما أطفأه الفرع من إضافات البراند.
 * - الإضافات العامة (Extra): إضافات البراند التي يعرضها الفرع، إلا ما هو إضافة للصنف نفسه
 *   (فهذا يظهر في إضافات الصنف فقط، فلا يتكرر).
 * وإن كانت القائمة العامة غير معروفة فلا يُفلتر شيء.
 */
export function visibleExtras(input: {
  brandExtras: number[];
  itemAddOns: number[];
  offered: number[] | null;
}): VisibleExtras {
  const { brandExtras, itemAddOns, offered } = input;
  const itemSet = new Set(itemAddOns);
  if (offered === null) {
    return { sauces: brandExtras.filter((id) => !itemSet.has(id)), addOns: [...itemAddOns] };
  }

  const allowed = new Set(offered);
  const turnedOff = new Set(brandExtras.filter((id) => !allowed.has(id)));
  return {
    sauces: brandExtras.filter((id) => allowed.has(id) && !itemSet.has(id)),
    addOns: itemAddOns.filter((id) => !turnedOff.has(id)),
  };
}
