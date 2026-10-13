import type { TFunction } from "i18next";
import { toText } from "@/lib/coerce";
import { toApiError } from "@/lib/http/errors";

/** رموز الرفض التي يردّها الخادم حين تمنع قاعدة الطلب المفتوح بدء طلب أو تأكيده. */
const REFUSAL_KEYS: Record<string, string> = {
  cash_order_in_progress: "orderRefusal.cashInProgress",
  order_in_progress: "orderRefusal.orderInProgress",
  cart_open_at_another_branch: "orderRefusal.cartAtAnotherBranch",
  delivery_paused: "orderRefusal.deliveryPaused",
  branch_closed: "orderRefusal.branchClosed",
  extra_not_offered: "orderRefusal.extraNotOffered",
};

/**
 * نص الرفض للكاشير: للرموز المعروفة نص مترجم يذكر رقم الطلب المفتوح حين يأتي من الخادم،
 * وغيرها تبقى رسالة الخادم كما هي.
 */
export function orderRefusalMessage(error: unknown, t: TFunction, fallback: string): string {
  const apiError = toApiError(error, fallback);
  const key = apiError.code ? REFUSAL_KEYS[apiError.code] : undefined;
  if (!key) return apiError.message;
  // الرفض يحمل رقم الطلب المفتوح واسم فرعه، فيُذكران ليعرف الكاشير أين الطلب.
  const orderNumber = toText(apiError.details.order_number);
  const branchName = toText(apiError.details.branch_name);
  const reference = [orderNumber, branchName].filter(Boolean).join(" · ");
  return t(key, { order: reference ? ` (${reference})` : "" });
}
