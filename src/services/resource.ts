import { api } from "@/lib/http/client";
import { toPage, unwrapData, type Page } from "@/lib/http/envelope";

export type ListParams = Record<string, string | number | boolean | null | undefined>;
export type Payload = Record<string, unknown> | FormData;
export type Id = number | string;

/**
 * عمليات CRUD القياسية لأي مورد يتبع المسار نفسه: `basePath` و`basePath/{id}`.
 *
 * التعديل يتبع ما يقبله الخادم فعلاً: JSON يذهب بـ `PUT`، والملفات تذهب
 * بـ `POST` مع `_method=PUT` لأن PHP لا يقرأ multipart مع `PUT` مباشرة.
 */
/**
 * كل صفحات مورد: لقوائم الاختيار التي تحتاج عناصرها كلها. الخادم قد يحدّد عدد
 * العناصر في الصفحة الواحدة، فنتبع `last_page` حتى لا يضيع صنف خارج الصفحة الأولى.
 */
export async function listAll<T>(
  fetchPage: (query: ListParams, signal?: AbortSignal) => Promise<Page<T>>,
  signal?: AbortSignal,
  perPage = 100
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= 200; page += 1) {
    const result = await fetchPage({ page, per_page: perPage }, signal);
    all.push(...result.items);
    if (result.items.length === 0 || page >= result.meta.lastPage) break;
  }
  return all;
}

export function createResource<T>(basePath: string) {
  return {
    list(params: ListParams = {}, signal?: AbortSignal): Promise<Page<T>> {
      return api.get(basePath, { params, signal }).then((response) => toPage<T>(response.data));
    },

    get(id: Id, signal?: AbortSignal): Promise<T> {
      return api
        .get(`${basePath}/${id}`, { signal })
        .then((response) => unwrapData<T>(response.data));
    },

    create(payload: Payload): Promise<T> {
      return api.post(basePath, payload).then((response) => unwrapData<T>(response.data));
    },

    update(id: Id, payload: Payload): Promise<T> {
      if (payload instanceof FormData) {
        payload.set("_method", "PUT");
        return api
          .post(`${basePath}/${id}`, payload)
          .then((response) => unwrapData<T>(response.data));
      }
      return api
        .put(`${basePath}/${id}`, payload)
        .then((response) => unwrapData<T>(response.data));
    },

    remove(id: Id): Promise<unknown> {
      return api.delete(`${basePath}/${id}`).then((response) => response.data as unknown);
    },
  };
}
