export type StatusTone = "ok" | "warn" | "danger" | "info" | "neutral";

const STATUS_TONE: Record<string, StatusTone> = {
  completed: "ok",
  delivered: "ok",
  cancelled: "danger",
  rejected: "danger",
  delivery_failed: "danger",
  preparing: "warn",
  ready: "info",
  on_the_way: "info",
  submitted: "neutral",
};

const TONE_DOT: Record<StatusTone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted",
};

/** لون الحالة كما يظهر في الشارة. */
export const statusTone = (status: string): StatusTone => STATUS_TONE[status] ?? "neutral";

/** لون نقطة الحالة، يُستعمل في زر تغيير الحالة وفي النافذة. */
export const statusDotClass = (status: string) => TONE_DOT[statusTone(status)];
