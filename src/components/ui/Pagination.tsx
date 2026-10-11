import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { PageMeta } from "@/lib/http/envelope";
import { Button } from "./Button";

interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}

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
        <Button
          variant="secondary"
          size="sm"
          className="w-9 px-0 disabled:opacity-40"
          disabled={isFirst}
          onClick={() => onPageChange(meta.currentPage - 1)}
          aria-label={t("common.previous")}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
        <span className="min-w-28 text-center text-ink-soft tabular-nums">
          {t("common.page", {
            page: formatNumber(meta.currentPage),
            last: formatNumber(meta.lastPage),
          })}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="w-9 px-0 disabled:opacity-40"
          disabled={isLast}
          onClick={() => onPageChange(meta.currentPage + 1)}
          aria-label={t("common.next")}
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </nav>
    </div>
  );
}
