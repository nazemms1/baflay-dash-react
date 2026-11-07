/**
 * حالة الفرع الآن كما يعيدها الخادم في كل استجابة للفرع. لا يستورد هذا الملف شيئاً من المشروع،
 * ليعمل في اختبارات Node مباشرة.
 */
export type BranchStatus =
  | "open"
  | "openNoOnline"
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
 * حالة الفرع من `is_open_now` و`closed_reason` و`accepts_online_orders`. `is_open_now` هو الأساس: true يعني
 * أن الفرع مفتوح (الفتح اليدوي وأوقات الدوام معاً)، حتى لو كان التوصيل والاستلام مطفيين. في هذه الحالة
 * يبقى الفرع مفتوحاً للناس في المحل والكاشير، ويقف الطلب الأونلاين وحده: `accepts_online_orders = false`.
 * وإن كان `is_open_now` false فالسبب هو `closed_reason`: `closed_by_branch` أغلقه الفرع يدوياً،
 * و`outside_opening_hours` برّا الدوام، و`hidden` مخفي. وسبب لا نعرفه أو غائب يبقى `unknown`، ولا يُعدّ
 * مفتوحاً أبداً حين يقول الخادم إنه مغلق.
 */
export function branchStatusOf(row: Record<string, unknown>): BranchStatus {
  return statusFrom(row.is_open_now, row.closed_reason, row.accepts_online_orders);
}

/**
 * نفس التحويل لقيم مفردة، كالتي تأتي في `by_branch` للوحة العمليات. `acceptsOnline` اختياري: false الصريحة
 * وحدها تجعل الفرع المفتوح «بدون طلب أونلاين».
 */
export function statusFrom(openNow: unknown, reason: unknown, acceptsOnline?: unknown): BranchStatus {
  if (openNow === true) return acceptsOnline === false ? "openNoOnline" : "open";
  const status = closedReasonStatus(reason);
  // مغلق بحسب الخادم لكن السبب `null`: تناقض لا نعرف تفسيره، فلا نعرضه مفتوحاً.
  return openNow === false && status === "open" ? "unknown" : status;
}

/**
 * سبب توقف الطلب الأونلاين كما يرجع في `online_orders_unavailable_reason`: `no_order_types` (التوصيل
 * والاستلام مطفيان) أو `no_payment_methods` (الكاش والبطاقة مطفيان). `null` إن لم يتوقف أو لم يُرسل السبب.
 */
export function onlineReasonOf(row: Record<string, unknown>): string | null {
  const reason = row.online_orders_unavailable_reason;
  return typeof reason === "string" && reason !== "" ? reason : null;
}

/**
 * هل أوقف الحفظ الطلب الأونلاين؟ ردّ مفاتيح التوصيل والاستلام والدفع يحمل `accepts_online_orders`
 * و`online_orders_unavailable_reason`، داخل `data` أو في الجذر. `stopped` true فقط إن قال الخادم false صراحةً،
 * فغياب الحقل لا يُفسَّر توقفاً.
 */
export function onlineStopOf(result: unknown): { stopped: boolean; reason: string | null } {
  const body = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : body;
  return { stopped: data.accepts_online_orders === false, reason: onlineReasonOf(data) };
}

/**
 * نفس التحويل لقيمة `closed_reason` وحدها، كالتي تأتي في `by_branch` للوحة العمليات. */
export function closedReasonStatus(reason: unknown): BranchStatus {
  switch (reason) {
    case null:
      return "open";
    case "closed_by_branch":
      return "closedByBranch";
    case "outside_opening_hours":
      return "outsideHours";
    // قديم: خادم لم يُحدَّث بعد كان يُغلق الفرع حين يُطفأ التوصيل والاستلام أو الكاش والبطاقة. الخادم الجديد
    // يُبقيه مفتوحاً ويوقف الأونلاين وحده (`accepts_online_orders`).
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
