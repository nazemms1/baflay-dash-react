import type { FieldDef, Values } from "./types";

import { currentLanguage } from "@/i18n";
import { localizedRecord, type RawBilingual } from "@/lib/localized";

type Mode = "create" | "update";
type RecordLike = Record<string, unknown>;

const toOrder = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** المعرّف من قيمة علاقة: قد تأتي رقماً أو كائناً فيه `id`. */
const idOf = (value: unknown): number | string | null => {
  if (typeof value === "number" || typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "number" || typeof id === "string" ? id : null;
  }
  return null;
};

/**
 * قيمة علاقة من السجل: الحقل المباشر (`state_id`) أولاً، ثم الكائن المتداخل
 * (`state.id`) لأن الخادم يرسل أحياناً أحدهما.
 */
function relationValue(record: RecordLike, key: string): number | string | null {
  const direct = idOf(record[key]);
  if (direct !== null) return direct;
  const nested = key.replace(/_id$/, "");
  return idOf(record[nested]);
}

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** القيم الابتدائية للنموذج، من السجل إن وُجد أو فارغة للإنشاء. */
export function defaultValues(fields: FieldDef[], record: RecordLike | null): Values {
  const values: Values = {};

  for (const field of fields) {
    const source = record ?? {};
    switch (field.kind) {
      case "bilingual":
        values[field.key] = source[field.key] ?? "";
        values[`${field.key}_ar`] = source[`${field.key}_ar`] ?? "";
        break;
      case "switch":
        values[field.key] = Boolean(source[field.key] ?? field.defaultValue ?? false);
        break;
      case "select":
        values[field.key] = record ? relationValue(record, field.key) : null;
        break;
      case "permissions": {
        const list = Array.isArray(source[field.key]) ? (source[field.key] as unknown[]) : [];
        // الصلاحيات تُرسل أسماءها كما يولّدها الخادم، لا معرّفاتها.
        values[field.key] = list
          .map((entry) => (typeof entry === "string" ? entry : String((entry as { name?: unknown } | null)?.name ?? "")))
          .filter((name) => name !== "");
        break;
      }
      case "multiselect": {
        const list = Array.isArray(source[field.key]) ? (source[field.key] as unknown[]) : [];
        values[field.key] = list.map(idOf).filter((id): id is number | string => id !== null);
        break;
      }
      case "date": {
        // الخادم يرسل التاريخ أحياناً مع الوقت، وحقل التاريخ لا يقرأ إلا YYYY-MM-DD.
        const raw = source[field.key];
        values[field.key] = typeof raw === "string" ? raw.slice(0, 10) : "";
        break;
      }
      case "image":
        values[field.key] = null;
        break;
      case "custom":
        // الكتلة المخصصة تعرض قيم غيرها ولا تحمل قيمة خاصة بها.
        break;
      case "location":
        values[field.key] = numberOrNull(source[field.key]);
        values[field.lngKey] = numberOrNull(source[field.lngKey]);
        if (field.radiusKey) values[field.radiusKey] = source[field.radiusKey] ?? "";
        if (field.deliveryLatKey && field.deliveryLngKey) {
          values[field.deliveryLatKey] = numberOrNull(source[field.deliveryLatKey]);
          values[field.deliveryLngKey] = numberOrNull(source[field.deliveryLngKey]);
        }
        break;
      case "rows": {
        // الصفوف الموجودة تُنسخ مع معرّفها، وقيم العلاقات داخلها تُستخرج بالطريقة نفسها.
        const list = Array.isArray(source[field.key]) ? (source[field.key] as RecordLike[]) : [];
        const ordered = field.sortable && field.orderKey
          ? [...list].sort((a, b) => toOrder(a[field.orderKey!]) - toOrder(b[field.orderKey!]))
          : list;
        values[field.key] = ordered.map((row) => {
          const copy: RecordLike = { ...row };
          // قيم الصف قد تأتي في `pivot` لعلاقة الصنف بالقائمة، فتُؤخذ منه إن غابت عن الصف نفسه.
          const pivot = row.pivot && typeof row.pivot === "object" ? (row.pivot as RecordLike) : {};
          for (const column of field.columns) {
            if (column.kind !== "select") continue;
            // الصف نفسه هو السجل المرتبط إن لم يأتِ معرّف العلاقة (كما يفعل الأصل بـ `item_id || id`).
            // وقيمة مثل العملة (نص لا معرّف) تُؤخذ من الـ pivot إن لم تكن على الصف.
            const fromPivot = pivot[column.key];
            const pivotValue = typeof fromPivot === "string" || typeof fromPivot === "number" ? fromPivot : null;
            copy[column.key] = relationValue(row, column.key) ?? (column.self ? idOf(row.id) : null) ?? pivotValue;
            // اسم العلاقة يُحفظ مع الصف ليظهر حتى قبل وصول قائمة الخيارات.
            const nested = row[column.key.replace(/_id$/, "")];
            if (nested && typeof nested === "object") {
              copy[`${column.key}__label`] = localizedRecord(nested as RawBilingual, currentLanguage());
            } else if (column.self) {
              copy[`${column.key}__label`] = localizedRecord(row as RawBilingual, currentLanguage());
            }
          }
          for (const column of [...field.columns, ...(field.viewColumns ?? [])]) {
            // الـ null على الصف يعني «لم يُحدَّد» كالغياب، فيُؤخذ الـ pivot في الحالتين.
            if (column.kind === "select" || (copy[column.key] !== undefined && copy[column.key] !== null)) continue;
            if (pivot[column.key] !== undefined) copy[column.key] = pivot[column.key];
          }
          return copy;
        });
        break;
      }
      case "number":
        values[field.key] = source[field.key] ?? "";
        break;
      default:
        values[field.key] = source[field.key] ?? "";
    }
  }

  return values;
}

const nullIfEmpty = (value: unknown): unknown => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value ?? null;
};

/**
 * الحمولة التي تُرسل: الفارغ يصير `null`، وكلمة المرور تُرسل عند الكتابة فقط،
 * والملف يُرسل عند اختياره فقط. الحقول المخصصة لوضع واحد تُستبعد من الوضع الآخر.
 */
export function buildPayload(fields: FieldDef[], values: Values, mode: Mode): Values {
  const payload: Values = {};

  for (const field of fields) {
    if (field.readOnly) continue;
    if (mode === "create" && field.editOnly) continue;
    if (mode === "update" && field.createOnly) continue;

    switch (field.kind) {
      case "custom":
        break;
      case "bilingual":
        payload[field.key] = nullIfEmpty(values[field.key]);
        payload[`${field.key}_ar`] = nullIfEmpty(values[`${field.key}_ar`]);
        break;
      case "password": {
        const password = typeof values[field.key] === "string" ? values[field.key] : "";
        if (password !== "") payload[field.key] = password;
        break;
      }
      case "number": {
        const raw = values[field.key];
        payload[field.key] = raw === "" || raw === null || raw === undefined ? null : Number(raw);
        break;
      }
      case "switch":
        payload[field.key] = Boolean(values[field.key]);
        break;
      case "select":
        payload[field.key] = values[field.key] ?? null;
        break;
      case "date":
        payload[field.key] = nullIfEmpty(values[field.key]);
        break;
      case "permissions":
        // الخادم يقبل أسماء الصلاحيات نصوصاً فقط، فنحوّل كل قيمة إلى نص قبل الإرسال.
        payload[field.key] = Array.isArray(values[field.key])
          ? (values[field.key] as unknown[]).map(String).filter((name) => name !== "" && name !== "undefined")
          : [];
        break;
      case "multiselect":
        payload[field.key] = Array.isArray(values[field.key]) ? values[field.key] : [];
        break;
      case "image":
        if (values[field.key] instanceof File) payload[field.key] = values[field.key];
        break;
      case "location":
        payload[field.key] = numberOrNull(values[field.key]);
        payload[field.lngKey] = numberOrNull(values[field.lngKey]);
        if (field.radiusKey) payload[field.radiusKey] = numberOrNull(values[field.radiusKey]);
        if (field.deliveryLatKey && field.deliveryLngKey) {
          // الخادم يقبل النقطتين معاً أو يمسحهما معاً، ويرفض إحداهما وحدها بـ422، فلا تُرسل واحدة.
          const lat = numberOrNull(values[field.deliveryLatKey]);
          const lng = numberOrNull(values[field.deliveryLngKey]);
          const complete = lat !== null && lng !== null;
          payload[field.deliveryLatKey] = complete ? lat : null;
          payload[field.deliveryLngKey] = complete ? lng : null;
        }
        break;
      case "rows": {
        const rows = Array.isArray(values[field.key]) ? (values[field.key] as RecordLike[]) : [];
        payload[field.key] = rows.map((row, index) => {
          const cleaned: RecordLike = row.id !== undefined ? { id: row.id } : {};
          for (const column of field.columns) {
            const raw = row[column.key];
            switch (column.kind) {
              case "number":
                cleaned[column.key] = raw === "" || raw === null || raw === undefined ? null : Number(raw);
                break;
              case "image":
                if (raw instanceof File) cleaned[column.key] = raw;
                break;
              case "select":
                cleaned[column.key] = raw ?? null;
                break;
              default:
                cleaned[column.key] = nullIfEmpty(raw);
            }
          }
          // الترتيب من موضع الصف، لا من رقم يكتبه المستخدم.
          if (field.sortable && field.orderKey) cleaned[field.orderKey] = index + 1;
          return cleaned;
        });
        break;
      }
      default:
        payload[field.key] = nullIfEmpty(values[field.key]);
    }
  }

  return payload;
}

const isBlank = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

/** الحقول المطلوبة الفارغة. تُعرض قبل الإرسال حتى لا يذهب طلب ناقص. */
export function requiredErrors(fields: FieldDef[], values: Values, mode: Mode): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    // صفوف مثل سطور الأصناف: إن بقي في أي صف عمود مطلوب فارغاً فالحقل كله غير مكتمل.
    // فلا يُرسل صف ناقص، بدل أن يعيد الخادم خطأً عاماً لا يحدد السطر.
    if (field.kind === "rows") {
      const rows = Array.isArray(values[field.key]) ? (values[field.key] as RecordLike[]) : [];
      const incomplete = rows.some((row) =>
        field.columns.some((column) => column.required && isBlank(row[column.key]))
      );
      if (incomplete) errors[field.key] = "required";
      continue;
    }

    if (!field.required) continue;
    if (mode === "create" && field.editOnly) continue;
    if (mode === "update" && field.createOnly) continue;

    const value = values[field.key];
    const empty =
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);

    if (field.kind === "bilingual") {
      const arabic = values[`${field.key}_ar`];
      const emptyArabic = typeof arabic !== "string" || arabic.trim() === "";
      if (empty && emptyArabic) errors[field.key] = "required";
    } else if (empty) {
      errors[field.key] = "required";
    }
  }

  return errors;
}

/**
 * حدود الأرقام قبل الإرسال: أدنى وأعلى قيمة، وألا يقل الحقل عن حقل آخر. الرسائل تُبنى
 * بلغة الواجهة، فلا يصل الخادم قيمة يرفضها ويعيد خطأ 422 غامضاً.
 */
export function rangeErrors(
  fields: FieldDef[],
  values: Values,
  translate: (key: string, options: Record<string, unknown>) => string
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (field.kind !== "number") continue;
    const raw = values[field.key];
    if (raw === "" || raw === null || raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    if (field.min !== undefined && value < field.min) {
      errors[field.key] = translate("crud.range.min", { label: field.label, min: field.min });
    } else if (field.max !== undefined && value > field.max) {
      errors[field.key] = translate("crud.range.max", { label: field.label, max: field.max });
    } else if (field.notBelow) {
      const other = values[field.notBelow];
      const otherValue = other === "" || other === null || other === undefined ? null : Number(other);
      if (otherValue !== null && Number.isFinite(otherValue) && value < otherValue) {
        const otherLabel = fields.find((item) => item.key === field.notBelow)?.label ?? field.notBelow;
        errors[field.key] = translate("crud.range.notBelow", { label: field.label, other: otherLabel });
      }
    }
  }

  return errors;
}

/** أخطاء الخادم مربوطة بمفاتيح الحقول، والحقل ثنائي اللغة يقبل خطأ العربي أيضاً. */
export function serverErrors(
  fields: FieldDef[],
  fieldErrors: Record<string, string[]>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const direct = fieldErrors[field.key]?.[0];
    const arabic = field.kind === "bilingual" ? fieldErrors[`${field.key}_ar`]?.[0] : undefined;
    const message = direct ?? arabic;
    if (message) errors[field.key] = message;
  }

  return errors;
}
