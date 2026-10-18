import { useTranslation } from "react-i18next";
import { Eye, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { currentLanguage } from "@/i18n";
import { toNumber, toText } from "@/lib/coerce";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Named } from "@/services";
import { DriverCell, RatingStars, StatusTrigger, TypeChip } from "./OrderRowParts";
import { branchOf, customerOf, refOf, typeOf } from "./orderRows";

interface OrderCardProps {
  row: Named;
  canView: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  onView: () => void;
  onAssign: () => void;
  onChangeStatus: () => void;
}

/**
 * كرت الطلب على الهاتف، بالترتيب الذي يُقرأ به الطلب: الرقم والنوع، ثم الزبون مع زر اتصال،
 * ثم السائق والفرع، ثم المبلغ والتقييم، وأسفله زرا الحالة والتفاصيل بعرض كامل.
 * كل إجراء يأتي من الصفحة نفسها كما في الجدول، فلا يتكرر المنطق.
 */
export function OrderCard({
  row,
  canView,
  canAssign,
  canChangeStatus,
  onView,
  onAssign,
  onChangeStatus,
}: OrderCardProps) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const customer = customerOf(row);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-canvas/60 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {canView ? (
            <button
              type="button"
              onClick={onView}
              className="cursor-pointer font-mono text-lg font-bold text-ink hover:text-secondary"
            >
              {refOf(row)}
            </button>
          ) : (
            <p className="font-mono text-lg font-bold text-ink">{refOf(row)}</p>
          )}
          <p className="mt-0.5 text-xs tabular-nums text-muted">{formatDateTime(toText(row.created_at) || null)}</p>
        </div>
        <TypeChip type={typeOf(row)} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate font-semibold text-ink">{customer.name}</p>
        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            dir="ltr"
            aria-label={`${t("drivers.card.call")} ${customer.phone}`}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-ok-soft px-3.5 text-sm font-semibold text-ok transition hover:opacity-90"
          >
            <Phone className="size-4 shrink-0" aria-hidden />
            <span className="tabular-nums">{customer.phone}</span>
          </a>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted">{t("ordersPage.colDriver")}</dt>
          <dd className="mt-1">
            <DriverCell row={row} canAssign={canAssign} onAssign={onAssign} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">{t("ordersPage.colBranch")}</dt>
          <dd className="mt-1 truncate text-ink-soft">{branchOf(row, language)}</dd>
        </div>
      </dl>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{t("orders.table.total")}</p>
          <p className="text-xl font-bold tabular-nums text-ink">
            {formatMoney(toNumber(row.final_price), toText(row.currency))}
          </p>
        </div>
        <RatingStars row={row} />
      </div>

      <StatusTrigger row={row} canChange={canChangeStatus} onOpen={onChangeStatus} block />

      {canView && (
        <Button variant="secondary" className="w-full" onClick={onView}>
          <Eye className="size-4" aria-hidden />
          {t("ordersPage.view")}
        </Button>
      )}
    </article>
  );
}
