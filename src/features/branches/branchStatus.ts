/**
 * حالة الفرع الآن كما يعيدها الخادم في كل استجابة للفرع. لا يستورد هذا الملف شيئاً من المشروع،
 * ليعمل في اختبارات Node مباشرة.
 */
export type BranchStatus = "open" | "closedByBranch" | "outsideHours" | "hidden" | "unknown";

/**
 * `closed_reason`: `null` يعني مفتوحاً، و`closed_by_branch` أغلقه الفرع يدوياً،
 * و`outside_opening_hours` برّا الدوام، و`hidden` مخفي. الحقل الغائب لا يُفترض له شيء.
 */
export function branchStatusOf(row: Record<string, unknown>): BranchStatus {
  if (row.closed_reason === undefined) return "unknown";
  switch (row.closed_reason) {
    case null:
      return "open";
    case "closed_by_branch":
      return "closedByBranch";
    case "outside_opening_hours":
      return "outsideHours";
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
