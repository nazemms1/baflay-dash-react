import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Option } from "@/components/ui/Fields";
import { currentLanguage } from "@/i18n";
import { toNumber } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { ingredients } from "@/services";

export interface IngredientDetail {
  label: string;
  image: string | null;
}

const urlOf = (value: unknown): string | null => {
  if (typeof value === "string" && value) return value;
  const url = (value as { url?: unknown } | null | undefined)?.url;
  return typeof url === "string" && url ? url : null;
};

/** أقصى عدد من صفحات المكوّنات (كل صفحة مائة) التي تُحمَّل بحثاً عن أسماء المختار. */
const MAX_PAGES = 4;

/**
 * أسماء المكوّنات وصورها للمعرّفات التي تحتاجها الشاشة فقط (إضافات الصنف، إضافات البراند،
 * المسعّر في الفرع). الطلب الأول صفحة واحدة من مائة مكوّن تُحفظ في الذاكرة المؤقتة، ولا تُطلب
 * صفحات أخرى إلا إن بقي معرّف لم يظهر بعد، وبحد أقصى أربع صفحات. لا يُطلب مكوّن واحد وحده من الخادم.
 */
export function useIngredientDetails(ids: number[]): Map<number, IngredientDetail> {
  const language = currentLanguage();
  const catalog = useInfiniteQuery({
    queryKey: ["ingredients-catalog"],
    queryFn: ({ pageParam, signal }) => ingredients.list({ page: pageParam, per_page: 100 }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.currentPage < last.meta.lastPage ? last.meta.currentPage + 1 : undefined),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = catalog;
  const pages = catalog.data?.pages ?? [];

  const details = new Map<number, IngredientDetail>();
  for (const page of pages) {
    for (const row of page.items) {
      const id = toNumber(row.id);
      details.set(id, { label: localizedRecord(row, language) || `#${id}`, image: urlOf(row.image) });
    }
  }

  // صفحة إضافية فقط إن بقي معرّف لم يظهر بعد، وبحد أقصى عدد الصفحات.
  const missing = ids.some((id) => !details.has(id));
  useEffect(() => {
    if (missing && hasNextPage && !isFetchingNextPage && pages.length < MAX_PAGES) void fetchNextPage();
  }, [missing, hasNextPage, isFetchingNextPage, pages.length, fetchNextPage]);

  return details;
}

/** خيارات المختار بأسمائها وصورها، لمن عُرف اسمه من الطلب المشترك وحده. */
export function selectedOptions(ids: number[], details: Map<number, IngredientDetail>): Option[] {
  return ids.flatMap((id) => {
    const detail = details.get(id);
    return detail ? [{ value: id, label: detail.label, image: detail.image }] : [];
  });
}
