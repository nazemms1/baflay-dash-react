import axios from "axios";

export type FieldErrors = Record<string, string[]>;

/**
 * خطأ واحد يعرفه كل الكود. الصفحات لا تتعامل مع `AxiosError` مباشرة، فيكفي
 * أن تقرأ `status` أو `code` أو `fieldErrors` من هنا.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly fieldErrors: FieldErrors;
  /** جسم الاستجابة كما جاء، لحقول تخص الرفض مثل رقم الطلب المفتوح واسم فرعه. */
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      fieldErrors?: FieldErrors;
      details?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
    this.details = options.details ?? {};
  }
}

interface ErrorBody {
  message?: unknown;
  code?: unknown;
  error?: unknown;
  errors?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function toFieldErrors(value: unknown): FieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages.map(String) : [String(messages)],
    ])
  );
}

export function toApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const body = (error.response?.data ?? {}) as ErrorBody;
    const message =
      typeof body.message === "string" && body.message ? body.message : fallbackMessage;

    const code =
      typeof body.code === "string"
        ? body.code
        : typeof body.error === "string"
          ? body.error
          : null;

    return new ApiError(message, {
      status: error.response?.status ?? null,
      code,
      fieldErrors: toFieldErrors(body.errors),
      details: isRecord(body) ? body : {},
    });
  }

  return new ApiError(error instanceof Error ? error.message : fallbackMessage);
}

/** الخادم رفض الإجراء لنقص الصلاحية (403). */
export const isForbidden = (error: unknown): boolean => error instanceof ApiError && error.status === 403;

/** أول رسالة تحقق لحقل معيّن، لتظهر تحت الحقل نفسه في النموذج. */
export function fieldMessage(error: unknown, field: string): string | null {
  return error instanceof ApiError ? (error.fieldErrors[field]?.[0] ?? null) : null;
}
