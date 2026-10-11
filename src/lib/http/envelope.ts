import { asRecord, toNumber } from "@/lib/coerce";

/**
 * الخادم يغلّف الاستجابات بثلاثة أشكال، والكود القديم كان يخمّن أيّها عند كل
 * شاشة. هنا قراءة واحدة تُطبَّق على الجميع:
 *
 *   { data: X }                         → X
 *   { data: [...], meta: {…} }          → قائمة + ترقيم من meta
 *   { data: { data: [...], total… } }   → paginator لارافل: القائمة داخله
 *   [...]                               → قائمة بلا ترقيم
 */

export interface PageMeta {
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

/** يفكّ الغلاف الخارجي `{ data: X }` إن وُجد، وإلا يعيد الجسم كما هو. */
export function unwrapData<T>(body: unknown): T {
  if (body !== null && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function buildPage<T>(items: T[], source: Record<string, unknown>): Page<T> {
  return {
    items,
    meta: {
      total: toNumber(source.total, items.length),
      currentPage: toNumber(source.current_page, 1),
      lastPage: toNumber(source.last_page, 1),
      perPage: toNumber(source.per_page, items.length || 1),
    },
  };
}

export function toPage<T>(body: unknown): Page<T> {
  if (Array.isArray(body)) {
    return buildPage(body as T[], {});
  }

  const root = asRecord(body);
  const inner = root.data;

  if (Array.isArray(inner)) {
    return buildPage(inner as T[], { ...root, ...asRecord(root.meta) });
  }

  const paginator = asRecord(inner);
  if (Array.isArray(paginator.data)) {
    return buildPage(paginator.data as T[], { ...paginator, ...asRecord(root.meta) });
  }

  return buildPage<T>([], root);
}
