import type { PageMeta } from "@/lib/http/envelope";

/** عدد الصفوف في الصفحة الواحدة للقوائم المعروضة كاملة في الواجهة. */
export const PAGE_SIZE = 20;

/**
 * صفحة واحدة من قائمة محلية، مع بياناتها للترقيم. إن تجاوزت الصفحة المطلوبة آخر صفحة (بعد
 * بحث أو تصفية) تُعرض آخر صفحة بدلاً منها، فلا تبقى الشاشة فارغة.
 */
export function pageOf<T>(items: T[], page: number, size: number = PAGE_SIZE) {
  const lastPage = Math.max(1, Math.ceil(items.length / size));
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const meta: PageMeta = { total: items.length, currentPage, lastPage, perPage: size };
  return { items: items.slice((currentPage - 1) * size, currentPage * size), meta };
}
