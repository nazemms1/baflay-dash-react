import type { TFunction } from "i18next";
import { toApiError } from "@/lib/http/errors";

/** نص كل رمز خطأ من الخادم. الحكم يتم بالرمز، لا برسالة الخادم التي قد تتغيّر. */
const DRIVER_ERROR_KEYS: Record<string, string> = {
  cannot_assign_driver: "drivers.errors.cannotAssign",
  not_a_driver_here: "drivers.errors.notDriverHere",
  not_ready_for_pickup: "drivers.errors.notReadyForPickup",
  not_on_the_way: "drivers.errors.notOnTheWay",
  not_your_delivery: "drivers.errors.notYourDelivery",
  outside_your_branch: "drivers.errors.outsideBranch",
};

/** الرموز التي تعني أن حالة الطلب تغيّرت (كبس مرتين، أو سائق آخر): تُعاد قراءة القائمة بعدها. */
export const STALE_ORDER_CODES = [
  "not_on_the_way",
  "not_your_delivery",
  "not_ready_for_pickup",
  "cannot_assign_driver",
];

export const driverErrorCode = (error: unknown): string | null => toApiError(error, "").code;

/** نص الخطأ المترجم حسب الرمز. الرمز غير المعروف يعرض رسالة الخادم كما هي. */
export function driverErrorMessage(error: unknown, t: TFunction, fallback: string): string {
  const apiError = toApiError(error, fallback);
  const key = apiError.code ? DRIVER_ERROR_KEYS[apiError.code] : undefined;
  return key ? t(key) : apiError.message;
}
