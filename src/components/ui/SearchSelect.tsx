import { useEffect, useId, useMemo, useRef, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Option } from "./Fields";
import { dropdownClass } from "./dropdownStyle";

/** عدد النتائج في الدفعة الواحدة؛ تُحمَّل الدفعة التالية عند الوصول لأسفل القائمة. */
const PAGE_SIZE = 20;

const normalize = (value: string) => value.trim().toLowerCase();

interface SearchSelectProps {
  label: string;
  options: Option[];
  value: string | number | null;
  /** الاسم الذي يُعرض قبل وصول الخيارات، أو إن لم يكن الصنف ضمنها. */
  fallbackLabel?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  onChange: (value: string | number | null, label: string) => void;
}

/**
 * اختيار قابل للبحث: يفتح قائمة بحث داخلها، فيكتب المستخدم جزءاً من الاسم ويجد
 * الصنف فوراً بدل التمرير بين مئات الخيارات. الاسم الذي اختاره يبقى ظاهراً.
 */
export function SearchSelect({
  label,
  options,
  value,
  fallbackLabel,
  placeholder,
  required,
  error,
  disabled,
  onChange,
}: SearchSelectProps) {
  const { t } = useTranslation();
  const generated = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const selected = options.find((option) => String(option.value) === String(value ?? ""));
  const shownLabel = selected?.label ?? fallbackLabel ?? "";

  const matching = useMemo(() => {
    const needle = normalize(query);
    return needle ? options.filter((option) => normalize(option.label).includes(needle)) : options;
  }, [options, query]);

  const results = matching.slice(0, visible);
  const hasMore = results.length < matching.length;

  const loadMore = () => setVisible((current) => current + PAGE_SIZE);

  // عند الوصول لأسفل القائمة تُضاف الدفعة التالية تلقائياً.
  const onListScroll = (event: UIEvent<HTMLUListElement>) => {
    const list = event.currentTarget;
    if (hasMore && list.scrollTop + list.clientHeight >= list.scrollHeight - 24) loadMore();
  };

  // إغلاق عند النقر خارج الحقل، دون أن يسرق النقر داخله التركيز.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const choose = (option: Option | null) => {
    onChange(option?.value ?? null, option?.label ?? "");
    setOpen(false);
    setQuery("");
    setVisible(PAGE_SIZE);
  };

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label id={`${generated}-label`} className="flex items-center gap-1 text-sm font-medium text-ink-soft">
        {label}
        {required && <span className="text-secondary">*</span>}
      </label>

      <button
        type="button"
        aria-labelledby={`${generated}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={clsx(
          dropdownClass({ error: !!error, open }),
          "flex w-full cursor-pointer items-center justify-between gap-2 text-start"
        )}
      >
        <span className={clsx("min-w-0 truncate", !shownLabel && "text-muted")}>
          {shownLabel || placeholder || t("crud.choose")}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div className="absolute start-0 end-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(PAGE_SIZE);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
                if (event.key === "Enter" && results.length > 0) {
                  event.preventDefault();
                  choose(results[0]);
                }
              }}
              placeholder={t("crud.searchPlaceholder")}
              aria-label={t("crud.searchPlaceholder")}
              className="h-9 w-full rounded-lg bg-canvas/60 ps-9 pe-8 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/40"
            />
            {query && (
              <button
                type="button"
                aria-label={t("crud.clearSearch")}
                onClick={() => setQuery("")}
                className="absolute end-4 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>

          <ul role="listbox" onScroll={onListScroll} className="max-h-64 overflow-y-auto p-1">
            {!required && value !== null && (
              <li>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="w-full cursor-pointer rounded-lg px-3 py-2 text-start text-sm text-muted hover:bg-canvas"
                >
                  {t("crud.clearSelection")}
                </button>
              </li>
            )}
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">{t("crud.noResults")}</li>
            )}
            {results.map((option) => {
              const active = String(option.value) === String(value ?? "");
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(option)}
                    className={clsx(
                      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm transition",
                      active ? "bg-primary-soft font-semibold text-ink" : "text-ink hover:bg-canvas"
                    )}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {active && <Check className="size-4 shrink-0 text-secondary" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-muted">
            <span className="tabular-nums">
              {t("crud.showingOf", { shown: results.length, total: matching.length })}
            </span>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                className="cursor-pointer rounded-md px-2 py-1 font-medium text-secondary hover:bg-secondary-soft"
              >
                {t("crud.loadMore")}
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
