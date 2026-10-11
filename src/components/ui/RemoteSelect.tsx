import { useEffect, useId, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { RemoteSource } from "@/components/crud/types";
import type { Option } from "./Fields";
import { dropdownClass } from "./dropdownStyle";

interface RemoteSelectProps {
  label: string;
  source: RemoteSource;
  value: string | number | null;
  /** الاسم الذي يُعرض قبل أن يصل الخيار المختار من الخادم. */
  fallbackLabel?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  onChange: (value: string | number | null, label: string) => void;
}

/**
 * قائمة اختيار تبحث في الخادم: تكتب جزءاً من الاسم فيأتي ما يطابقه عشرين في الطلب، ويُجلب
 * الخيار المختار وحده بمعرّفه. لا تُنزَّل القائمة كلها، ولا تُعرض إلا الصفحات المطلوبة.
 */
export function RemoteSelect({
  label,
  source,
  value,
  fallbackLabel,
  placeholder,
  required,
  error,
  disabled,
  onChange,
}: RemoteSelectProps) {
  const { t } = useTranslation();
  const generated = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  // البحث ينتظر توقف الكتابة قليلاً، ثم يذهب إلى الخادم.
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useInfiniteQuery({
    queryKey: ["remote-select", source.cacheKey, term],
    queryFn: ({ pageParam, signal }) => source.search(term, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length < last.lastPage ? pages.length + 1 : undefined),
    enabled: open,
    staleTime: 60_000,
  });
  const options: Option[] = results.data?.pages.flatMap((page) => page.items) ?? [];

  const hasValue = value !== null && value !== "";
  // الاسم المحفوظ مع السجل يكفي، فلا يُطلب الخيار من الخادم إلا إن لم يكن معروفاً.
  const chosen = useQuery({
    queryKey: ["remote-option", source.cacheKey, value],
    queryFn: ({ signal }) => source.byId(value as string | number, signal),
    enabled: hasValue && !fallbackLabel,
    staleTime: 5 * 60_000,
  });
  const shownLabel = fallbackLabel || chosen.data?.label || "";
  const selectedValue = String(value ?? "");

  // إغلاق عند النقر خارج الحقل، ودخول مباشر إلى حقل البحث عند الفتح.
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
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
                if (event.key === "Enter" && options.length > 0) {
                  event.preventDefault();
                  choose(options[0]);
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

          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {!required && hasValue && (
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
            {results.isPending && <li className="px-3 py-6 text-center text-sm text-muted">{t("common.loading")}</li>}
            {results.isSuccess && options.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">{t("crud.noResults")}</li>
            )}
            {options.map((option) => {
              const active = String(option.value) === selectedValue;
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

          {results.hasNextPage && (
            <div className="flex justify-end border-t border-line px-3 py-2">
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
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
