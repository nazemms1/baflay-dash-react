import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { PageMeta } from "@/lib/http/envelope";

interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}

/** زر التنقل: 44px على الهاتف ليسهل لمسه، ويصغر على الشاشات الواسعة. */
const NAV_BUTTON =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-ink transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 sm:size-8 sm:rounded-lg";

/**
 * ترقيم الصفحات: «السابق» يشير دائماً نحو بداية الصفحة و«التالي» نحو نهايتها.
 * في الإنجليزية (LTR) السابق على اليسار بسهم ‹، وفي العربية (RTL) السابق على اليمين بسهم ›،
 * لذلك يُقلب السهم في RTL فقط، مع بقاء الاتجاه الدلالي للزر كما هو.
 */
export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const isFirst = meta.currentPage <= 1;
  const isLast = meta.currentPage >= meta.lastPage;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm text-muted">
      <span>{t("common.total", { count: formatNumber(meta.total) })}</span>
      <nav aria-label={t("common.pagination")} className="flex items-center gap-2">
        <button
          type="button"
          className={NAV_BUTTON}
          disabled={isFirst}
          onClick={() => onPageChange(meta.currentPage - 1)}
          aria-label={t("common.previous")}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </button>
        <span className="min-w-28 text-center text-ink-soft tabular-nums">
          {t("common.page", {
            page: formatNumber(meta.currentPage),
            last: formatNumber(meta.lastPage),
          })}
        </span>
        <button
          type="button"
          className={NAV_BUTTON}
          disabled={isLast}
          onClick={() => onPageChange(meta.currentPage + 1)}
          aria-label={t("common.next")}
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </button>
      </nav>
    </div>
  );
}
