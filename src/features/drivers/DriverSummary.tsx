import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatMoney, formatNumber } from "@/lib/format";
import { toAccountRow, type AccountRow } from "./driverReport";

/** صف صفري يُعرض قبل وصول أي طلب للسائق اليوم، فتبقى الأرقام ظاهرة بصفرها. */
const EMPTY_ROW = toAccountRow({});

/**
 * ملخص اليوم للسائق: المبلغ الذي يسلّمه آخر الدوام في البطاقة الرئيسية، ثم بقية المال والأعداد.
 * المال يُعرض لكل عملة على حدة ولا يُجمع بين العملات، والأعداد تُجمع من كل العملات.
 */
export function DriverSummary({ rows }: { rows: AccountRow[] }) {
  const { t } = useTranslation();
  const list = rows.length > 0 ? rows : [EMPTY_ROW];

  const sum = (pick: (row: AccountRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const perCurrency = (pick: (row: AccountRow) => number) =>
    list.map((row) => formatMoney(pick(row), row.currency)).join(" · ");

  return (
    <section aria-label={t("drivers.summary.title")} className="space-y-3">
      <div className="rounded-3xl bg-ink p-5 text-surface shadow-sm">
        <p className="text-sm font-medium text-surface/75">{t("drivers.summary.cashToHandIn")}</p>
        <div className="mt-1 space-y-1">
          {list.map((row, index) => (
            <p key={`${row.currency}-${index}`} className="text-3xl font-bold tabular-nums">
              {formatMoney(row.cashToHandIn, row.currency)}
            </p>
          ))}
        </div>
        <p className="mt-1 text-xs text-surface/70">{t("drivers.summary.cashToHandInHint")}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label={t("drivers.summary.cashInTransit")} value={perCurrency((row) => row.cashInTransit)} />
        <Tile label={t("drivers.summary.failedCash")} value={perCurrency((row) => row.failedCash)} />
        <Tile label={t("drivers.summary.failedCardOrders")} value={formatNumber(sum((row) => row.failedCardOrders))} />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Count label={t("drivers.summary.delivered")} value={sum((row) => row.delivered)} tone="text-ok" />
        <Count label={t("drivers.summary.failed")} value={sum((row) => row.failed)} tone="text-danger" />
        <Count label={t("drivers.summary.outNow")} value={sum((row) => row.outNow)} tone="text-info" />
        <Count label={t("drivers.summary.assigned")} value={sum((row) => row.assigned)} tone="text-ink" />
      </div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-3">
      <p className="truncate text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-canvas px-2 py-3 text-center">
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{formatNumber(value)}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}
