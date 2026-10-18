import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Filter, RotateCcw, X } from "lucide-react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterSheetProps {
  /** الفلاتر المطبّقة الآن، وتظهر على الهاتف شارات قابلة للإزالة فوق القائمة. */
  activeFilters: ActiveFilter[];
  onReset: () => void;
  /** حقول الفلاتر نفسها. تُعرض في شريط على الشاشات الواسعة، وفي نافذة سفلية على الهاتف. */
  children: ReactNode;
}

/**
 * الفلاتر على الهاتف: زر واحد يحمل عدد الفلاتر النشطة، يفتح الحقول في نافذة سفلية.
 * الشاشات `md` فما فوق تعرض الحقول في شريط ظاهر دائماً، كما كان.
 *
 * القيم مُدارة من الصفحة، فالنافذة لا تحفظ شيئاً: كل تغيير يُطبَّق فوراً، و«عرض النتائج» يغلقها فقط.
 */
export function FilterSheet({ activeFilters, onReset, children }: FilterSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const count = activeFilters.length;

  return (
    <>
      <div className="space-y-3 md:hidden">
        <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
          <Filter className="size-4" aria-hidden />
          {count > 0 ? t("common.filtersCount", { count }) : t("common.filters")}
        </Button>

        {count > 0 && (
          <ul className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <li key={filter.key} className="min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={filter.onRemove}
                  aria-label={`${t("common.removeFilter")}: ${filter.label}`}
                  className="inline-flex h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-3 text-sm font-medium text-ink ring-1 ring-primary/40 transition hover:ring-primary"
                >
                  <span className="truncate">{filter.label}</span>
                  <X className="size-3.5 shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="hidden gap-3 rounded-2xl border border-line bg-surface p-4 md:grid md:grid-cols-4 xl:grid-cols-7">
        {children}
        <Button variant="ghost" onClick={onReset} className="self-end">
          <RotateCcw className="size-4" aria-hidden />
          {t("common.resetFilters")}
        </Button>
      </section>

      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          size="md"
          title={t("common.filters")}
          footer={
            <>
              <Button variant="ghost" onClick={onReset}>
                <RotateCcw className="size-4" aria-hidden />
                {t("common.resetFilters")}
              </Button>
              <Button onClick={() => setOpen(false)}>{t("common.showResults")}</Button>
            </>
          }
        >
          <div className="grid gap-4">{children}</div>
        </Dialog>
      )}
    </>
  );
}
