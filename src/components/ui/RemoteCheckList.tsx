import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Search } from "lucide-react";
import type { RemoteSource } from "@/components/crud/types";
import type { Option } from "./Fields";
import { Skeleton } from "./Bars";

/**
 * قائمة اختيار متعدد تبحث في الخادم: كل صفحة عشرون خياراً تطابق ما كتبه المستخدم، والصفحة
 * التالية تُطلب عند الحاجة. المختار يُحسب في العدّاد دائماً، والمختار الذي لم يظهر بعد في الصفحات
 * المحمّلة يتقدم القائمة بأسمائه المعروفة (known) حين لا يكون هناك بحث، دون أن يُطلب أي عنصر منفرداً.
 */
export function RemoteCheckList({
  source,
  selected,
  onChange,
  known = [],
  readOnly = false,
  error,
}: {
  source: RemoteSource;
  selected: (string | number)[];
  onChange: (next: (string | number)[]) => void;
  /** أسماء المختار المعروفة من طلب مشترك، وتُستعمل لما لم يظهر منه بعد في الصفحات المحمّلة. */
  known?: Option[];
  readOnly?: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  // البحث ينتظر توقف الكتابة قليلاً، ثم يذهب إلى الخادم.
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useInfiniteQuery({
    queryKey: ["remote-checklist", source.cacheKey, term],
    queryFn: ({ pageParam, signal }) => source.search(term, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length < last.lastPage ? pages.length + 1 : undefined),
    staleTime: 60_000,
  });
  const loaded: Option[] = results.data?.pages.flatMap((page) => page.items) ?? [];
  const chosen = new Set(selected.map(String));

  // المختار الذي لم يظهر بعد في الصفحات المحمّلة يتقدم القائمة بأسمائه المعروفة، ولا يتحرك
  // الظاهر منها عند تغيير اختياره.
  const loadedKeys = new Set(loaded.map((option) => String(option.value)));
  const pinned = term
    ? []
    : known.filter((option) => chosen.has(String(option.value)) && !loadedKeys.has(String(option.value)));
  const rows = [...pinned, ...loaded];

  const toggle = (value: string | number) => {
    const key = String(value);
    onChange(chosen.has(key) ? selected.filter((item) => String(item) !== key) : [...selected, value]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("crud.searchPlaceholder")}
            aria-label={t("crud.searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>
        <span className="text-sm font-medium text-ink-soft tabular-nums">
          {t("crud.selectedCount", { count: selected.length })}
        </span>
      </div>

      {results.isPending ? (
        <Skeleton className="h-48" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">{t("crud.noResults")}</p>
      ) : (
        <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
          {rows.map((option) => {
            const on = chosen.has(String(option.value));
            return (
              <label
                key={String(option.value)}
                className={clsx(
                  "flex items-start gap-3 rounded-lg px-3 py-2.5 transition",
                  readOnly ? "cursor-not-allowed" : "cursor-pointer",
                  on ? "bg-primary-soft" : !readOnly && "hover:bg-canvas"
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={readOnly}
                  onChange={() => toggle(option.value)}
                  className="mt-0.5 size-4 shrink-0 accent-secondary"
                />
                {option.image ? (
                  <img src={option.image} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-line" />
                ) : (
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-sm font-bold text-muted ring-1 ring-line"
                    aria-hidden
                  >
                    {option.label.charAt(0) || "?"}
                  </span>
                )}
                <span className="block min-w-0 truncate text-sm font-medium text-ink">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {results.hasNextPage && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={results.isFetchingNextPage}
            onClick={() => void results.fetchNextPage()}
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-secondary hover:bg-secondary-soft disabled:opacity-50"
          >
            {t("crud.loadMore")}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
