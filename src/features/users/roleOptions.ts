import type { RemoteSource } from "@/components/crud/types";
import { asArray, asRecord, toText } from "@/lib/coerce";
import { roles } from "@/services";

/**
 * الأدوار تُبحث في الخادم عشرين في الصفحة. قيمة الخيار هي معرّف الدور، لأن الخادم يطلب أعداداً
 * في `roles` (`roles.0 must be an integer`). تُستعمل في نافذة صلاحيات الحساب، وفي نموذج المستخدم.
 */
export const ROLE_OPTIONS: RemoteSource = {
  cacheKey: "roles-ids",
  search: async (term, page, signal) => {
    const result = await roles.list({ page, per_page: 20, ...(term ? { search: term } : {}) }, signal);
    return {
      items: result.items.map((role) => ({
        value: Number(role.id),
        label: toText(role.label) || toText(role.name),
      })),
      lastPage: result.meta.lastPage,
    };
  },
  byId: async (value, signal) => {
    const role = await roles.get(value, signal);
    return { value, label: toText(role.label) || toText(role.name) || String(value) };
  },
};

/** دور من حساب، بمعرّفه للحفظ واسمه الظاهر للعرض. */
export interface RoleOption {
  value: number;
  label: string;
}

/**
 * قائمة الأدوار من استجابة `users/{id}/access`. الاستجابة قد تكون قائمة مباشرة، أو كائناً فيه
 * `roles`. لا نمرّرها بـ`asRecord` أولاً، فهي تحوّل القائمة إلى كائن فارغ.
 */
export function accessEntries(body: unknown): unknown[] {
  return Array.isArray(body) ? body : asArray(asRecord(body).roles);
}

/**
 * دور واحد من الاستجابة. إن جاء كائناً فيه `id` نأخذه مع اسمه، وإن جاء اسماً نبحث عن الدور بهذا
 * الاسم. ما لم نجد له معرّفاً نُرجع اسمه وحده، فيظهر للمشغّل ولا يُختار بالخطأ.
 */
export async function resolveRole(entry: unknown, signal?: AbortSignal): Promise<RoleOption | string | null> {
  const record = asRecord(entry);
  if (record.id !== undefined && record.id !== null) {
    const label = toText(record.label) || toText(record.name) || String(record.id);
    return { value: Number(record.id), label };
  }
  const name = typeof entry === "string" ? entry : toText(record.name);
  if (!name) return null;
  const found = await roles.list({ page: 1, per_page: 20, search: name }, signal);
  const match = found.items.find((role) => toText(role.name) === name);
  if (!match) return name;
  return { value: Number(match.id), label: toText(match.label) || toText(match.name) };
}
