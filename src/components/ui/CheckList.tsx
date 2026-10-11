import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Search } from "lucide-react";
import { Pagination } from "./Pagination";
import { PAGE_SIZE, pageOf } from "./paging";

export interface CheckItem {
  id: number;
  label: string;
  /** صورة تظهر بجانب الاسم، إن وُجدت. */
  image?: string | null;
  /** سطر توضيحي تحت الاسم، مثل سبب تعطيل الاختيار. */
  hint?: string;
  /** لا يمكن اختياره الآن، مع توضيح سببه في `hint`. */
  disabled?: boolean;
}

/**
 * قائمة اختيار متعددة مع بحث: تكتب جزءاً من الاسم فتضيّق القائمة، وتبقى
 * الاختيارات محفوظة حتى لو خرجت من نتائج البحث. الاختيار بالنقر على السطر كله.
 */
export function CheckList({
  items,
  selected,
  onChange,
  readOnly = false,
}: {
  items: CheckItem[];
  selected: number[];
  onChange: (next: number[]) => void;
  /** عرض فقط: القائمة تُقرأ ولا يُغيَّر فيها شيء. */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;
  }, [items, query]);

  // القائمة تُعرض عشرين صفاً في الصفحة، والبحث يضيّق القائمة كلها قبل الترقيم.
  const paged = pageOf(visible, page);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("crud.searchPlaceholder")}
            aria-label={t("crud.searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>
        <span className="text-sm font-medium text-ink-soft tabular-nums">
          {t("crud.selectedCount", { count: selected.length })}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">{t("crud.noResults")}</p>
      ) : (
        <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
          {paged.items.map((item) => {
            const checked = selected.includes(item.id);
            const locked = item.disabled || readOnly;
            return (
              <label
                key={item.id}
                className={clsx(
                  "flex items-start gap-3 rounded-lg px-3 py-2.5 transition",
                  locked ? "cursor-not-allowed" : "cursor-pointer",
                  item.disabled && "opacity-50",
                  checked ? "bg-primary-soft" : !locked && "hover:bg-canvas"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 size-4 shrink-0 accent-secondary"
                />
                {item.image ? (
                  <img src={item.image} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-line" />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-sm font-bold text-muted ring-1 ring-line" aria-hidden>
                    {item.label.charAt(0) || "?"}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{item.label}</span>
                  {item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
      )}
      {visible.length > PAGE_SIZE && <Pagination meta={paged.meta} onPageChange={setPage} />}
    </div>
  );
}
