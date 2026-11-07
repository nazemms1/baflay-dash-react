import type { TFunction } from "i18next";
import { asRecord, toNumber, toText } from "@/lib/coerce";
import { toApiError } from "@/lib/http/errors";
import { formatNumber } from "@/lib/format";

/** رموز الرفض التي يردّها الخادم حين تمنع قاعدة بدء طلب أو تأكيده. */
const REFUSAL_KEYS: Record<string, string> = {
  cash_order_in_progress: "orderRefusal.cashInProgress",
  order_in_progress: "orderRefusal.orderInProgress",
  cart_open_at_another_branch: "orderRefusal.cartAtAnotherBranch",
  delivery_paused: "orderRefusal.deliveryPaused",
  pickup_paused: "orderRefusal.pickupPaused",
  delivery_only: "orderRefusal.deliveryOnly",
  cash_paused: "orderRefusal.cashPaused",
  card_paused: "orderRefusal.cardPaused",
  outside_your_branch: "orderRefusal.outsideYourBranch",
  branch_closed: "orderRefusal.branchClosed",
  extra_not_offered: "orderRefusal.extraNotOffered",
};

/** مبلغ بمنزلتين عشريتين كحد أقصى، فلا يُقرَّب الناقص 7.5 إلى 8. */
const amountText = (value: unknown, currency: string): string => {
  const digits = formatNumber(toNumber(value), { maximumFractionDigits: 2 });
  return currency ? `${digits} ${currency}` : digits;
};

/** نص رفض الإغلاق حسب `data.closed_reason`: برّا الدوام برسالة الخادم لأنها تذكر اليوم والوقت، وغيره نص ثابت. */
function branchClosedMessage(reason: string, serverMessage: string, t: TFunction): string {
  return reason === "outside_opening_hours" && serverMessage ? serverMessage : t("orderRefusal.branchClosed");
}

/** الطلب الأونلاين واقف والفرع مفتوح: السبب في `data.reason`. */
function onlineUnavailableMessage(reason: string, t: TFunction): string {
  switch (reason) {
    case "no_order_types":
      return t("orderRefusal.onlineUnavailableNoOrderTypes");
    case "no_payment_methods":
      return t("orderRefusal.onlineUnavailableNoPaymentMethods");
    default:
      return t("orderRefusal.onlineUnavailable");
  }
}

/**
 * نص الرفض للكاشير: للرموز المعروفة نص مترجم يذكر رقم الطلب المفتوح حين يأتي من الخادم،
 * وغيرها تبقى رسالة الخادم كما هي. يُقرأ الرفض من الرمز `code` لا من نص الرسالة.
 */
export function orderRefusalMessage(error: unknown, t: TFunction, fallback: string): string {
  const apiError = toApiError(error, fallback);
  const data = asRecord(apiError.details.data);

  if (apiError.code === "branch_closed") {
    return branchClosedMessage(toText(data.closed_reason), apiError.message, t);
  }

  // الفرع مفتوح لكن الطلب الأونلاين واقف: رمز مستقل عن `branch_closed`، والسبب في `data.reason`.
  if (apiError.code === "online_ordering_unavailable") {
    return onlineUnavailableMessage(toText(data.reason), t);
  }

  if (apiError.code === "combo_not_offered") {
    // رسالة الخادم مترجمة وتذكر اسم الصنف («لا يتوفر كولا كوجبة في هذا الفرع…»)، وهي أوضح من نص ثابت.
    return toText(apiError.details.message).trim() || t("orderRefusal.comboNotOffered");
  }

  if (apiError.code === "below_minimum_order") {
    const currency = toText(data.currency);
    return t("orderRefusal.belowMinimumOrder", {
      min: amountText(data.min_order_amount, currency),
      missing: amountText(data.missing, currency),
    });
  }

  const key = apiError.code ? REFUSAL_KEYS[apiError.code] : undefined;
  if (!key) return apiError.message;
  // الرفض يحمل رقم الطلب المفتوح واسم فرعه، فيُذكران ليعرف الكاشير أين الطلب.
  const orderNumber = toText(apiError.details.order_number);
  const branchName = toText(apiError.details.branch_name);
  const reference = [orderNumber, branchName].filter(Boolean).join(" · ");
  return t(key, { order: reference ? ` (${reference})` : "" });
}
