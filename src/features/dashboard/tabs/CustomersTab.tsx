import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/ui/Panel";
import { ShareBar, Skeleton } from "@/components/ui/Bars";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime, formatNumber } from "@/lib/format";
import { QueryBody } from "../QueryBody";
import { KpiTile } from "../parts";
import { QuickLink } from "../QuickLink";
import type { Customers } from "../types";

export function CustomersTab({ query }: { query: UseQueryResult<Customers> }) {
  return (
    <QueryBody query={query} skeleton={<Skeleton className="h-80" />}>
      {(data) => <CustomersContent data={data} />}
    </QueryBody>
  );
}

function CustomersContent({ data }: { data: Customers }) {
  const { t } = useTranslation();
  const maxCount = Math.max(0, ...data.distribution.map((row) => row.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-12">
        <Panel title={t("dashboard.customers.rating.title")} description={t("dashboard.customers.rating.description")} className="lg:col-span-5">
          <div className="grid grid-cols-2 gap-4">
            <KpiTile
              label={t("dashboard.customers.rating.average")}
              value={
                data.averageRating === null
                  ? "—"
                  : `${formatNumber(data.averageRating, { maximumFractionDigits: 1 })} / 5`
              }
            />
            <KpiTile
              label={t("dashboard.customers.rating.response")}
              value={`${formatNumber(data.responsePct, { maximumFractionDigits: 1 })}%`}
              hint={t("dashboard.customers.rating.count", { count: data.ratings })}
            />
          </div>

          <ul className="mt-5 space-y-2.5">
            {data.distribution.map((row) => (
              <li key={row.stars} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="text-ink-soft tabular-nums">{t("dashboard.customers.rating.stars", { count: row.stars })}</span>
                <ShareBar value={row.count} max={maxCount} tone="primary" />
                <span className="text-end text-muted tabular-nums">{formatNumber(row.count)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={t("dashboard.customers.reviews.title")}
          description={t("dashboard.customers.reviews.description")}
          className="lg:col-span-7"
          action={<QuickLink to="/orders?max_rating=2" label={t("dashboard.quick.lowRated")} />}
        >
          {data.recentReviews.length === 0 ? (
            <EmptyState>{t("dashboard.customers.reviews.empty")}</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentReviews.map((review) => (
                <li key={review.orderNumber} className="space-y-2 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge tone={review.rating >= 4 ? "ok" : review.rating >= 3 ? "warn" : "danger"}>
                        {formatNumber(review.rating)} / 5
                      </Badge>
                      <span className="font-medium">{review.customerName || t("common.unnamed")}</span>
                    </div>
                    <span className="text-xs text-muted">{formatDateTime(review.ratedAt)}</span>
                  </div>
                  {review.note && <p className="text-sm text-ink-soft">“{review.note}”</p>}
                  <p className="text-xs text-muted">
                    {t("dashboard.customers.reviews.meta", {
                      order: review.orderNumber,
                      branch: review.branchName || "—",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
