/**
 * حالة الفرع الآن كما يعيدها الخادم في كل استجابة للفرع. لا يستورد هذا الملف شيئاً من المشروع،
 * ليعمل في اختبارات Node مباشرة.
 */
export type BranchStatus =
  | "open"
  | "closedByBranch"
  | "outsideHours"
  | "noOrderTypes"
  | "noPaymentMethods"
  | "hidden"
  | "unknown";

/**
 * هل الفرع يستقبل طلبات الآن؟ `is_open_now` هو الجواب الكامل: زر الفتح والإغلاق وأوقات الدوام وأنواع
 * الطلب وطرق الدفع معاً. أما `is_accepting_orders` فمفتاح الفتح اليدوي وحده، وقد يكون true والفرع مغلق
 * لسبب آخر. فلا يُرجع إليه إلا إن لم يصل `is_open_now`.
 */
export function isOpenNow(row: Record<string, unknown>): boolean {
  return typeof row.is_open_now === "boolean" ? row.is_open_now : Boolean(row.is_accepting_orders);
}

/**
 * حالة الفرع من `is_open_now` و`closed_reason` معاً. `is_open_now` هو الأساس: true يعني مفتوحاً مهما كان
 * السبب. وإن كان false فالسبب هو `closed_reason`: `closed_by_branch` أغلقه الفرع يدوياً،
 * و`outside_opening_hours` برّا الدوام، و`no_order_types` التوصيل والاستلام مطفيان معاً،
 * و`no_payment_methods` النقد والبطاقة مطفيان معاً، و`hidden` مخفي. وسبب لا نعرفه أو غائب يبقى `unknown`،
 * ولا يُعدّ مفتوحاً أبداً حين يقول الخادم إنه مغلق.
 */
export function branchStatusOf(row: Record<string, unknown>): BranchStatus {
  return statusFrom(row.is_open_now, row.closed_reason);
}

/** نفس التحويل لقيمتين مفردتين، كالتي تأتي في `by_branch` للوحة العمليات. */
export function statusFrom(openNow: unknown, reason: unknown): BranchStatus {
  if (openNow === true) return "open";
  const status = closedReasonStatus(reason);
  // مغلق بحسب الخادم لكن السبب `null`: تناقض لا نعرف تفسيره، فلا نعرضه مفتوحاً.
  return openNow === false && status === "open" ? "unknown" : status;
}

/** نفس التحويل لقيمة `closed_reason` وحدها، كالتي تأتي في `by_branch` للوحة العمليات. */
export function closedReasonStatus(reason: unknown): BranchStatus {
  switch (reason) {
    case null:
      return "open";
    case "closed_by_branch":
      return "closedByBranch";
    case "outside_opening_hours":
      return "outsideHours";
    case "no_order_types":
      return "noOrderTypes";
    case "no_payment_methods":
      return "noPaymentMethods";
    case "hidden":
      return "hidden";
    default:
      return "unknown";
  }
}

/**
 * وقت محلي بصيغة HH:MM في المنطقة الزمنية للفرع، لا لجهاز المشغّل. يُرجع null إن كان الوقت
 * غائباً أو المنطقة غير معروفة.
 */
export function localClock(iso: unknown, timeZone: unknown): string | null {
  if (typeof iso !== "string" || iso === "") return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: typeof timeZone === "string" && timeZone !== "" ? timeZone : undefined,
    }).format(date);
  } catch {
    return null;
  }
}
