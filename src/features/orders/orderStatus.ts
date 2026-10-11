import type { currentLanguage } from "@/i18n";
import { asRecord, toText } from "@/lib/coerce";
import type { Named } from "@/services";

/** حالات الطلب كما يستقبلها الخادم في `admin/orders/{id}/status`. */
export const ORDER_STATUSES = [
  "submitted",
  "preparing",
  "ready",
  "on_the_way",
  "completed",
  "cancelled",
  "rejected",
] as const;

const TERMINAL_STATUSES = ["completed", "cancelled", "rejected"];

/**
 * الانتقالات التي يقبلها الخادم، ويُستعمل هذا الجدول فقط حين لا يرسل الطلب كتلة `tracking`.
 * الاستخدام الفعلي يتبع ما يرسله الخادم، فهو مصدر الحقيقة.
 */
const FALLBACK_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["preparing", "cancelled", "rejected"],
  preparing: ["on_the_way", "ready", "completed", "cancelled", "rejected"],
  ready: ["completed", "cancelled"],
  on_the_way: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
};

/** مراحل الطلب الاحتياطية، إن لم يرسل الخادم `tracking`: الاستلام بلا سائق، والتوصيل بلا رف. */
const FALLBACK_STAGES = {
  pickup: ["submitted", "preparing", "ready", "completed"],
  delivery: ["submitted", "preparing", "on_the_way", "completed"],
};

export type StageState = "done" | "current" | "upcoming";

export interface OrderStage {
  code: string;
  /** التسمية الرسمية من الخادم، أو `null` فتُستعمل الترجمة المحلية. */
  label: string | null;
  state: StageState;
}

export const isPickupOrder = (row: Named) => ["pickup", "takeaway"].includes(toText(row.delivery_type));

/** الحالات التالية المسموحة لهذا الطلب، دون حالته الحالية. */
export function nextStatusesOf(row: Named): string[] {
  const current = toText(row.status);
  const fromServer = asRecord(row.tracking).next_statuses;
  if (Array.isArray(fromServer)) {
    return fromServer.map((value) => toText(value)).filter((code) => code && code !== current);
  }

  if (TERMINAL_STATUSES.includes(current)) return [];

  const pickup = isPickupOrder(row);
  return (FALLBACK_TRANSITIONS[current] ?? []).filter(
    // لا سائق في الاستلام، ولا رف في التوصيل.
    (code) => !(pickup && code === "on_the_way") && !(!pickup && code === "ready")
  );
}

/**
 * التسمية الرسمية لحالة من `tracking` كما يرسلها الخادم: «تم الاستلام» للاستلام و«تم التسليم»
 * للتوصيل، وكذلك أسماء المراحل كلها. `null` إن لم يرسل الخادم تسمية لهذه الحالة.
 */
export function serverLabelOf(row: Named, code: string, language: ReturnType<typeof currentLanguage>): string | null {
  const tracking = asRecord(row.tracking);
  const labelOf = (entry: Record<string, unknown>) =>
    (language === "ar" ? toText(entry.label_ar) : toText(entry.label)) || toText(entry.label) || toText(entry.label_ar) || null;

  const stages = Array.isArray(tracking.stages) ? tracking.stages : [];
  const stage = stages.map((entry) => asRecord(entry)).find((entry) => toText(entry.code) === code);
  if (stage) return labelOf(stage);
  if (toText(tracking.status) === code) return labelOf(tracking);
  return null;
}

/** مراحل الطلب بترتيبها وحالة كل مرحلة: من `tracking` إن وُجد، وإلا من المراحل الاحتياطية. */
export function stagesOf(row: Named, language: ReturnType<typeof currentLanguage>): OrderStage[] {
  const serverStages = Array.isArray(asRecord(row.tracking).stages)
    ? (asRecord(row.tracking).stages as unknown[]).map((entry) => asRecord(entry))
    : [];

  if (serverStages.length > 0) {
    return serverStages.map((stage) => {
      const code = toText(stage.code);
      const state = toText(stage.state);
      return {
        code,
        label: serverLabelOf(row, code, language),
        state: state === "done" || state === "current" ? state : "upcoming",
      };
    });
  }

  const flow = isPickupOrder(row) ? FALLBACK_STAGES.pickup : FALLBACK_STAGES.delivery;
  const index = flow.indexOf(toText(row.status));
  return flow.map((code, position): OrderStage => ({
    code,
    label: null,
    state: index < 0 ? "upcoming" : position < index ? "done" : position === index ? "current" : "upcoming",
  }));
}

/** الطلب المنتهي لا تتغير حالته. الخادم يقولها صراحةً إن أرسل `tracking`. */
export function isFinalOrder(row: Named): boolean {
  const isFinal = asRecord(row.tracking).is_final;
  return typeof isFinal === "boolean" ? isFinal : TERMINAL_STATUSES.includes(toText(row.status));
}
