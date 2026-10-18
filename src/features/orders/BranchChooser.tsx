import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Phone, Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { currentLanguage } from "@/i18n";
import { toNumber, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { branches } from "@/services";

/**
 * الخطوة الوحيدة قبل البيع: اختيار الفرع. بعدها يُفتح الطلب على قائمة الفرع تلقائياً
 * وتظهر أصنافه، كما في نقطة البيع القديمة. الفروع تُعرض عشرة في الصفحة من الخادم.
 */
export function BranchChooser({ busyId, onSelect }: { busyId: number | null; onSelect: (id: number) => void }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ["pos", "branches", page],
    queryFn: ({ signal }) => branches.list({ page, per_page: 12 }, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-bold text-ink">{t("createOrder.chooseBranch")}</h2>
        <p className="text-sm text-ink-soft">{t("createOrder.chooseBranchHint")}</p>
      </header>

      {list.isPending ? (
        <Skeleton className="h-64" />
      ) : list.isError ? (
        <ErrorState message={t("errors.unexpected")} onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState>{t("createOrder.noBranches")}</EmptyState>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.data.items.map((row) => {
              const id = toNumber(row.id);
              const name = localizedRecord(row, language) || `#${id}`;
              const address = localizedRecord({ name: row.address, name_ar: row.address_ar }, language);
              const phone = toText(row.phone_number);
              const image = typeof row.image === "string" && row.image ? row.image : null;

              return (
                <li
                  key={id}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-surface transition ${
                    busyId === id ? "border-primary ring-2 ring-primary/40" : "border-line"
                  }`}
                >
                  {image ? (
                    <img src={image} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <span className="grid aspect-video w-full place-items-center bg-primary-soft text-ink">
                      <Store className="size-10" aria-hidden />
                    </span>
                  )}
                  <div className="flex flex-1 flex-col gap-4 p-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate font-semibold text-ink">{name}</h3>
                      {address && <p className="line-clamp-2 text-sm text-ink-soft">{address}</p>}
                      {phone && <p dir="ltr" className="text-xs tabular-nums text-muted">{phone}</p>}
                    </div>
                    <div className="mt-auto flex gap-2">
                      <Button
                        disabled={busyId !== null}
                        onClick={() => onSelect(id)}
                        className="flex-1 bg-secondary text-white hover:bg-secondary/90"
                      >
                        {busyId === id ? t("createOrder.opening") : t("createOrder.orderNow")}
                      </Button>
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary px-3 text-sm font-medium text-ink hover:bg-primary-soft"
                        >
                          <Phone className="size-4" aria-hidden />
                          {t("createOrder.call")}
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
