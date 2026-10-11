/**
 * تحويل كائن إلى `FormData` بالصيغة التي يقرأها الخادم: الكائنات المتداخلة
 * تُسطَّح بأقواس (`delivery[fee]`) والمصفوفات بفهارس (`items[0][id]`)، والملفات
 * تُرفق كما هي. القيم `null` و`undefined` تُحذف، فلا تصل للخادم فارغةً.
 */
export function toFormData(values: Record<string, unknown>): FormData {
  const form = new FormData();

  const append = (value: unknown, path: string) => {
    if (value === null || value === undefined) return;

    if (value instanceof File || value instanceof Blob) {
      form.append(path, value);
      return;
    }

    // الخادم (Laravel) يقبل المنطقي في النماذج متعددة الأجزاء كـ 1 و0 فقط،
    // والنص "true" يُرفض بخطأ "must be true or false".
    if (typeof value === "boolean") {
      form.append(path, value ? "1" : "0");
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        form.append(path, "[]");
        return;
      }
      value.forEach((entry, index) => append(entry, `${path}[${index}]`));
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) =>
        append(entry, path === "" ? key : `${path}[${key}]`)
      );
      return;
    }

    form.append(path, String(value));
  };

  Object.entries(values).forEach(([key, value]) => append(value, key));
  return form;
}

/** هل يحوي الكائن ملفاً في أي مستوى؟ عندها يلزم إرساله كـ `FormData`. */
export function containsFile(value: unknown): boolean {
  if (value instanceof Blob) return true;
  if (Array.isArray(value)) return value.some(containsFile);
  if (value && typeof value === "object") return Object.values(value).some(containsFile);
  return false;
}
