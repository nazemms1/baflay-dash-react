/** أسباب تعذّر التسليم كما يقبلها الخادم. */
export const FAILURE_REASONS = ["customer_refused", "not_home", "wrong_address", "unreachable", "other"] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export const isFailureReason = (value: unknown): value is FailureReason =>
  typeof value === "string" && (FAILURE_REASONS as readonly string[]).includes(value);

/** السبب إجباري، و«سبب آخر» يطلب ملاحظة مكتوبة. */
export const failureIsComplete = (reason: string, note: string): boolean =>
  isFailureReason(reason) && (reason !== "other" || note.trim() !== "");
