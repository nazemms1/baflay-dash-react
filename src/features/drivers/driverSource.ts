import type { TFunction } from "i18next";
import type { RemoteSource } from "@/components/crud/types";
import { toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { users, type Named } from "@/services";
import { DRIVER_ROLE } from "./permissions";

/**
 * مصدر بحث عن السائقين على الخادم: كل طلب يجلب عشرين سائقاً يطابقون ما كُتب، والسائق المختار
 * يُجلب وحده بمعرّفه. لا تُنزَّل القائمة كلها.
 *
 * مع فرع محدد لا يظهر إلا سائقو ذلك الفرع، فسائق فرع آخر لا يُعرض أصلاً. الخادم يبقى هو الذي
 * يقرر إن كان الإسناد مسموحاً، ويرد برمز واضح عند الرفض.
 */
export function driverSource(branchId: number | null): RemoteSource {
  const toOption = (row: Named) => ({
    value: toNumber(row.id),
    label: toText(row.name) || `#${toText(row.id)}`,
  });
  const belongsHere = (row: Named) => branchId === null || toNullableNumber(row.branch_id) === branchId;

  return {
    // كل فرع له مفتاح تخزين مؤقت مستقل، لأن القائمة نفسها تتغير بالفرع.
    cacheKey: `drivers-${branchId ?? "all"}`,
    search: async (term, page, signal) => {
      const result = await users.list(
        {
          page,
          per_page: 20,
          role: DRIVER_ROLE,
          ...(branchId !== null ? { branch_id: branchId } : {}),
          ...(term ? { search: term } : {}),
        },
        signal
      );
      return {
        items: result.items.filter(belongsHere).map(toOption),
        lastPage: result.meta.lastPage,
      };
    },
    byId: async (value, signal) => {
      try {
        return toOption(await users.get(value, signal));
      } catch {
        return null;
      }
    },
  };
}

/**
 * مصدر فلتر السائق في صفحة الطلبات: الخيار "بلا سائق" في أول النتائج، ثم سائقو كل الفروع.
 * الخيار الأول لا يأتي من الخادم، لذلك يُضاف محلياً في الصفحة الأولى من غير بحث.
 */
export function driverFilterSource(t: TFunction): RemoteSource {
  const base = driverSource(null);
  const needsDriver = { value: "needs", label: t("drivers.assign.needsDriver") };

  return {
    cacheKey: "drivers-filter",
    search: async (term, page, signal) => {
      const result = await base.search(term, page, signal);
      return page === 1 && !term ? { ...result, items: [needsDriver, ...result.items] } : result;
    },
    byId: (value, signal) => (value === "needs" ? Promise.resolve(needsDriver) : base.byId(value, signal)),
  };
}
